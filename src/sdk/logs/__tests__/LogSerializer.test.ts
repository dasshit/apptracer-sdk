import { LogSerializer } from "../LogSerializer";

function base64ToString(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

test("serializeToBase64 produces expected line", () => {
  const s = new LogSerializer({ maxTotalBytes: 1024, maxLineBytes: 1024 });

  const b64 = s.serializeToBase64([{ logSeq: 1, timestamp: 123, msg: "hello" }]);
  expect(base64ToString(b64)).toBe("#1 123 | hello\n");
});

test("serializeToBytes respects maxTotalBytes", () => {
  const s = new LogSerializer({ maxTotalBytes: 20, maxLineBytes: 1024 });

  const bytes = s.serializeToBytes([
    { logSeq: 1, timestamp: 1, msg: "12345678901234567890" },
    { logSeq: 2, timestamp: 2, msg: "should not fit" },
  ]);

  expect(bytes.length).toBeLessThanOrEqual(20);
});
