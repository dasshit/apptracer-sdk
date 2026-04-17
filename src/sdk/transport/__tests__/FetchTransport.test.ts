/// <reference types="jest" />
/// <reference types="node" />
import { FetchTransport } from "../FetchTransport";

beforeEach(() => {
  global.fetch = jest.fn(async () => {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as any;
});

test("postJson builds url with query", async () => {
  const t = new FetchTransport({
    baseUrl: "https://example.com",
    timeoutMs: 1000,
    logLevel: "none",
  });

  await t.postJson("/api/test", { a: 1 }, { query: { x: "y" } } as any);

  const [url, init] = (global.fetch as any).mock.calls[0];
  expect(url).toBe("https://example.com/api/test?x=y");
  expect(init.method).toBe("POST");
});
