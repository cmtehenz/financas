import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { InviteForm } from "@/features/onboarding/invite-form";
import { OnboardingStepper } from "@/features/onboarding/stepper";
import { getPendingOnboardingPath } from "@/lib/onboarding-state";
import { requireOnboardingHousehold } from "@/lib/require-household";
import { cn } from "@/lib/utils";
import { hasPendingInvitation, listHouseholdInvitations } from "@/services/invitations";

export const metadata: Metadata = {
  title: "Convite",
};

export default async function OnboardingInvitePage() {
  const { active, onboarding } = await requireOnboardingHousehold();
  const pending = getPendingOnboardingPath(onboarding);

  if (!active) {
    redirect("/onboarding");
  }

  if (pending === "/onboarding" || pending === "/onboarding/contas") {
    redirect(pending);
  }

  if (pending === "/dashboard") {
    redirect("/dashboard");
  }

  const invitations = await listHouseholdInvitations(active.household.id);
  const pendingInvites = invitations.filter(
    (invitation) => !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > new Date(),
  );

  return (
    <>
      <OnboardingStepper current="/onboarding/convite" />
      <h1 className="font-heading mt-8 text-3xl tracking-tight">Convide sua esposa</h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        O link vale por sete dias e só pode ser usado uma vez. Você também pode pular
        e convidar depois nas configurações da Casa.
      </p>
      <div className="mt-8">
        <InviteForm
          canManage={active.membership.role === "OWNER"}
          pendingInvites={pendingInvites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            expiresAtLabel: invite.expiresAt.toLocaleDateString("pt-BR"),
          }))}
        />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {hasPendingInvitation(invitations) ? "Há um convite ativo." : "Nenhum convite ativo no momento."}
      </p>
      <Link
        href="/onboarding/revisao"
        className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 w-full")}
      >
        Pular por agora
      </Link>
    </>
  );
}
