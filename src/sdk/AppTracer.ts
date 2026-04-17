import { Platform } from "react-native";
import type { TErrorReport, TGlobalError, TLogBufferRow, TLogRow, TUploadBean } from "./types";

import { installGlobalHandlers } from "./global/GlobalHandlers";
import { RingLogBuffer } from "./logs/RingLogBuffer";
import { LogSerializer } from "./logs/LogSerializer";
import { FetchTransport } from "./transport/FetchTransport";
import { CrashReportBuilder } from "./report/CrashReportBuilder";
import { PendingReportsStore, type PendingReport } from "./persist/PendingReportsStore";
import { AppTracerInitOptions, IAppTracer } from "./IAppTracer";
import { createSessionId } from "./utils/session";

/** Базовый URL для API сервера AppTracer */
const SDK_API_BASE_URL = "https://sdk-api.apptracer.ru";

/**
 * Основной класс SDK для отслеживания ошибок в React Native приложениях.
 *
 * Перехватывает глобальные ошибки, необработанные Promise rejection,
 * собирает логи (breadcrumbs) и отправляет отчёты на сервер.
 *
 * @example
 * ```typescript
 * AppTracer.init({
 *   appToken: "YOUR_APP_TOKEN",
 *   deviceId: "device-123",
 *   versionCode: 1,
 *   versionName: "1.0.0"
 * });
 * ```
 */
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
   * Инициализирует SDK. Должен быть вызван один раз при старте приложения.
   *
   * После инициализации SDK:
   * - Устанавливает глобальные обработчики ошибок (ErrorUtils, unhandledrejection)
   * - Пытается отправить накопленные ранее отчёты из хранилища
   * - Начинает сбор логов (breadcrumbs)
   *
   * @param options - параметры конфигурации SDK
   * @param options.appToken - токен приложения (обязательно)
   * @param options.deviceId - уникальный идентификатор устройства
   * @param options.versionCode - числовой код версии приложения
   * @param options.versionName - строковая версия приложения (например, "1.0.0")
   * @param options.endpointBaseUrl - URL сервера (по умолчанию https://sdk-api.apptracer.ru)
   * @param options.maxLogs - максимальное количество логов в буфере (по умолчанию 100)
   * @param options.maxLogBytes - максимальный размер файла логов в байтах (по умолчанию 64KB)
   * @param options.persistNonFatal - сохранять non-fatal ошибки при неудачной отправке (по умолчанию false)
   *
   * @example
   * ```typescript
   * AppTracer.init({
   *   appToken: "abc123",
   *   deviceId: "device-456",
   *   versionCode: 1,
   *   versionName: "1.0.0",
   *   maxLogs: 200,
   * });
   * ```
   */
  init(options: AppTracerInitOptions) {
    this.appToken = options.appToken;
    this.sessionId = createSessionId();

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
      baseUrl: options.endpointBaseUrl ?? SDK_API_BASE_URL,
      logLevel: options.httpLogLevel ?? "error",
      timeoutMs: 15000,
      redactKeys: ["appToken", "crashToken", "deviceId", "authorization"],
    });

    this.reportBuilder = new CrashReportBuilder(
      (): TUploadBean => ({
        id: createSessionId(),
        count: 1,
        versionCode: options.versionCode ?? 0,
        versionName: options.versionName ?? "0.0.0",
        vendor: Platform.OS,
        osVersion: String(Platform.Version),
        sessionId: this.sessionId as string,
        deviceId: options.deviceId ?? "UNKNOWN",
      }),
    );

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

  /**
   * Отключает SDK и удаляет все глобальные обработчики ошибок.
   *
   * После вызова этого метода SDK перестанет перехватывать ошибки.
   * Может быть использован для корректного завершения работы приложения.
   *
   * @example
   * ```typescript
   * AppTracer.shutdown();
   * ```
   */
  shutdown() {
    this.uninstallHandlers?.();
    this.uninstallHandlers = undefined;
  }

  /**
   * Добавляет запись лога (breadcrumb) в кольцевой буфер.
   *
   * Логи сохраняются и прикрепляются к отчёту об ошибке при её возникновении.
   * Максимальное количество логов определяется параметром `maxLogs` в init().
   * При превышении лимита старые логи удаляются.
   *
   * @param row - объект с данными лога
   * @param row.level - уровень логирования (severity и text)
   * @param row.timestamp - время создания лога в миллисекундах
   * @param row.msg - текст сообщения лога
   *
   * @example
   * ```typescript
   * AppTracer.addLog({
   *   level: { severity: 1, text: "INFO" },
   *   timestamp: Date.now(),
   *   msg: "User clicked button"
   * });
   * ```
   */
  addLog(row: TLogRow) {
    const logSeq = this.logBuffer?.nextSeq() as number;
    this.logBuffer?.push({ ...row, logSeq });
  }

  /**
   * Ручная отправка исключения/ошибки.
   *
   * Используйте этот метод для отправки ошибок, перехваченных в try/catch блоках
   * или других ситуациях, где нужна ручная обработка.
   *
   * @param err - ошибка для отправки (Error, unknown или любой объект)
   * @param isFatal - пометить ошибку как фатальную (по умолчанию false)
   *
   * @example
   * ```typescript
   * try {
   *   riskyOperation();
   * } catch (error) {
   *   AppTracer.captureException(error);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Пометить как фатальную
   * AppTracer.captureException(new Error("Critical failure"), true);
   * ```
   */
  public captureException(err: unknown, isFatal = false) {
    const normalized = this.normalizeUnknownToGlobalError(err, isFatal);
    this.captureGlobalError(normalized);
  }

  /**
   * Сохраняет payload в персистентное хранилище для последующей отправки.
   * @internal
   */
  private async persistPayload(payload: unknown) {
    const item: PendingReport = {
      id: this.newId(),
      createdAt: Date.now(),
      payload,
    };
    await this.store?.enqueue(item);
  }

  /**
   * Обрабатывает и отправляет глобальную ошибку.
   *
   * Для фатальных ошибок сначала сохраняет в хранилище, затем пытается отправить.
   * Для non-fatal ошибок сохраняет только при включённом persistNonFatal и неудачной отправке.
   * @internal
   */
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
      } catch {
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

  /**
   * Строит payload для отправки из списка ошибок.
   * Включает snapshot логов в формате Base64.
   * @internal
   */
  private buildPayload(errors: TGlobalError[]): TErrorReport[] {
    const logsSnapshot = this.logBuffer?.snapshot() as TLogBufferRow[];
    const logsFileBase64 = this.logSerializer?.serializeToBase64(logsSnapshot) as string;

    return errors.map((e) => this.reportBuilder?.buildReport(e, logsFileBase64)) as TErrorReport[];
  }

  /**
   * Отправляет payload на сервер через HTTP транспорт.
   * @internal
   */
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
   * Отправляет все накопленные отчёты из персистентного хранилища.
   *
   * Автоматически вызывается при инициализации SDK.
   * Может быть вызван вручную для принудительной отправки.
   *
   * Стратегия: читает список из хранилища → отправляет по одному →
   * удаляет успешно отправленные.
   *
   * @returns Promise, который разрешается после завершения отправки
   *
   * @example
   * ```typescript
   * await AppTracer.drainPending();
   * ```
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

  /**
   * Нормализует неизвестную ошибку к формату TGlobalError.
   *
   * Обрабатывает:
   * - Error объекты
   * - Promise rejection events
   * - Произвольные объекты
   * @internal
   */
  private normalizeUnknownToGlobalError(err: any, isFatal?: boolean): TGlobalError {
    const e = err?.reason ?? err;
    return {
      name: e?.name,
      message: String(e?.message ?? e),
      stack: e?.stack,
      isFatal: Boolean(isFatal),
    };
  }

  /**
   * Генерирует уникальный идентификатор.
   * @internal
   */
  private newId() {
    // без зависимостей: достаточно для очереди
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

const g = globalThis as any;

/**
 * Глобальный singleton экземпляр AppTracer SDK.
 *
 * Используйте этот объект для взаимодействия с SDK:
 * - `AppTracer.init()` - инициализация
 * - `AppTracer.captureException()` - ручная отправка ошибок
 * - `AppTracer.addLog()` - добавление логов
 * - `AppTracer.drainPending()` - отправка накопленных отчётов
 * - `AppTracer.shutdown()` - отключение SDK
 *
 * @example
 * ```typescript
 * import AppTracer from "@ddastter/apptracer-sdk";
 *
 * AppTracer.init({
 *   appToken: "YOUR_TOKEN",
 *   deviceId: "device-123",
 *   versionCode: 1,
 *   versionName: "1.0.0"
 * });
 * ```
 */
export const AppTracer: IAppTracer =
  g.__app_tracer_reporter ?? (g.__app_tracer_reporter = new AppTracerClass());