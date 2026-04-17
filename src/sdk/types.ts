import type {HttpLogLevel} from "./transport/FetchTransport";

export type TAppTracerInitOptions = {
    appToken: string;
    deviceId: string;
    versionCode: number;
    versionName: string;
    httpLogLevel?: HttpLogLevel;
    maxLogs?: number; // default 100
    maxLogBytes?: number; // default 64kb
    maxLineBytes?: number; // default 2048
    endpointBaseUrl?: string; // default https://sdk-api.apptracer.ru
}

export type TGlobalError = {
  message: string;
  name?: string;
  stack?: string;
  isFatal?: boolean;
};

export type TUploadBean = {
    id: string;
    count: number;
    versionCode: number;
    versionName: string;
    vendor: string;
    osVersion: string;
    sessionId: string;
    deviceId: string;
}

export type TErrorReport = {
    type: "CRASH" | "NON_FATAL";
    format: "JS_STACKTRACE";
    severity: "CRASH" | "NON_FATAL";
    uploadBean: TUploadBean;
    stackTrace?: string | undefined;
    logsFile: string;
}

export type TLogRow = {
    level: { severity: number, text: string };
    timestamp: number;
    msg: string;
};

export type TLogBufferRow = {
    logSeq: number;
    level: { severity: number, text: string };
    timestamp: number;
    msg: string;
}
