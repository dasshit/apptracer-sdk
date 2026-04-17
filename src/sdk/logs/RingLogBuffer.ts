/**
 * Кольцевой буфер для хранения логов.
 *
 * Эффективная структура данных с фиксированным размером, которая автоматически
 * перезаписывает старые элементы при добавлении новых после заполнения.
 *
 * Особенности:
 * - O(1) для операций push и snapshot
 * - Автоматическая перезапись старых элементов (FIFO)
 * - Сохранение порядка элементов по logSeq
 * - Типобезопасность через generic с ограничением
 *
 * @typeParam T - тип элемента буфера, должен содержать поле `logSeq`
 *
 * @example
 * ```typescript
 * const buffer = new RingLogBuffer<{ logSeq: number; msg: string }>(3);
 *
 * buffer.push({ logSeq: 1, msg: "first" });
 * buffer.push({ logSeq: 2, msg: "second" });
 * buffer.push({ logSeq: 3, msg: "third" });
 * buffer.push({ logSeq: 4, msg: "fourth" }); // перезапишет первый элемент
 *
 * buffer.snapshot();
 * // Результат: [
 * //   { logSeq: 2, msg: "second" },
 * //   { logSeq: 3, msg: "third" },
 * //   { logSeq: 4, msg: "fourth" }
 * // ]
 * ```
 */
export class RingLogBuffer<T extends { logSeq: number }> {
  private buf: (T | undefined)[];
  private head = 0;
  private size = 0;

  private seq = 0;

  /**
   * Создаёт экземпляр кольцевого буфера.
   *
   * @param capacity - максимальное количество элементов в буфере
   * @throws Error если capacity <= 0
   *
   * @example
   * ```typescript
   * const buffer = new RingLogBuffer<TLogBufferRow>(100);
   * ```
   */
  constructor(private capacity: number) {
    if (capacity <= 0) throw new Error("capacity must be > 0");
    this.buf = new Array(capacity);
  }

  /**
   * Возвращает следующий порядковый номер и увеличивает счётчик.
   *
   * Используется для присвоения `logSeq` при добавлении лога в буфер.
   * Номера возрастают монотонно и не сбрасываются при clear().
   *
   * @returns следующий порядковый номер
   *
   * @example
   * ```typescript
   * const seq = buffer.nextSeq(); // 1
   * buffer.push({ logSeq: seq, msg: "first", ... });
   *
   * const seq2 = buffer.nextSeq(); // 2
   * buffer.push({ logSeq: seq2, msg: "second", ... });
   * ```
   */
  nextSeq() {
    this.seq += 1;
    return this.seq;
  }

  /**
   * Добавляет элемент в буфер.
   *
   * Если буфер заполнен, перезаписывает самый старый элемент.
   * Операция выполняется за O(1).
   *
   * @param item - элемент для добавления (должен содержать logSeq)
   *
   * @example
   * ```typescript
   * buffer.push({
   *   logSeq: buffer.nextSeq(),
   *   level: { severity: 1, text: "INFO" },
   *   timestamp: Date.now(),
   *   msg: "User clicked button",
   * });
   * ```
   */
  push(item: T) {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  /**
   * Возвращает массив всех элементов буфера в порядке добавления.
   *
   * Временная сложность: O(n), где n - текущее количество элементов.
   * Не изменяет состояние буфера.
   *
   * @returns массив элементов в порядке добавления (от старых к новым)
   *
   * @example
   * ```typescript
   * const logs = buffer.snapshot();
   * console.log(`Buffer contains ${logs.length} items`);
   *
   * // Использование для сериализации
   * const base64 = serializer.serializeToBase64(logs);
   * ```
   */
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

  /**
   * Очищает буфер, удаляя все элементы.
   *
   * Сбрасывает head и size, но сохраняет seq (порядковые номера продолжаются).
   * Операция выполняется за O(1).
   *
   * @example
   * ```typescript
   * buffer.clear();
   * console.log(buffer.snapshot().length); // 0
   *
   * // seq продолжается
   * buffer.nextSeq(); // Вернёт следующий номер, а не 1
   * ```
   */
  clear() {
    this.buf = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
  }
}
