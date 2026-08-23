import type { Metadata } from "next";

import { PageHeader, PageShell, Surface } from "@/features/app/ui";
import { TransactionForm } from "@/features/ledger/transaction-form";
import { todayInSaoPaulo } from "@/lib/dates";
import { requireCompletedHousehold } from "@/lib/require-household";
import { listHouseholdAccounts } from "@/services/accounts";
import { listHouseholdCategories } from "@/services/categories";
import { listHouseholdMembers } from "@/services/households";

export const metadata: Metadata = {
  title: "Nova movimentação",
};

export default async function NewTransactionPage() {
  const { household } = await requireCompletedHousehold();
  const [accounts, categories, members] = await Promise.all([
    listHouseholdAccounts(household.id),
    listHouseholdCategories(household.id),
    listHouseholdMembers(household.id),
  ]);

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Nova movimentação"
        description="Receita, despesa ou transferência. Os campos mudam conforme o tipo."
      />
      <Surface>
        <TransactionForm
          accounts={accounts}
          categories={categories}
          members={members}
          defaultDate={todayInSaoPaulo()}
        />
      </Surface>
    </PageShell>
  );
}
