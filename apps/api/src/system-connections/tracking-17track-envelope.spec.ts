import {
  createCipheriv,
  createHash,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
} from "node:crypto";

import {
  PermanentWebhookIngressError,
  decryptWebhookEnvelope,
} from "./tracking-17track-envelope";

describe(decryptWebhookEnvelope, () => {
  const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyBase64 = Buffer.from(
    keyPair.privateKey.export({ format: "pem", type: "pkcs8" })
  ).toString("base64");

  it("decrypts the Python ingress envelope format", () => {
    const body = Buffer.from('{"event":"TRACKING_UPDATED","data":[]}');
    const messageBody = encryptEnvelope(body, keyPair.publicKey);

    expect(decryptWebhookEnvelope(messageBody, privateKeyBase64)).toStrictEqual(
      {
        body,
        bodySha256: createHash("sha256").update(body).digest("hex"),
        receivedAt: new Date("2026-07-15T09:00:00.000Z"),
        requestId: "fc-request-1",
        signature: "a".repeat(64),
      }
    );
  });

  it("rejects an envelope encrypted for a different private key", () => {
    const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const messageBody = encryptEnvelope(Buffer.from("{}"), otherKey.publicKey);

    expect(() => decryptWebhookEnvelope(messageBody, privateKeyBase64)).toThrow(
      PermanentWebhookIngressError
    );
  });

  it("rejects non-canonical outer Base64", () => {
    const messageBody = encryptEnvelope(Buffer.from("{}"), keyPair.publicKey);

    expect(() =>
      decryptWebhookEnvelope(` ${messageBody} `, privateKeyBase64)
    ).not.toThrow(/./);
    expect(() =>
      decryptWebhookEnvelope(`${messageBody}=`, privateKeyBase64)
    ).toThrow(PermanentWebhookIngressError);
  });
});

function encryptEnvelope(
  body: Buffer,
  publicKey: ReturnType<typeof generateKeyPairSync>["publicKey"]
) {
  const dataKey = randomBytes(32);
  const nonce = randomBytes(12);
  const aad = {
    bodySha256: createHash("sha256").update(body).digest("hex"),
    contentType: "application/json",
    provider: "17TRACK",
    receivedAt: "2026-07-15T09:00:00.000Z",
    requestId: "fc-request-1",
    signature: "a".repeat(64),
    version: 1,
  };
  const cipher = createCipheriv("aes-256-gcm", dataKey, nonce);
  cipher.setAAD(Buffer.from(JSON.stringify(aad)));
  const ciphertext = Buffer.concat([
    cipher.update(body),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const envelope = {
    aad,
    ciphertext: ciphertext.toString("base64"),
    encryptedKey: publicEncrypt(
      { key: publicKey, oaepHash: "sha256" },
      dataKey
    ).toString("base64"),
    nonce: nonce.toString("base64"),
  };
  return Buffer.from(JSON.stringify(envelope)).toString("base64");
}
