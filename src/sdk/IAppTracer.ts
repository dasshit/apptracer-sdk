import type { HttpLogLevel } from "./transport/FetchTransport";
import type { TAppTracerInitOptions, TLogRow } from "./types";

/**
 * Параметры инициализации AppTracer SDK.
 *
 * Расширяет базовые опции `TAppTracerInitOptions` дополнительными параметрами.
 *
 * @example
 * ```typescript
 * const options: AppTracerInitOptions = {
 *   appToken: "YOUR_APP_TOKEN",
 *   deviceId: "device-123",
 *   versionCode: 1,
 *   versionName: "1.0.0",
 *   maxLogs: 200,
 *   persistNonFatal: true,
 * };
 *
 * AppTracer.init(options);
 * ```
 */
export type AppTracerInitOptions = TAppTracerInitOptions & {
  /** Уровень логирования HTTP запросов. @default "error" */
  httpLogLevel?: HttpLogLevel;

  /** Максимальное количество логов (breadcrumbs) в буфере. @default 100 */
  maxLogs?: number;

  /**
   * Максимальный размер файла логов в байтах.
   * При превышении старые логи обрезаются.
   * @default 65536 (64 KB)
   */
  maxLogBytes?: number;

  /**
   * Максимальный размер одной строки лога в байтах.
   * Строки длиннее этого значения обрезаются.
   * @default 2048 (2 KB)
   */
  maxLineBytes?: number;

  /**
   * Базовый URL сервера AppTracer.
   * Используйте для отправки отчётов на собственный сервер.
   * @default "https://sdk-api.apptracer.ru"
   */
  endpointBaseUrl?: string;

  /**
   * Ключ для хранения pending-отчётов в AsyncStorage.
   * Используйте разные ключи для разных экземпляров SDK.
   * @default "__apptracer_pending_reports__"
   */
  persistKey?: string;

  /**
   * Максимальное количество pending-отчётов в хранилище.
   * При превышении удаляются самые старые отчёты.
   * @default 50
   */
  persistMaxItems?: number;

  /**
   * Сохранять non-fatal ошибки в хранилище при неудачной отправке.
   * При `true` ошибки будут отправлены при следующем запуске приложения.
   * @default false
   */
  persistNonFatal?: boolean;

  /**
   * Идентификатор сессии.
   * Если не указан, генерируется автоматически.
   */
  sessionId?: string;

  /**
   * Название устройства.
   * Используется для идентификации в dashboard.
   */
  deviceName?: string;

  /**
   * Уникальный идентификатор устройства.
   * Рекомендуется использовать стабильный ID (например, из react-native-device-info).
   * @default "UNKNOWN"
   */
  deviceId?: string;
};

/**
 * Публичный интерфейс AppTracer SDK.
 *
 * Предоставляет методы для инициализации, логирования и отправки отчётов об ошибках.
 *
 * @example
 * ```typescript
 * import AppTracer from "@ddastter/apptracer-sdk";
 *
 * // Инициализация
 * AppTracer.init({
 *   appToken: "YOUR_TOKEN",
 *   deviceId: "device-123",
 *   versionCode: 1,
 *   versionName: "1.0.0",
 * });
 *
 * // Добавление логов
 * AppTracer.addLog({
 *   level: { severity: 1, text: "INFO" },
 *   timestamp: Date.now(),
 *   msg: "User logged in",
 * });
 *
 * // Ручная отправка ошибки
 * try {
 *   riskyOperation();
 * } catch (error) {
 *   AppTracer.captureException(error);
 * }
 * ```
 */
export interface IAppTracer {
  /**
   * Инициализирует SDK. Должен быть вызван один раз при старте приложения.
   *
   * После инициализации:
   * - Устанавливаются глобальные обработчики ошибок
   * - Начинается сбор логов (breadcrumbs)
   * - Отправляются накопленные ранее отчёты
   *
   * @param options - параметры конфигурации SDK
   *
   * @example
   * ```typescript
   * AppTracer.init({
   *   appToken: "YOUR_TOKEN",
   *   deviceId: "device-123",
   *   versionCode: 1,
   *   versionName: "1.0.0",
   * });
   * ```
   */
  init(options: AppTracerInitOptions): void;

  /**
   * Отключает SDK и удаляет глобальные обработчики ошибок.
   *
   * После вызова SDK перестанет перехватывать ошибки.
   */
  shutdown(): void;

  /**
   * Добавляет запись лога (breadcrumb) в кольцевой буфер.
   *
   * Логи прикрепляются к отчёту при возникновении ошибки.
   * Количество хранимых логов ограничено параметром `maxLogs`.
   *
   * @param row - объект с данными лога
   * @param row.level - уровень логирования (severity и text)
   * @param row.timestamp - время создания в миллисекундах
   * @param row.msg - текст сообщения
   *
   * @example
   * ```typescript
   * AppTracer.addLog({
   *   level: { severity: 1, text: "INFO" },
   *   timestamp: Date.now(),
   *   msg: "Button clicked",
   * });
   * ```
   */
  addLog(row: TLogRow): void;

  /**
   * Ручная отправка исключения или ошибки.
   *
   * Используйте для отправки ошибок из try/catch блоков
   * или других ситуаций, требующих ручной обработки.
   *
   * @param err - ошибка для отправки (Error, unknown или любой объект)
   * @param isFatal - пометить как фатальную ошибку
   *
   * @example
   * ```typescript
   * try {
   *   await fetchData();
   * } catch (error) {
   *   AppTracer.captureException(error);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Фатальная ошибка
   * AppTracer.captureException(new Error("Critical failure"), true);
   * ```
   */
  captureException(err: unknown, isFatal?: boolean): void;

  /**
   * Отправляет все накопленные отчёты из персистентного хранилища.
   *
   * Автоматически вызывается при инициализации SDK.
   * Может быть вызван вручную для принудительной отправки.
   *
   * @returns Promise, разрешающийся после завершения отправки
   *
   * @example
   * ```typescript
   * // Принудительная отправка накопленных отчётов
   * await AppTracer.drainPending();
   * ```
   */
  drainPending(): Promise<void>;
}
