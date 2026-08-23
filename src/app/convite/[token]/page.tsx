import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { AcceptInviteForm } from "@/features/invite/accept-invite-form";
import { decideInvitationAcceptance, invitationPublicMessage } from "@/domain/invitation-rules";
import { getOptionalSession } from "@/lib/require-session";
import { getSafeInternalPath } from "@/lib/safe-redirect";
import { cn } from "@/lib/utils";
import { inspectInvitationByToken } from "@/services/invitations";
import { findHouseholdMembership } from "@/services/households";

export const metadata: Metadata = {
  title: "Convite",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await inspectInvitationByToken(token);
  const session = await getOptionalSession();
  const decision = decideInvitationAcceptance(invitation, {
    email: session?.user.email ?? invitation?.email ?? "",
  });

  const nextPath = getSafeInternalPath(`/convite/${token}`);
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  const signupHref = `/cadastro?next=${encodeURIComponent(nextPath)}`;

  if (!invitation || (!decision.ok && decision.reason !== "email_mismatch")) {
    return (
      <InviteShell title="Convite indisponível">
        <p className="text-sm leading-6 text-muted-foreground">
          {invitationPublicMessage(decision.ok ? "invalid" : decision.reason)}
        </p>
      </InviteShell>
    );
  }

  const membership = session
    ? await findHouseholdMembership(session.user.id, invitation.householdId)
    : null;

  if (membership) {
    return (
      <InviteShell title="Você já faz parte desta Casa">
        <p className="text-sm leading-6 text-muted-foreground">{invitation.householdName}</p>
        <Link href="/dashboard" className={cn(buttonVariants(), "mt-6 h-11 w-full")}>
          Ir ao início
        </Link>
      </InviteShell>
    );
  }

  if (!session) {
    return (
      <InviteShell title={`Convite para ${invitation.householdName}`}>
        <p className="text-sm leading-6 text-muted-foreground">
          {invitation.invitedByName} convidou você para a Casa. Entre ou crie sua conta
          com o e-mail do convite.
        </p>
        <div className="mt-6 grid gap-3">
          <Link href={loginHref} className={cn(buttonVariants(), "h-11 w-full")}>
            Entrar
          </Link>
          <Link href={signupHref} className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
            Criar conta
          </Link>
        </div>
      </InviteShell>
    );
  }

  if (!decision.ok && decision.reason === "email_mismatch") {
    return (
      <InviteShell title="E-mail diferente">
        <p className="text-sm leading-6 text-muted-foreground">
          Este convite é para outro e-mail. Saia e entre com o endereço que recebeu o
          convite.
        </p>
      </InviteShell>
    );
  }

  return (
    <InviteShell title={`Entrar em ${invitation.householdName}`}>
      <p className="text-sm leading-6 text-muted-foreground">
        {invitation.invitedByName} convidou você. Ao aceitar, você entra como membro desta
        Casa.
      </p>
      <div className="mt-6">
        <AcceptInviteForm token={token} />
      </div>
    </InviteShell>
  );
}

function InviteShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="surface p-6">
        <p className="text-sm text-muted-foreground">Financeiro Familiar</p>
        <h1 className="text-page-title mt-3">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
