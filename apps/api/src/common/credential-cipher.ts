import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { ApiBadRequestException } from "./api-error";

const CIPHER = "aes-256-gcm";

export type EncryptedCredential = {
  credentialCiphertext: string;
  credentialIv: string;
  credentialAuthTag: string;
};

export function encryptCredential(value: string): EncryptedCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, getCredentialKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf-8"),
    cipher.final(),
  ]);
  return {
    credentialCiphertext: ciphertext.toString("base64"),
    credentialIv: iv.toString("base64"),
    credentialAuthTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptCredential(credential: EncryptedCredential) {
  try {
    const decipher = createDecipheriv(
      CIPHER,
      getCredentialKey(),
      Buffer.from(credential.credentialIv, "base64")
    );
    decipher.setAuthTag(Buffer.from(credential.credentialAuthTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(credential.credentialCiphertext, "base64")),
      decipher.final(),
    ]).toString("utf-8");
  } catch {
    throw new ApiBadRequestException(
      "CREDENTIAL_KEY_INVALID",
      "连接凭据无法解密，请联系系统管理员"
    );
  }
}

function getCredentialKey() {
  const encoded = process.env.PROJECT_WING_MAIL_CREDENTIAL_KEY?.trim();
  const key = encoded
    ? /^[0-9a-f]{64}$/i.test(encoded)
      ? Buffer.from(encoded, "hex")
      : Buffer.from(encoded, "base64")
    : Buffer.alloc(0);
  if (key.length !== 32) {
    throw new ApiBadRequestException(
      "CREDENTIAL_KEY_INVALID",
      "PROJECT_WING_MAIL_CREDENTIAL_KEY 必须是 32 字节 Base64 或 64 位十六进制密钥"
    );
  }
  return key;
}
