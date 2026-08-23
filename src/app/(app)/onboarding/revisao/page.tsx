import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompleteOnboardingButton } from "@/features/onboarding/complete-onboarding-button";
import { OnboardingStepper } from "@/features/onboarding/stepper";
import { formatBRL } from "@/lib/money";
import { getPendingOnboardingPath } from "@/lib/onboarding-state";
import { requireOnboardingHousehold } from "@/lib/require-household";
import { getHouseholdDashboard } from "@/services/dashboard";

export const metadata: Metadata = {
  title: "Revisão",
};

export default async function OnboardingReviewPage() {
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

  const dashboard = await getHouseholdDashboard(active.household.id);

  return (
    <>
      <OnboardingStepper current="/onboarding/revisao" />
      <h1 className="text-page-title">Revise a Casa</h1>
      <p className="text-page-subtitle mt-2 max-w-lg">
        Confira os dados antes de concluir. Nada aqui é valor fictício.
      </p>
      <dl className="surface space-y-4 px-5 py-6">
        <div>
          <dt className="text-sm text-muted-foreground">Casa</dt>
          <dd className="mt-1 font-medium">{active.household.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Membros</dt>
          <dd className="mt-1 font-medium">{dashboard.memberCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Contas</dt>
          <dd className="mt-1 font-medium">{dashboard.accountCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Soma dos saldos iniciais</dt>
          <dd className="mt-1 font-medium">{formatBRL(dashboard.availableCents)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Categorias iniciais</dt>
          <dd className="mt-1 font-medium">{dashboard.categoryCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Convite</dt>
          <dd className="mt-1 font-medium">
            {dashboard.hasPendingInvite ? "Pendente" : "Nenhum pendente"}
          </dd>
        </div>
      </dl>
      <div className="mt-6">
        <CompleteOnboardingButton />
      </div>
    </>
  );
}
