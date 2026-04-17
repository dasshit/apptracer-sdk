type LogRowLike = { logSeq: number; timestamp: number; msg: string };

export class LogSerializer {
  private encoder = new TextEncoder();
  private decoder = new TextDecoder("utf-8", { fatal: false });

  constructor(
    private opts: {
      maxTotalBytes: number; // общий лимит файла логов
      maxLineBytes: number; // лимит одной строки (в байтах)
      maxHeaderBytes?: number; // default 64
    }
  ) {}

  serializeToBase64(rows: LogRowLike[]): string {
    const bytes = this.serializeToBytes(rows);
    return this.uint8ToBase64(bytes);
  }

  serializeToBytes(rows: LogRowLike[]): Uint8Array {
    const maxHeaderBytes = this.opts.maxHeaderBytes ?? 64;

    // Собираем чанки, но прекращаем, если превысили maxTotalBytes
    const parts: Uint8Array[] = [];
    let total = 0;

    for (const r of rows) {
      const line = this.newLogLine(r.logSeq, r.timestamp, r.msg, this.opts.maxLineBytes, maxHeaderBytes);

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

  private newLogLine(
    seqNum: number,
    tsMs: number,
    message: string,
    limit?: number | null,
    maxHeaderBytes = 64
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
