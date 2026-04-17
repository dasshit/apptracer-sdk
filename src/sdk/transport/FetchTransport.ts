/**
 * Уровень логирования HTTP запросов.
 *
 * Определяет детальность логирования в консоль:
 * - "none" - логирование отключено
 * - "error" - только ошибки
 * - "info" - запросы, ответы и ошибки
 * - "debug" - полная информация включая body
 */
export type HttpLogLevel = "none" | "error" | "info" | "debug";

/**
 * Опции для выполнения POST запроса.
 */
type PostJsonOptions = {
  /** Query параметры для добавления в URL. */
  query?: Record<string, string>;

  /** Дополнительные HTTP заголовки. */
  headers?: Record<string, string>;

  /** Таймаут запроса в миллисекундах. Переопределяет значение из конфига. */
  timeoutMs?: number;

  /**
   * Логировать body запроса.
   * Работает только при logLevel="debug".
   * @default false
   */
  logBody?: boolean;

  /**
   * Логировать body ответа.
   * Работает только при logLevel="debug".
   * @default false
   */
  logResponseBody?: boolean;
};

/**
 * HTTP транспорт для отправки JSON запросов.
 *
 * Обеспечивает:
 * - Таймауты запросов через AbortController
 * - Логирование на разных уровнях детализации
 * - Скрытие секретных данных в логах (redaction)
 * - Формирование URL с query параметрами
 *
 * @example
 * ```typescript
 * const transport = new FetchTransport({
 *   baseUrl: "https://api.example.com",
 *   timeoutMs: 15000,
 *   logLevel: "error",
 *   redactKeys: ["authorization", "token"],
 * });
 *
 * const response = await transport.postJson(
 *   "/api/events",
 *   { event: "click", target: "button" },
 *   { query: { version: "1.0" } }
 * );
 * ```
 */
export class FetchTransport {
  private requestSeq = 0;

  /**
   * Создаёт экземпляр HTTP транспорта.
   *
   * @param cfg - конфигурация транспорта
   * @param cfg.baseUrl - базовый URL для всех запросов
   * @param cfg.timeoutMs - таймаут запроса по умолчанию в миллисекундах
   * @param cfg.logLevel - уровень логирования HTTP запросов
   * @param cfg.redactKeys - ключи, значения которых нужно скрывать в логах
   */
  constructor(
    private cfg: {
      baseUrl: string;
      timeoutMs: number;
      logLevel: HttpLogLevel;
      redactKeys?: string[];
    },
  ) {}

  /**
   * Выполняет POST запрос с JSON body.
   *
   * Автоматически:
   * - Устанавливает Content-Type и Accept заголовки
   * - Добавляет таймаут через AbortController
   * - Логирует запрос/ответ согласно logLevel
   * - Скрывает секретные данные из логов
   *
   * @param path - путь относительно baseUrl (например, "/api/events")
   * @param body - данные для отправки (будут сериализованы в JSON)
   * @param opts - опциональные параметры запроса
   * @returns Promise с объектом Response
   * @throws Error при таймауте, сетевой ошибке или HTTP статусе >= 400
   *
   * @example
   * ```typescript
   * // Простой запрос
   * const response = await transport.postJson("/api/crash", crashReport);
   *
   * // С query параметрами
   * const response = await transport.postJson(
   *   "/api/events",
   *   eventData,
   *   { query: { appToken: "abc123" } }
   * );
   *
   * // С кастомным таймаутом
   * const response = await transport.postJson(
   *   "/api/upload",
   *   largeData,
   *   { timeoutMs: 60000 }
   * );
   * ```
   */
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

      const needBody = !res.ok || (this.shouldLog("debug") && Boolean(opts?.logResponseBody));

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

  /**
   * Строит полный URL из baseUrl, path и query параметров.
   * @internal
   */
  private buildUrl(path: string, query?: Record<string, string>) {
    const url = new URL(path, this.cfg.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    }
    return url.toString();
  }

  /**
   * Проверяет, нужно ли логировать на указанном уровне.
   *
   * Сравнивает текущий уровень логирования с запрошенным.
   * @internal
   */
  private shouldLog(level: Exclude<HttpLogLevel, "none">) {
    const order: Record<HttpLogLevel, number> = {
      none: 0,
      error: 1,
      info: 2,
      debug: 3,
    };
    return order[this.cfg.logLevel] >= order[level];
  }

  /**
   * Скрывает значения секретных ключей в объекте.
   *
   * Рекурсивно обходит объекты и массивы, заменяя значения
   * для ключей из redactKeys на "***".
   *
   * Сравнение ключей нечувствительно к регистру.
   *
   * @internal
   *
   * @example
   * ```typescript
   * // При redactKeys = ["token", "authorization"]
   * this.redact({ token: "secret123", name: "app" });
   * // Результат: { token: "***", name: "app" }
   * ```
   */
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