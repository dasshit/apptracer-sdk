import { RingLogBuffer } from "../RingLogBuffer";

type Row = { logSeq: number; msg: string };

test("RingLogBuffer keeps last N items", () => {
  const b = new RingLogBuffer<Row>(3);

  b.push({ logSeq: b.nextSeq(), msg: "a" });
  b.push({ logSeq: b.nextSeq(), msg: "b" });
  b.push({ logSeq: b.nextSeq(), msg: "c" });

  expect(b.snapshot().map((x) => x.msg)).toEqual(["a", "b", "c"]);

  b.push({ logSeq: b.nextSeq(), msg: "d" });
  expect(b.snapshot().map((x) => x.msg)).toEqual(["b", "c", "d"]);
});
