import {
  constants,
  createDecipheriv,
  createHash,
  createPrivateKey,
  privateDecrypt,
  timingSafeEqual,
} from "node:crypto";

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SIGNATURE_PATTERN = /^[a-fA-F0-9]{64}$/;

type EnvelopeAad = {
  bodySha256: string;
  contentType: string;
  provider: string;
  receivedAt: string;
  requestId: string;
  signature: string;
  version: number;
};

type EncryptedEnvelope = {
  aad: EnvelopeAad;
  ciphertext: string;
  encryptedKey: string;
  nonce: string;
};

export type DecryptedWebhookEnvelope = {
  body: Buffer;
  bodySha256: string;
  receivedAt: Date;
  requestId: string | null;
  signature: string;
};

export class PermanentWebhookIngressError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "PermanentWebhookIngressError";
  }
}

export function decryptWebhookEnvelope(
  messageBody: string,
  privateKeyBase64: string
): DecryptedWebhookEnvelope {
  try {
    const envelope = parseEnvelope(messageBody);
    const privateKey = createPrivateKey(decodeBase64(privateKeyBase64));
    const dataKey = privateDecrypt(
      {
        key: privateKey,
        oaepHash: "sha256",
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      decodeBase64(envelope.encryptedKey)
    );
    const encrypted = decodeBase64(envelope.ciphertext);
    if (encrypted.length <= 16) {
      throw new Error("ciphertext is too short");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      dataKey,
      decodeBase64(envelope.nonce)
    );
    decipher.setAAD(Buffer.from(stableJson(envelope.aad)));
    decipher.setAuthTag(encrypted.subarray(-16));
    const body = Buffer.concat([
      decipher.update(encrypted.subarray(0, -16)),
      decipher.final(),
    ]);
    verifyBodyHash(body, envelope.aad.bodySha256);
    return {
      body,
      bodySha256: envelope.aad.bodySha256.toLowerCase(),
      receivedAt: parseReceivedAt(envelope.aad.receivedAt),
      requestId: envelope.aad.requestId || null,
      signature: envelope.aad.signature.toLowerCase(),
    };
  } catch (error) {
    if (error instanceof PermanentWebhookIngressError) {
      throw error;
    }
    throw new PermanentWebhookIngressError(
      "invalid encrypted webhook envelope"
    );
  }
}

function parseEnvelope(messageBody: string): EncryptedEnvelope {
  const decoded = decodeBase64(messageBody).toString("utf-8");
  const value = JSON.parse(decoded) as Partial<EncryptedEnvelope>;
  if (!isRecord(value.aad)) {
    throw new Error("aad is required");
  }
  const aad = value.aad as Partial<EnvelopeAad>;
  if (
    aad.version !== 1 ||
    aad.provider !== "17TRACK" ||
    aad.contentType !== "application/json" ||
    typeof aad.receivedAt !== "string" ||
    typeof aad.requestId !== "string" ||
    typeof aad.signature !== "string" ||
    !SIGNATURE_PATTERN.test(aad.signature) ||
    typeof aad.bodySha256 !== "string" ||
    !SIGNATURE_PATTERN.test(aad.bodySha256) ||
    typeof value.encryptedKey !== "string" ||
    typeof value.nonce !== "string" ||
    typeof value.ciphertext !== "string"
  ) {
    throw new Error("envelope fields are invalid");
  }
  return value as EncryptedEnvelope;
}

function decodeBase64(value: string) {
  const normalized = value.trim();
  if (!normalized || !BASE64_PATTERN.test(normalized)) {
    throw new Error("invalid Base64");
  }
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.toString("base64") !== normalized) {
    throw new Error("non-canonical Base64");
  }
  return decoded;
}

function stableJson(value: Record<string, unknown>) {
  const sorted = Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = value[key];
      return result;
    }, {});
  return JSON.stringify(sorted);
}

function verifyBodyHash(body: Buffer, expectedHex: string) {
  const actual = createHash("sha256").update(body).digest();
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(actual, expected)) {
    throw new Error("body hash mismatch");
  }
}

function parseReceivedAt(value: string) {
  const receivedAt = new Date(value);
  if (Number.isNaN(receivedAt.getTime())) {
    throw new TypeError("receivedAt is invalid");
  }
  return receivedAt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
