import { describe, expect, it } from "vitest";

import {
  decideInvitationAcceptance,
  invitationPublicMessage,
  normalizeEmail,
} from "@/domain/invitation-rules";
import { createInviteToken, hashInviteToken } from "@/lib/invite-token";

const future = new Date("2026-08-29T12:00:00.000Z");
const now = new Date("2026-08-22T12:00:00.000Z");

function invitation(overrides: Partial<Parameters<typeof decideInvitationAcceptance>[0]> = {}) {
  return {
    email: "esposa@example.test",
    expiresAt: future,
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

describe("invite tokens", () => {
  it("stores a hash instead of the raw token", () => {
    const token = createInviteToken();
    const hash = hashInviteToken(token);

    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashInviteToken(token));
  });
});

describe("invitation acceptance rules", () => {
  it("accepts a valid invite for the matching e-mail", () => {
    expect(
      decideInvitationAcceptance(invitation(), { email: "Esposa@Example.TEST", now }),
    ).toEqual({ ok: true });
  });

  it("rejects an expired invite", () => {
    const decision = decideInvitationAcceptance(invitation({ expiresAt: now }), {
      email: "esposa@example.test",
      now,
    });

    expect(decision).toEqual({ ok: false, reason: "expired" });
    expect(invitationPublicMessage("expired")).toMatch(/expirou/);
  });

  it("rejects a revoked invite", () => {
    expect(
      decideInvitationAcceptance(invitation({ revokedAt: now }), {
        email: "esposa@example.test",
        now,
      }),
    ).toEqual({ ok: false, reason: "revoked" });
  });

  it("rejects an already used invite", () => {
    expect(
      decideInvitationAcceptance(invitation({ acceptedAt: now }), {
        email: "esposa@example.test",
        now,
      }),
    ).toEqual({ ok: false, reason: "used" });
  });

  it("rejects a different e-mail", () => {
    expect(
      decideInvitationAcceptance(invitation(), { email: "outra@example.test", now }),
    ).toEqual({ ok: false, reason: "email_mismatch" });
  });

  it("normalizes e-mail before comparing", () => {
    expect(normalizeEmail("  Aline@Example.TEST ")).toBe("aline@example.test");
  });
});
