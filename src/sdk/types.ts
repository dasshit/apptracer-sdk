import type { HttpLogLevel } from "./transport/FetchTransport";

/**
 * Базовые параметры инициализации AppTracer SDK.
 *
 * Содержит обязательные параметры для работы SDK.
 * Расширяется в `AppTracerInitOptions` дополнительными опциональными параметрами.
 *
 * @see AppTracerInitOptions
 */
export type TAppTracerInitOptions = {
  /**
   * Токен приложения для авторизации на сервере AppTracer.
   * Получите токен в dashboard AppTracer после регистрации приложения.
   */
  appToken: string;

  /**
   * Уникальный идентификатор устройства.
   * Рекомендуется использовать стабильный ID (например, из react-native-device-info).
   */
  deviceId: string;

  /**
   * Числовой код версии приложения.
   * Используется для группировки отчётов по версиям.
   * @example 1
   * @example 42
   */
  versionCode: number;

  /**
   * Строковое название версии приложения.
   * Отображается в dashboard AppTracer.
   * @example "1.0.0"
   * @example "2.1.3-beta"
   */
  versionName: string;

  /** Уровень логирования HTTP запросов. @default "error" */
  httpLogLevel?: HttpLogLevel;

  /** Максимальное количество логов (breadcrumbs) в буфере. @default 100 */
  maxLogs?: number;

  /** Максимальный размер файла логов в байтах. @default 65536 (64 KB) */
  maxLogBytes?: number;

  /** Максимальный размер одной строки лога в байтах. @default 2048 */
  maxLineBytes?: number;

  /** Базовый URL сервера AppTracer. @default "https://sdk-api.apptracer.ru" */
  endpointBaseUrl?: string;
};

/**
 * Нормализованная ошибка для отправки на сервер.
 *
 * Создаётся из произвольного значения ошибки (Error, unknown, PromiseRejectionEvent)
 * методом `normalizeUnknownToGlobalError`.
 *
 * @example
 * ```typescript
 * const error: TGlobalError = {
 *   name: "TypeError",
 *   message: "Cannot read property 'x' of undefined",
 *   stack: "TypeError: Cannot read property...\n    at App.js:42",
 *   isFatal: true,
 * };
 * ```
 */
export type TGlobalError = {
  /** Сообщение об ошибке. Обязательное поле. */
  message: string;

  /** Имя ошибки (например, "TypeError", "ReferenceError"). */
  name?: string;

  /** Стек вызова в текстовом формате. */
  stack?: string;

  /**
   * Является ли ошибка фатальной (приводящей к крашу приложения).
   * Фатальные ошибки имеют приоритет при отправке.
   */
  isFatal?: boolean;
};

/**
 * Метаданные отчёта об ошибке.
 *
 * Содержит информацию об устройстве, приложении и сессии.
 * Каждому отчёту присваивается уникальный ID для идентификации на сервере.
 */
export type TUploadBean = {
  /** Уникальный идентификатор отчёта. */
  id: string;

  /**
   * Порядковый номер ошибки в сессии.
   * Увеличивается при каждой ошибке.
   */
  count: number;

  /** Числовой код версии приложения из init(). */
  versionCode: number;

  /** Строковое название версии приложения из init(). */
  versionName: string;

  /**
   * Платформа/вендор ОС.
   * @example "ios"
   * @example "android"
   */
  vendor: string;

  /**
   * Версия операционной системы.
   * @example "17.0"
   * @example "33"
   */
  osVersion: string;

  /** Уникальный идентификатор сессии. Генерируется при каждом init(). */
  sessionId: string;

  /** Идентификатор устройства из init(). */
  deviceId: string;
  environment?: string;
};

/**
 * Отчёт об ошибке для отправки на сервер.
 *
 * Полная структура отчёта, включающая тип ошибки, метаданные,
 * стек вызова и логи (breadcrumbs) в формате Base64.
 *
 * @example
 * ```typescript
 * const report: TErrorReport = {
 *   type: "CRASH",
 *   format: "JS_STACKTRACE",
 *   severity: "CRASH",
 *   uploadBean: {
 *     id: "abc123",
 *     count: 1,
 *     versionCode: 1,
 *     versionName: "1.0.0",
 *     vendor: "ios",
 *     osVersion: "17.0",
 *     sessionId: "session-xyz",
 *     deviceId: "device-456",
 *   },
 *   stackTrace: "Error: ...\n    at App.js:42",
 *   logsFile: "base64-encoded-logs...",
 * };
 * ```
 */
export type TErrorReport = {
  /**
   * Тип ошибки.
   * - "CRASH" - фатальная ошибка, краш приложения
   * - "NON_FATAL" - нефатальная ошибка, приложение продолжает работу
   */
  type: "CRASH" | "NON_FATAL";

  /**
   * Формат представления ошибки.
   * "JS_STACKTRACE" - стек вызова JavaScript.
   */
  format: "JS_STACKTRACE";

  /**
   * Серьёзность ошибки.
   * - "CRASH" - краш приложения
   * - "NON_FATAL" - нефатальная ошибка
   */
  severity: "CRASH" | "NON_FATAL";

  /** Метаданные отчёта (устройство, версия, сессия). */
  uploadBean: TUploadBean;

  /** Стек вызова в текстовом формате. Может отсутствовать для ошибок без стека. */
  stackTrace?: string | undefined;

  /**
   * Логи (breadcrumbs) в формате Base64.
   * Содержит последние логи перед ошибкой.
   */
  logsFile: string;
};

/**
 * Запись лога (breadcrumb).
 *
 * Используется для отслеживания действий пользователя перед ошибкой.
 * Добавляется методом `AppTracer.addLog()`.
 *
 * @example
 * ```typescript
 * const log: TLogRow = {
 *   level: { severity: 1, text: "INFO" },
 *   timestamp: 1699999999999,
 *   msg: "User tapped 'Submit' button",
 * };
 *
 * AppTracer.addLog(log);
 * ```
 */
export type TLogRow = {
  /**
   * Уровень логирования.
   * @property severity - числовой уровень (0=error, 1=warn, 2=info, 3=debug)
   * @property text - текстовое представление уровня (например, "ERROR", "INFO")
   */
  level: { severity: number; text: string };

  /**
   * Время создания лога в миллисекундах (Unix timestamp).
   * Обычно используется `Date.now()`.
   */
  timestamp: number;

  /** Текст сообщения лога. */
  msg: string;
};

/**
 * Запись лога в кольцевом буфере.
 *
 * Расширяет `TLogRow` порядковым номером для упорядочивания.
 * Используется внутри SDK для хранения логов.
 *
 * @internal
 */
export type TLogBufferRow = {
  /**
   * Порядковый номер лога в буфере.
   * Автоматически присваивается при добавлении в буфер.
   */
  logSeq: number;

  /** Уровень логирования. */
  level: { severity: number; text: string };

  /** Время создания лога в миллисекундах. */
  timestamp: number;

  /** Текст сообщения лога. */
  msg: string;
};
