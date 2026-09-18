import { describe, expect, it } from "vitest";

import { OssCrc64 } from "./crc64.js";

describe("oSS CRC64", () => {
  it("matches the CRC-64/ECMA-182 reference vector used by OSS", () => {
    const crc = new OssCrc64();
    crc.update(Buffer.from("123456789"));

    expect(crc.digestHex()).toBe("995dc9bbdf1939fa");
    expect(crc.digestDecimal()).toBe("11051210869376104954");
  });

  it("produces the same digest across chunk boundaries", () => {
    const oneShot = new OssCrc64().update(Buffer.from("Project Wing"));
    const chunked = new OssCrc64()
      .update(Buffer.from("Pro"))
      .update(Buffer.from("ject Wing"));

    expect(chunked.digestHex()).toBe(oneShot.digestHex());
  });
});
