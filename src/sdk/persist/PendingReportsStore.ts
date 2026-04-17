import AsyncStorage from "@react-native-async-storage/async-storage";

export type PendingReport = {
  id: string; // уникальный id
  createdAt: number; // ms
  payload: unknown; // то, что отправляем на сервер (например TErrorReport[])
};

export class PendingReportsStore {
  constructor(
    private cfg: {
      storageKey: string;
      maxItems: number;
    },
  ) {}

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

  private async saveAll(items: PendingReport[]) {
    await AsyncStorage.setItem(this.cfg.storageKey, JSON.stringify(items));
  }

  async enqueue(item: PendingReport) {
    const items = await this.loadAll();
    items.push(item);

    // ограничим размер очереди
    const trimmed =
      items.length > this.cfg.maxItems ? items.slice(items.length - this.cfg.maxItems) : items;

    await this.saveAll(trimmed);
  }

  async removeByIds(ids: string[]) {
    if (ids.length === 0) return;
    const items = await this.loadAll();
    const idSet = new Set(ids);
    const filtered = items.filter((x) => !idSet.has(x.id));
    await this.saveAll(filtered);
  }

  async clear() {
    await AsyncStorage.removeItem(this.cfg.storageKey);
  }
}
