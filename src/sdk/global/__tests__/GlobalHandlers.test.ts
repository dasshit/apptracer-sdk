import { installGlobalHandlers } from "../GlobalHandlers";

test("installGlobalHandlers calls report and default handler", () => {
  const calls: any[] = [];
  const defaultHandler = jest.fn();

  (globalThis as any).ErrorUtils = {
    getGlobalHandler: () => defaultHandler,
    setGlobalHandler: (h: any) => ((globalThis as any).__handler = h),
  };

  const uninstall = installGlobalHandlers((e, fatal) => calls.push({ e, fatal }));

  (globalThis as any).__handler(new Error("boom"), true);

  expect(calls).toHaveLength(1);
  expect(calls[0].fatal).toBe(true);
  expect(defaultHandler).toHaveBeenCalled();

  uninstall();
});
