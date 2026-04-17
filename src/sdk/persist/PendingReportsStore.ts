import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Отчёт, ожидающий отправки на сервер.
 *
 * Хранится в AsyncStorage и отправляется при следующем запуске приложения
 * или при вызове `drainPending()`.
 *
 * @example
 * ```typescript
 * const report: PendingReport = {
 *   id: "1700000000000-abc123",
 *   createdAt: 1700000000000,
 *   payload: [{ type: "CRASH", ... }],
 * };
 * ```
 */
export type PendingReport = {
  /** Уникальный идентификатор отчёта. Генерируется методом `newId()` в AppTracer. */
  id: string;

  /** Время создания отчёта в миллисекундах (Unix timestamp). */
  createdAt: number;

  /**
   * Данные для отправки на сервер.
   * Обычно это массив `TErrorReport[]`.
   */
  payload: unknown;
};

/**
 * Хранилище отчётов, ожидающих отправки.
 *
 * Использует AsyncStorage для персистентного хранения отчётов об ошибках,
 * которые не удалось отправить (например, из-за отсутствия сети).
 *
 * Особенности:
 * - Ограничение максимального количества отчётов (FIFO при превышении)
 * - Атомарные операции чтения/записи
 * - Удаление по списку ID
 *
 * @example
 * ```typescript
 * const store = new PendingReportsStore({
 *   storageKey: "__apptracer_pending_reports__",
 *   maxItems: 50,
 * });
 *
 * // Добавить отчёт
 * await store.enqueue({
 *   id: "report-123",
 *   createdAt: Date.now(),
 *   payload: crashReport,
 * });
 *
 * // Получить все отчёты
 * const reports = await store.loadAll();
 *
 * // Удалить отправленные
 * await store.removeByIds(["report-123"]);
 * ```
 */
export class PendingReportsStore {
  /**
   * Создаёт экземпляр хранилища.
   *
   * @param cfg - конфигурация хранилища
   * @param cfg.storageKey - ключ для хранения в AsyncStorage
   * @param cfg.maxItems - максимальное количество отчётов в очереди
   */
  constructor(
    private cfg: {
      storageKey: string;
      maxItems: number;
    },
  ) {}

  /**
   * Загружает все отчёты из хранилища.
   *
   * При ошибке парсинга JSON или неверном формате возвращает пустой массив.
   *
   * @returns Promise с массивом отчётов (пустой массив если данных нет)
   *
   * @example
   * ```typescript
   * const reports = await store.loadAll();
   * console.log(`Found ${reports.length} pending reports`);
   * ```
   */
  async loadAll(): Promise<PendingReport[]> {
    const raw = await AsyncStorage.getItem(this.cfg.storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as PendingReport[];
    } catch {
      return [];
    }
  }

  /**
   * Сохраняет все отчёты в хранилище.
   *
   * Полностью перезаписывает данные по ключу storageKey.
   * @internal
   */
  private async saveAll(items: PendingReport[]) {
    await AsyncStorage.setItem(this.cfg.storageKey, JSON.stringify(items));
  }

  /**
   * Добавляет отчёт в очередь.
   *
   * Если количество отчётов превышает `maxItems`, удаляются самые старые
   * (первые в очереди, стратегия FIFO).
   *
   * @param item - отчёт для добавления
   *
   * @example
   * ```typescript
   * await store.enqueue({
   *   id: "1700000000000-abc",
   *   createdAt: 1700000000000,
   *   payload: crashReport,
   * });
   * ```
   */
  async enqueue(item: PendingReport) {
    const items = await this.loadAll();
    items.push(item);

    // ограничим размер очереди
    const trimmed =
      items.length > this.cfg.maxItems ? items.slice(items.length - this.cfg.maxItems) : items;

    await this.saveAll(trimmed);
  }

  /**
   * Удаляет отчёты по списку идентификаторов.
   *
   * Обычно используется после успешной отправки отчётов на сервер.
   * Если массив ID пуст, операция игнорируется.
   *
   * @param ids - массив идентификаторов для удаления
   *
   * @example
   * ```typescript
   * // После успешной отправки
   * await store.removeByIds(["report-1", "report-2", "report-3"]);
   * ```
   */
  async removeByIds(ids: string[]) {
    if (ids.length === 0) return;
    const items = await this.loadAll();
    const idSet = new Set(ids);
    const filtered = items.filter((x) => !idSet.has(x.id));
    await this.saveAll(filtered);
  }

  /**
   * Полностью очищает хранилище.
   *
   * Удаляет все отчёты из AsyncStorage по ключу storageKey.
   *
   * @example
   * ```typescript
   * // Очистить все pending отчёты
   * await store.clear();
   * ```
   */
  async clear() {
    await AsyncStorage.removeItem(this.cfg.storageKey);
  }
}