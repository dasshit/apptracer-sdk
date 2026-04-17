import type { HttpLogLevel } from "./transport/FetchTransport";
import type { TAppTracerInitOptions, TLogRow } from "./types";

export type AppTracerInitOptions = TAppTracerInitOptions & {
  httpLogLevel?: HttpLogLevel;
  maxLogs?: number;
  maxLogBytes?: number;
  maxLineBytes?: number;
  endpointBaseUrl?: string;

  persistKey?: string;
  persistMaxItems?: number;
  persistNonFatal?: boolean;

  sessionId?: string;
  deviceName?: string;
  deviceId?: string;
};

export interface IAppTracer {
  init(options: AppTracerInitOptions): void;
  shutdown(): void;

  /** Добавить строку в буфер логов (breadcrumbs). */
  addLog(row: TLogRow): void;

  /**
   * Ручной репорт исключения/ошибки (например, из try/catch).
   * isFatal — логическая пометка, не обязательно приводит к падению приложения.
   */
  captureException(err: unknown, isFatal?: boolean): void;

  /** Отправить накопленные pending-репорты из персистентного хранилища. */
  drainPending(): Promise<void>;
}
