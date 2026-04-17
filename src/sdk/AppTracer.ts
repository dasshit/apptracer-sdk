import { Platform } from "react-native";
import type {
  TErrorReport,
  TGlobalError,
  TLogBufferRow,
  TLogRow, TUploadBean,
} from "./types";

import { installGlobalHandlers } from "./global/GlobalHandlers";
import { RingLogBuffer } from "./logs/RingLogBuffer";
import { LogSerializer } from "./logs/LogSerializer";
import { FetchTransport } from "./transport/FetchTransport";
import { CrashReportBuilder } from "./report/CrashReportBuilder";
import { PendingReportsStore, type PendingReport } from "./persist/PendingReportsStore";
import { AppTracerInitOptions, IAppTracer } from "./IAppTracer";
import { createSessionId } from "./utils/session";

const SDK_API_BASE_URL = "https://sdk-api.apptracer.ru";

export class AppTracerClass implements IAppTracer {
  private appToken?: string;

  private logBuffer?: RingLogBuffer<TLogBufferRow>;
  private logSerializer?: LogSerializer;
  private transport?: FetchTransport;
  private reportBuilder?: CrashReportBuilder;

  private store?: PendingReportsStore;

  private uninstallHandlers?: () => void;

  private isReporting = false;
  private persistNonFatal = false;

  private sessionId?: string;

  constructor() {}

  /**
   * Инициализация SDK
   * @param options {AppTracerInitOptions} - параметры для инициализации SDK
   */
  init(options: AppTracerInitOptions) {
    this.appToken = options.appToken;
    this.sessionId = createSessionId()

    this.persistNonFatal = options.persistNonFatal ?? false;

    const maxLogs = options?.maxLogs ?? 100;
    const maxLogBytes = options?.maxLogBytes ?? 64 * 1024;
    const maxLineBytes = options?.maxLineBytes ?? 2048;

    this.logBuffer = new RingLogBuffer<TLogBufferRow>(maxLogs);
    this.logSerializer = new LogSerializer({
      maxTotalBytes: maxLogBytes,
      maxLineBytes,
    });

    this.transport = new FetchTransport({
      baseUrl: SDK_API_BASE_URL,
      logLevel: options.httpLogLevel ?? "error",
      timeoutMs: 15000,
      redactKeys: ["appToken", "crashToken", "deviceId", "authorization"],
    });

    this.reportBuilder = new CrashReportBuilder((): TUploadBean => ({
      id: createSessionId(),
      count: 1,
      versionCode: options.versionCode ?? 0,
      versionName: options.versionName ?? "0.0.0",
      vendor: Platform.OS,
      osVersion: String(Platform.Version),
      sessionId: this.sessionId as string,
      deviceId: options.deviceId ?? "UNKNOWN",
    }));

    this.store = new PendingReportsStore({
      storageKey: options.persistKey ?? "__apptracer_pending_reports__",
      maxItems: options.persistMaxItems ?? 50,
    });

    // handlers
    this.uninstallHandlers?.();
    this.uninstallHandlers = installGlobalHandlers((err, isFatal) => {
      const normalized = this.normalizeUnknownToGlobalError(err, isFatal);
      this.captureGlobalError(normalized);
    });

    // попытаться отправить накопленное при старте
    void this.drainPending();
  }

  shutdown() {
    this.uninstallHandlers?.();
    this.uninstallHandlers = undefined;
  }

  addLog(row: TLogRow) {
    const logSeq = this.logBuffer?.nextSeq() as number;
    this.logBuffer?.push({ ...row, logSeq });
  }

  public captureException(err: unknown, isFatal = false) {
    const normalized = this.normalizeUnknownToGlobalError(err, isFatal);
    this.captureGlobalError(normalized);
  }

  private async persistPayload(payload: unknown) {
    const item: PendingReport = {
      id: this.newId(),
      createdAt: Date.now(),
      payload,
    };
    await this.store?.enqueue(item);
  }

  private captureGlobalError(error: TGlobalError) {
    if (this.isReporting) return;

    // Важно: для fatal сначала persist (await нельзя в handler напрямую без риска),
    // поэтому делаем fire-and-forget, но первым действием.
    // Если хочешь 100% гарантию — нужно синхронное нативное хранилище, но в JS это компромисс.
    const shouldPersistFirst = Boolean(error.isFatal);

    this.isReporting = true;

    (async () => {
      try {
        const payload = this.buildPayload([error]);

        if (shouldPersistFirst) {
          await this.persistPayload(payload);
        }

        await this.sendPayload(payload);

        // если отправили успешно и это был fatal, можно удалить один последний элемент,
        // но мы не знаем его id (мы сохраняем до отправки). Поэтому проще:
        // - либо не удалять (будет дубль),
        // - либо сохранять с id и удалять по id.
        // Сделаем правильно: сохраняем с id и удаляем по id (см. ниже улучшение).
      } catch (e) {
        // если non-fatal и включено persistNonFatal — сохраняем при неудаче
        try {
          if (!error.isFatal && this.persistNonFatal) {
            const payload = this.buildPayload([error]);
            await this.persistPayload(payload);
          }
        } catch {
          // ignore
        }
      } finally {
        this.isReporting = false;
      }
    })().catch(() => {
      this.isReporting = false;
    });
  }

  private buildPayload(errors: TGlobalError[]): TErrorReport[] {
    const logsSnapshot = this.logBuffer?.snapshot() as TLogBufferRow[];
    const logsFileBase64 = this.logSerializer?.serializeToBase64(logsSnapshot) as string;

    return errors.map((e) => this.reportBuilder?.buildReport(e, logsFileBase64)) as TErrorReport[];
  }

  private async sendPayload(payload: TErrorReport[]) {
    await this.transport?.postJson("/api/crash/uploadBatch", payload, {
      query: {
        appToken: this.appToken ?? "unknown",
        crashToken: this.appToken ?? "unknown",
        compressType: "NONE",
      },
      logBody: false,
      logResponseBody: false,
    });
  }

  /**
   * Отправляет всё, что накопилось в storage.
   * Стратегия: читаем список → пытаемся отправить по одному → удаляем успешно отправленные.
   * Можно оптимизировать батчингом, если сервер поддерживает.
   */
  async drainPending() {
    const items = (await this.store?.loadAll()) as PendingReport[];
    if (items.length === 0) return;

    const sentIds: string[] = [];

    for (const item of items) {
      try {
        // payload у нас это TErrorReport[] (или что ты решишь)
        await this.sendPayload(item.payload as any);
        sentIds.push(item.id);
      } catch {
        // если сеть недоступна — прекращаем, чтобы не крутить цикл
        break;
      }
    }

    await this.store?.removeByIds(sentIds);
  }

  private normalizeUnknownToGlobalError(err: any, isFatal?: boolean): TGlobalError {
    const e = err?.reason ?? err;
    return {
      name: e?.name,
      message: String(e?.message ?? e),
      stack: e?.stack,
      isFatal: Boolean(isFatal),
    };
  }

  private newId() {
    // без зависимостей: достаточно для очереди
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

// singleton
// AppTracer.ts (внизу)
const g = globalThis as any;

export const AppTracer: IAppTracer =
  g.__app_tracer_reporter ?? (g.__app_tracer_reporter = new AppTracerClass());
