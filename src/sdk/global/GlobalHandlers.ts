type ReportFn = (error: unknown, isFatal?: boolean) => void;

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
  if (typeof anyGlobal?.addEventListener === "function") {
    const handler = (event: any) => {
      try {
        report(event, false);
      } catch {
        // ignore
      }
    };

    anyGlobal.addEventListener("unhandledrejection", handler);
    uninstalls.push(() => anyGlobal.removeEventListener?.("unhandledrejection", handler));
  }

  return () => {
    for (const u of uninstalls.reverse()) {
      try {
        u();
      } catch {}
    }
  };
}
