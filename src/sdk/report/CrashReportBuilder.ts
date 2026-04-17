import type { TErrorReport, TGlobalError, TUploadBean } from "../types";

/**
 * Строитель отчётов об ошибках.
 *
 * Преобразует нормализованную ошибку (TGlobalError) и логи (breadcrumbs)
 * в структуру отчёта (TErrorReport) для отправки на сервер.
 *
 * Использует функцию-фабрику для получения метаданных устройства и сессии,
 * что позволяет динамически обновлять данные при каждом запросе.
 *
 * @example
 * ```typescript
 * const builder = new CrashReportBuilder(() => ({
 *   id: "report-123",
 *   count: 1,
 *   deviceId: "device-456",
 *   versionCode: 1,
 *   versionName: "1.0.0",
 *   vendor: "ios",
 *   osVersion: "17.0",
 * }));
 *
 * const report = builder.buildReport(
 *   { message: "Error", name: "TypeError", isFatal: true },
 *   "base64-encoded-logs"
 * );
 * ```
 */
export class CrashReportBuilder {
  /**
   * Создаёт экземпляр строителя отчётов.
   *
   * @param getUploadBean - функция-фабрика для получения метаданных отчёта.
   *                        Вызывается при каждом buildReport для получения актуальных данных.
   */
  constructor(private getUploadBean: () => TUploadBean) {}

  /**
   * Строит отчёт об ошибке для отправки на сервер.
   *
   * Определяет тип и серьёзность ошибки на основе флага isFatal:
   * - Fatal ошибки: type="CRASH", severity="CRASH"
   * - Non-fatal ошибки: type="NON_FATAL", severity="NON_FATAL"
   *
   * @param error - нормализованная ошибка
   * @param error.message - сообщение об ошибке (обязательно)
   * @param error.name - имя ошибки (например, "TypeError")
   * @param error.stack - стек вызова
   * @param error.isFatal - является ли ошибка фатальной
   * @param logsFileBase64 - логи (breadcrumbs) в формате Base64
   * @returns структурированный отчёт об ошибке
   *
   * @example
   * ```typescript
   * const report = builder.buildReport(
   *   {
   *     message: "Cannot read property 'x' of undefined",
   *     name: "TypeError",
   *     stack: "TypeError: Cannot read...\n    at App.js:42",
   *     isFatal: true,
   *   },
   *   "IzE3MDAwMDAwMDAwMDAgfCBVc2VyIGxvZ2dlZCBpbg=="
   * );
   *
   * console.log(report.type);     // "CRASH"
   * console.log(report.severity); // "CRASH"
   * ```
   */
  buildReport(error: TGlobalError, logsFileBase64: string): TErrorReport {
    const isFatal = Boolean(error.isFatal);

    return {
      type: isFatal ? "CRASH" : "NON_FATAL",
      format: "JS_STACKTRACE",
      severity: isFatal ? "CRASH" : "NON_FATAL",
      uploadBean: this.getUploadBean(),
      stackTrace: error.stack,
      logsFile: logsFileBase64,
    };
  }
}
