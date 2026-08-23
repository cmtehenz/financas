import type { Metadata } from "next";

import { PageHeader, PageShell, Surface } from "@/features/app/ui";
import { DebtForm } from "@/features/debts/debt-forms";
import { todayInSaoPaulo } from "@/lib/dates";
import { requireCompletedHousehold } from "@/lib/require-household";
import { listHouseholdCategories } from "@/services/categories";

export const metadata: Metadata = {
  title: "Nova dívida",
};

export default async function NewDebtPage() {
  const { household } = await requireCompletedHousehold();
  const categories = await listHouseholdCategories(household.id);

  return (
    <PageShell width="narrow">
      <PageHeader title="Nova dívida" />
      <Surface>
        <DebtForm categories={categories} defaultDate={todayInSaoPaulo()} />
      </Surface>
    </PageShell>
  );
}
