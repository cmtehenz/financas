import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiresAt(now = new Date()) {
  return new Date(now.getTime() + INVITE_TTL_MS);
}
