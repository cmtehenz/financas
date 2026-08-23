import type { Metadata } from "next";

import { PageHeader, PageShell, Surface } from "@/features/app/ui";
import { CreditCardForm } from "@/features/cards/card-forms";
import { requireCompletedHousehold } from "@/lib/require-household";
import { listHouseholdMembers } from "@/services/households";

export const metadata: Metadata = {
  title: "Novo cartão",
};

export default async function NewCardPage() {
  const { household } = await requireCompletedHousehold();
  const members = await listHouseholdMembers(household.id);

  return (
    <PageShell width="narrow">
      <PageHeader title="Novo cartão" description="Não pedimos número completo, CVV ou senha." />
      <Surface>
        <CreditCardForm members={members} />
      </Surface>
    </PageShell>
  );
}
