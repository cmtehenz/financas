import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateHouseholdForm } from "@/features/onboarding/create-household-form";
import { OnboardingStepper } from "@/features/onboarding/stepper";
import { getPendingOnboardingPath } from "@/lib/onboarding-state";
import { requireOnboardingHousehold } from "@/lib/require-household";

export const metadata: Metadata = {
  title: "Criar Casa",
};

export default async function OnboardingPage() {
  const { onboarding } = await requireOnboardingHousehold();
  const pending = getPendingOnboardingPath(onboarding);

  if (pending !== "/onboarding") {
    redirect(pending);
  }

  return (
    <>
      <OnboardingStepper current="/onboarding" />
      <h1 className="font-heading mt-8 text-3xl tracking-tight">Crie a Casa</h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        A Casa é o espaço compartilhado da família. Você entra como responsável e pode
        convidar sua esposa em seguida.
      </p>
      <div className="mt-8">
        <CreateHouseholdForm defaultName="Casa Gustavo e Aline" />
      </div>
    </>
  );
}
