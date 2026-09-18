import { createHash, randomBytes } from "node:crypto";

export function createInvitationToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
