/**
 * Структура строки лога для сериализации.
 *
 * Минимальный набор полей, необходимых для сериализации в байты.
 * Совместим с `TLogBufferRow`.
 */
type LogRowLike = {
  /** Порядковый номер лога. */
  logSeq: number;

  /** Время создания лога в миллисекундах. */
  timestamp: number;

  /** Текст сообщения лога. */
  msg: string;
};

/**
 * Сериализатор логов в формат Base64.
 *
 * Преобразует массив логов в бинарный формат и кодирует в Base64
 * для отправки на сервер. Поддерживает ограничение размера файла
 * и отдельных строк.
 *
 * Формат строки лога:
 * ```
 * #{seqNum} {timestamp} | {message}\n
 * ```
 *
 * Особенности:
 * - Автоматическая обрезка длинных строк с сохранением валидности UTF-8
 * - Ограничение общего размера файла (обрезаются старые логи)
 * - Эффективная кодировка Base64 с чанками по 32KB
 *
 * @example
 * ```typescript
 * const serializer = new LogSerializer({
 *   maxTotalBytes: 64 * 1024,  // 64 KB
 *   maxLineBytes: 2048,        // 2 KB на строку
 * });
 *
 * const logs = [
 *   { logSeq: 1, timestamp: 1700000000000, msg: "App started" },
 *   { logSeq: 2, timestamp: 1700000000100, msg: "User logged in" },
 * ];
 *
 * const base64 = serializer.serializeToBase64(logs);
 * ```
 */
export class LogSerializer {
  private encoder = new TextEncoder();
  private decoder = new TextDecoder("utf-8", { fatal: false });

  /**
   * Создаёт экземпляр сериализатора.
   *
   * @param opts - параметры сериализации
   * @param opts.maxTotalBytes - максимальный размер файла логов в байтах
   * @param opts.maxLineBytes - максимальный размер одной строки в байтах
   * @param opts.maxHeaderBytes - зарезервированное место для заголовка строки
   *                              (#{seqNum} {timestamp} |), @default 64
   */
  constructor(
    private opts: {
      maxTotalBytes: number;
      maxLineBytes: number;
      maxHeaderBytes?: number;
    },
  ) {}

  /**
   * Сериализует массив логов в Base64 строку.
   *
   * Удобный метод, объединяющий `serializeToBytes` и `uint8ToBase64`.
   * Используется для формирования `logsFile` в отчёте об ошибке.
   *
   * @param rows - массив логов для сериализации
   * @returns Base64-закодированная строка с логами
   *
   * @example
   * ```typescript
   * const base64 = serializer.serializeToBase64(logBuffer.snapshot());
   * // Результат: "IzEgMTcwMDAwMDAwMDAwIHwgQXBwIHN0YXJ0ZWQK..."
   * ```
   */
  serializeToBase64(rows: LogRowLike[]): string {
    const bytes = this.serializeToBytes(rows);
    return this.uint8ToBase64(bytes);
  }

  /**
   * Сериализует массив логов в байты.
   *
   * Формат каждой строки: `#{seqNum} {timestamp} | {message}\n`
   *
   * При превышении `maxTotalBytes` останавливает добавление строк
   * (старые строки сохраняются, новые отбрасываются).
   *
   * @param rows - массив логов для сериализации
   * @returns Uint8Array с сериализованными логами в UTF-8
   *
   * @example
   * ```typescript
   * const bytes = serializer.serializeToBytes([
   *   { logSeq: 1, timestamp: 1700000000000, msg: "Hello" },
   * ]);
   * // bytes = Uint8Array с содержимым "#1 1700000000000 | Hello\n"
   * ```
   */
  serializeToBytes(rows: LogRowLike[]): Uint8Array {
    const maxHeaderBytes = this.opts.maxHeaderBytes ?? 64;

    // Собираем чанки, но прекращаем, если превысили maxTotalBytes
    const parts: Uint8Array[] = [];
    let total = 0;

    for (const r of rows) {
      const line = this.newLogLine(
        r.logSeq,
        r.timestamp,
        r.msg,
        this.opts.maxLineBytes,
        maxHeaderBytes,
      );

      if (line.length === 0) continue;

      if (total + line.length > this.opts.maxTotalBytes) {
        // можно добавить "truncated" строку, но без лишних зависимостей оставим как есть
        break;
      }

      parts.push(line);
      total += line.length;
    }

    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }

  /**
   * Создаёт одну строку лога в байтовом формате.
   *
   * Формат: `#{seqNum} {timestamp} | {message}\n`
   *
   * При превышении лимита обрезает сообщение, сохраняя валидность UTF-8
   * (декодирует обрезанные байты и кодирует заново).
   *
   * @internal
   */
  private newLogLine(
    seqNum: number,
    tsMs: number,
    message: string,
    limit?: number | null,
    maxHeaderBytes = 64,
  ): Uint8Array {
    let msgBytes = this.encoder.encode(message);

    if (limit != null) {
      const lim = limit - maxHeaderBytes;

      if (lim <= 0) {
        msgBytes = new Uint8Array(0);
      } else if (msgBytes.length > lim) {
        const sliced = msgBytes.subarray(0, lim);
        const cleanedStr = this.decoder.decode(sliced); // аналог errors="ignore"
        msgBytes = this.encoder.encode(cleanedStr);
      }
    }

    const prefix = this.encoder.encode(`#${seqNum} ${tsMs} | `);
    const suffix = this.encoder.encode(`\n`);

    const out = new Uint8Array(prefix.length + msgBytes.length + suffix.length);
    out.set(prefix, 0);
    out.set(msgBytes, prefix.length);
    out.set(suffix, prefix.length + msgBytes.length);

    return out;
  }

  /**
   * Кодирует Uint8Array в Base64 строку.
   *
   * Использует чанковую обработку для эффективности с большими данными.
   * Размер чанка: 32KB (0x8000).
   *
   * @internal
   */
  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }
}