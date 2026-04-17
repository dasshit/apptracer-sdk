export class RingLogBuffer<T extends { logSeq: number }> {
  private buf: (T | undefined)[];
  private head = 0;
  private size = 0;

  private seq = 0;

  constructor(private capacity: number) {
    if (capacity <= 0) throw new Error("capacity must be > 0");
    this.buf = new Array(capacity);
  }

  nextSeq() {
    this.seq += 1;
    return this.seq;
  }

  push(item: T) {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  snapshot(): T[] {
    const out: T[] = [];
    const start = (this.head - this.size + this.capacity) % this.capacity;

    for (let i = 0; i < this.size; i++) {
      const idx = (start + i) % this.capacity;
      const v = this.buf[idx];
      if (v !== undefined) out.push(v);
    }
    return out;
  }

  clear() {
    this.buf = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
  }
}
