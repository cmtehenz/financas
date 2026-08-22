import type { Metadata } from "next";

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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="font-heading text-3xl tracking-tight">Nova movimentação</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Receita, despesa ou transferência. Os campos mudam conforme o tipo.
      </p>
      <div className="mt-8">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          members={members}
          defaultDate={todayInSaoPaulo()}
        />
      </div>
    </div>
  );
}
