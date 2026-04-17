import {
  getUnhandledPromiseRejectionTracker,
  setUnhandledPromiseRejectionTracker,
} from "react-native-promise-rejection-utils";

/**
 * Функция для отправки отчёта об ошибке.
 *
 * Вызывается при перехвате глобальной ошибки или unhandled rejection.
 *
 * @param error - перехваченная ошибка (Error, PromiseRejectionEvent или unknown)
 * @param isFatal - является ли ошибка фатальной (приводит к крашу приложения)
 */
type ReportFn = (error: unknown, isFatal?: boolean) => void;

/**
 * Устанавливает глобальные обработчики ошибок.
 *
 * Перехватывает:
 * - JavaScript ошибки через React Native ErrorUtils
 * - Unhandled Promise Rejections через DOM API
 *
 * Все перехваченные ошибки передаются в функцию `report` для обработки.
 * Оригинальные обработчики сохраняются и вызываются после отчёта.
 *
 * @param report - функция для отправки отчёта об ошибке
 * @returns Функция для удаления всех установленных обработчиков
 *
 * @example
 * ```typescript
 * const uninstall = installGlobalHandlers((error, isFatal) => {
 *   console.log("Caught error:", error);
 *   console.log("Is fatal:", isFatal);
 * });
 *
 * // Позже, при завершении работы
 * uninstall();
 * ```
 *
 * @example
 * ```typescript
 * // Интеграция с AppTracer
 * const uninstall = installGlobalHandlers((error, isFatal) => {
 *   const normalized = normalizeError(error, isFatal);
 *   captureGlobalError(normalized);
 * });
 *
 * AppTracer.shutdown = () => {
 *   uninstall();
 * };
 * ```
 */
export function installGlobalHandlers(report: ReportFn): () => void {
  const anyGlobal = globalThis as any;

  const uninstalls: Array<() => void> = [];

  // JS fatal/non-fatal via ErrorUtils
  const ErrorUtils = anyGlobal.ErrorUtils;
  if (ErrorUtils?.getGlobalHandler && ErrorUtils?.setGlobalHandler) {
    const defaultHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      try {
        report(error, isFatal);
      } catch {
        // ignore
      } finally {
        defaultHandler?.(error, isFatal);
      }
    });

    uninstalls.push(() => {
      // вернуть дефолтный обработчик
      ErrorUtils.setGlobalHandler(defaultHandler);
    });
  }

  // unhandled promise rejections

  const prevTracker = getUnhandledPromiseRejectionTracker();

  setUnhandledPromiseRejectionTracker((id, error) => {
    try {
      report(error);
    } finally {
      if (prevTracker !== undefined) {
        prevTracker(id, error);
      }
    }
  });

  /**
   * Удаляет все установленные обработчики и восстанавливает оригинальные.
   *
   * Вызывается при shutdown SDK или при необходимости временно отключить
   * перехват ошибок.
   *
   * @internal
   */
  return () => {
    for (const u of uninstalls.reverse()) {
      try {
        u();
      } catch (e) {
        console.log("Uninstall AppTracer global handler", { error: e });
      }
    }
  };
}
