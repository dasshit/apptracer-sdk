import type { TErrorReport, TGlobalError } from "../types";

type UploadBean = {
  id: string;
  count: number;
  deviceId: string;
  versionCode: number;
  versionName: string;
  vendor: string;
  osVersion: string;
};

export class CrashReportBuilder {
  constructor(private getUploadBean: () => UploadBean) {}

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
