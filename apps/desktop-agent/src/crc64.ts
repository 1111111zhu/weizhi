import { createReadStream } from "node:fs";

const POLYNOMIAL_HIGH = 0xc9_6c_57_95;
const POLYNOMIAL_LOW = 0xd7_87_0f_42;
const TABLE_HIGH = Array.from({ length: 8 }, () => new Uint32Array(256));
const TABLE_LOW = Array.from({ length: 8 }, () => new Uint32Array(256));

for (let index = 0; index < 256; index += 1) {
  let high = 0;
  let low = index;
  for (let bit = 0; bit < 8; bit += 1) {
    const lowBit = low & 1;
    low = ((low >>> 1) | (high << 31)) >>> 0;
    high >>>= 1;
    if (lowBit) {
      high = (high ^ POLYNOMIAL_HIGH) >>> 0;
      low = (low ^ POLYNOMIAL_LOW) >>> 0;
    }
  }
  TABLE_HIGH[0][index] = high;
  TABLE_LOW[0][index] = low;
}

for (let slice = 1; slice < 8; slice += 1) {
  for (let index = 0; index < 256; index += 1) {
    const previousHigh = TABLE_HIGH[slice - 1][index];
    const previousLow = TABLE_LOW[slice - 1][index];
    const tableIndex = previousLow & 0xff;
    TABLE_HIGH[slice][index] =
      ((previousHigh >>> 8) ^ TABLE_HIGH[0][tableIndex]) >>> 0;
    TABLE_LOW[slice][index] =
      (((previousLow >>> 8) | (previousHigh << 24)) ^
        TABLE_LOW[0][tableIndex]) >>>
      0;
  }
}

export class OssCrc64 {
  private high = 0xff_ff_ff_ff;
  private low = 0xff_ff_ff_ff;

  update(input: Uint8Array) {
    let { high, low } = this;
    let offset = 0;
    const blockEnd = input.length - (input.length % 8);
    while (offset < blockEnd) {
      const byte0 = (low & 0xff) ^ input[offset];
      const byte1 = ((low >>> 8) & 0xff) ^ input[offset + 1];
      const byte2 = ((low >>> 16) & 0xff) ^ input[offset + 2];
      const byte3 = (low >>> 24) ^ input[offset + 3];
      const byte4 = (high & 0xff) ^ input[offset + 4];
      const byte5 = ((high >>> 8) & 0xff) ^ input[offset + 5];
      const byte6 = ((high >>> 16) & 0xff) ^ input[offset + 6];
      const byte7 = (high >>> 24) ^ input[offset + 7];
      high =
        (TABLE_HIGH[7][byte0] ^
          TABLE_HIGH[6][byte1] ^
          TABLE_HIGH[5][byte2] ^
          TABLE_HIGH[4][byte3] ^
          TABLE_HIGH[3][byte4] ^
          TABLE_HIGH[2][byte5] ^
          TABLE_HIGH[1][byte6] ^
          TABLE_HIGH[0][byte7]) >>>
        0;
      low =
        (TABLE_LOW[7][byte0] ^
          TABLE_LOW[6][byte1] ^
          TABLE_LOW[5][byte2] ^
          TABLE_LOW[4][byte3] ^
          TABLE_LOW[3][byte4] ^
          TABLE_LOW[2][byte5] ^
          TABLE_LOW[1][byte6] ^
          TABLE_LOW[0][byte7]) >>>
        0;
      offset += 8;
    }
    while (offset < input.length) {
      const byte = input[offset];
      const tableIndex = (low ^ byte) & 0xff;
      low = (((low >>> 8) | (high << 24)) ^ TABLE_LOW[0][tableIndex]) >>> 0;
      high = ((high >>> 8) ^ TABLE_HIGH[0][tableIndex]) >>> 0;
      offset += 1;
    }
    this.high = high;
    this.low = low;
    return this;
  }

  digestHex() {
    return (
      ((this.high ^ 0xff_ff_ff_ff) >>> 0).toString(16).padStart(8, "0") +
      ((this.low ^ 0xff_ff_ff_ff) >>> 0).toString(16).padStart(8, "0")
    );
  }

  digestDecimal() {
    return BigInt(`0x${this.digestHex()}`).toString(10);
  }
}

export async function crc64File(filePath: string) {
  const crc = new OssCrc64();
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => {
      crc.update(
        typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk)
      );
    });
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return crc.digestDecimal();
}
