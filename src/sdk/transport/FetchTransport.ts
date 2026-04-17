export type HttpLogLevel = "none" | "error" | "info" | "debug";

type PostJsonOptions = {
  query?: Record<string, string>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  logBody?: boolean;
  logResponseBody?: boolean;
};

export class FetchTransport {
  private requestSeq = 0;

  constructor(
    private cfg: {
      baseUrl: string;
      timeoutMs: number;
      logLevel: HttpLogLevel;
      redactKeys?: string[];
    }
  ) {}

  async postJson(path: string, body: unknown, opts?: PostJsonOptions): Promise<Response> {
    const requestId = `${Date.now()}-${++this.requestSeq}`;
    const url = this.buildUrl(path, opts?.query);

    const timeoutMs = opts?.timeoutMs ?? this.cfg.timeoutMs;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opts?.headers ?? {}),
    };

    const startedAt = Date.now();

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (this.shouldLog("info")) {
        const meta: any = {
          requestId,
          method: "POST",
          url,
          timeoutMs,
          headers: this.redact(headers),
          query: this.redact(opts?.query),
        };
        if (this.shouldLog("debug") && opts?.logBody) meta.body = this.redact(body);
        console.log("HTTP →", meta);
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const elapsedMs = Date.now() - startedAt;

      const needBody =
        !res.ok || (this.shouldLog("debug") && Boolean(opts?.logResponseBody));

      let responseText: string | undefined;
      if (needBody) responseText = await res.text().catch(() => undefined);

      if (res.ok) {
        if (this.shouldLog("info")) {
          const meta: any = { requestId, url, status: res.status, elapsedMs };
          if (this.shouldLog("debug") && opts?.logResponseBody) meta.responseText = responseText;
          console.log("HTTP ←", meta);
        }
        return res;
      }

      if (this.shouldLog("error")) {
        console.log("HTTP ✕", {
          requestId,
          url,
          status: res.status,
          elapsedMs,
          responseText,
        });
      }

      throw new Error(`HTTP ${res.status} ${res.statusText}: ${responseText ?? ""}`.trim());
    } catch (e: any) {
      const elapsedMs = Date.now() - startedAt;

      if (this.shouldLog("error")) {
        console.log("HTTP ✕", {
          requestId,
          url,
          elapsedMs,
          errorName: e?.name,
          errorMessage: String(e?.message ?? e),
        });
      }
      throw e;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private buildUrl(path: string, query?: Record<string, string>) {
    const url = new URL(path, this.cfg.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    }
    return url.toString();
  }

  private shouldLog(level: Exclude<HttpLogLevel, "none">) {
    const order: Record<HttpLogLevel, number> = {
      none: 0,
      error: 1,
      info: 2,
      debug: 3,
    };
    return order[this.cfg.logLevel] >= order[level];
  }

  private redact(value: any): any {
    const keys = this.cfg.redactKeys ?? [];
    if (!value || keys.length === 0) return value;

    if (Array.isArray(value)) return value.map((v) => this.redact(v));

    if (typeof value === "object") {
      const out: any = {};
      for (const [k, v] of Object.entries(value)) {
        if (keys.some((rk) => rk.toLowerCase() === k.toLowerCase())) {
          out[k] = "***";
        } else {
          out[k] = this.redact(v);
        }
      }
      return out;
    }

    return value;
  }
}
