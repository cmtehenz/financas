export type InvitationRecord = {
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export type InvitationFailure = "invalid" | "expired" | "revoked" | "used" | "email_mismatch";

export type InvitationDecision = { ok: true } | { ok: false; reason: InvitationFailure };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function decideInvitationAcceptance(
  invitation: InvitationRecord | null | undefined,
  input: { email: string; now?: Date },
): InvitationDecision {
  if (!invitation) {
    return { ok: false, reason: "invalid" };
  }

  const now = input.now ?? new Date();

  if (invitation.revokedAt) {
    return { ok: false, reason: "revoked" };
  }

  if (invitation.acceptedAt) {
    return { ok: false, reason: "used" };
  }

  if (invitation.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  if (normalizeEmail(invitation.email) !== normalizeEmail(input.email)) {
    return { ok: false, reason: "email_mismatch" };
  }

  return { ok: true };
}

export function invitationPublicMessage(reason: InvitationFailure) {
  switch (reason) {
    case "revoked":
      return "Este convite foi revogado.";
    case "used":
      return "Este convite já foi utilizado.";
    case "email_mismatch":
      return "Entre com o e-mail que recebeu o convite.";
    case "expired":
    case "invalid":
      return "Este convite é inválido ou expirou.";
  }
}
