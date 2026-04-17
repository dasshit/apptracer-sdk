import type { transportFunctionType } from "react-native-logs";
import { AppTracer } from "../sdk/AppTracer";

/**
 * Опции для транспорта AppTracer в react-native-logs.
 *
 * Используются для настройки поведения транспорта при логировании.
 */
export type AppTracerTransportOptions = {
  /**
   * Уровень ошибок.
   * Логи с этим уровнем и выше могут обрабатываться особым образом.
   */
  errorLevel?: string;
};

/**
 * Создаёт транспорт для интеграции AppTracer с react-native-logs.
 *
 * Позволяет автоматически отправлять логи из react-native-logs
 * в AppTracer как breadcrumbs (хлебные крошки).
 *
 * @param appTracer - экземпляр AppTracer или объект с методом `addLog`
 * @returns Функция транспорта для использования в конфигурации react-native-logs
 *
 * @example
 * ```typescript
 * import { logger } from "react-native-logs";
 * import { createAppTracerTransport } from "@ddastter/apptracer-sdk/react-native-logs";
 * import AppTracer from "@ddastter/apptracer-sdk";
 *
 * // Инициализация AppTracer
 * AppTracer.init({
 *   appToken: "YOUR_TOKEN",
 *   deviceId: "device-123",
 *   versionCode: 1,
 *   versionName: "1.0.0",
 * });
 *
 * // Создание логгера с транспортом AppTracer
 * const log = logger.createLogger({
 *   transport: createAppTracerTransport(AppTracer),
 *   transportOptions: {
 *     errorLevel: "error",
 *   },
 * });
 *
 * // Теперь все логи автоматически попадают в AppTracer
 * log.info("User logged in");
 * log.error("Failed to fetch data", new Error("Network error"));
 * ```
 *
 * @example
 * ```typescript
 * // Использование с несколькими транспортами
 * import { logger, consoleTransport } from "react-native-logs";
 * import { createAppTracerTransport } from "@ddastter/apptracer-sdk/react-native-logs";
 *
 * const log = logger.createLogger({
 *   transport: [consoleTransport, createAppTracerTransport(AppTracer)],
 * });
 *
 * log.debug("Debug message"); // Вывод в консоль + AppTracer
 * ```
 */
export function createAppTracerTransport(appTracer: Pick<typeof AppTracer, "addLog">) {
  /**
   * Транспорт для react-native-logs.
   *
   * Преобразует логи из react-native-logs в формат AppTracer
   * и добавляет их в буфер через `addLog`.
   *
   * Формат лога AppTracer:
   * - `level` - уровень логирования (severity и text)
   * - `timestamp` - время создания (Date.now())
   * - `msg` - текст сообщения
   */
  const transport: transportFunctionType<AppTracerTransportOptions> = (props) => {
    const { msg, level } = props;
    appTracer.addLog({ level, timestamp: Date.now(), msg });
  };

  return transport;
}