import AsyncStorage from "@react-native-async-storage/async-storage";
import { PendingReportsStore } from "../PendingReportsStore";

test("PendingReportsStore enqueue/load/remove", async () => {
  const store = new PendingReportsStore({
    storageKey: "__test_pending__",
    maxItems: 3,
  });

  await store.clear();

  await store.enqueue({ id: "1", createdAt: 1, payload: { a: 1 } });
  await store.enqueue({ id: "2", createdAt: 2, payload: { a: 2 } });

  const all = await store.loadAll();
  expect(all.map((x) => x.id)).toEqual(["1", "2"]);

  await store.removeByIds(["1"]);
  const left = await store.loadAll();
  expect(left.map((x) => x.id)).toEqual(["2"]);

  // проверим, что AsyncStorage реально дергался
  expect(AsyncStorage.setItem).toHaveBeenCalled();
});
