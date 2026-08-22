import type { Metadata } from "next";

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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="font-heading text-3xl tracking-tight">Novo cartão</h1>
      <p className="mt-2 text-sm text-muted-foreground">Não pedimos número completo, CVV ou senha.</p>
      <div className="mt-8">
        <CreditCardForm members={members} />
      </div>
    </div>
  );
}
