import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell, Surface } from "@/features/app/ui";
import { TransactionForm } from "@/features/ledger/transaction-form";
import { formatCentsInput } from "@/lib/money";
import { requireCompletedHousehold } from "@/lib/require-household";
import { listHouseholdAccounts } from "@/services/accounts";
import { listHouseholdCategories } from "@/services/categories";
import { listHouseholdMembers } from "@/services/households";
import { getTransaction } from "@/services/transactions";

export const metadata: Metadata = {
  title: "Editar movimentação",
};

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { household } = await requireCompletedHousehold();
  const { id } = await params;
  const [transaction, accounts, categories, members] = await Promise.all([
    getTransaction(household.id, id),
    listHouseholdAccounts(household.id),
    listHouseholdCategories(household.id),
    listHouseholdMembers(household.id),
  ]);

  if (!transaction || transaction.deletedAt) {
    notFound();
  }

  return (
    <PageShell width="narrow">
      <PageHeader title="Editar movimentação" />
      <Surface>
        <TransactionForm
          accounts={accounts}
          categories={categories}
          members={members}
          defaultDate={transaction.transactionDate}
          transactionId={transaction.id}
          defaultValues={{
            type: transaction.type as "INCOME" | "EXPENSE" | "TRANSFER",
            description: transaction.description,
            amount: formatCentsInput(transaction.amountCents),
            accountId: transaction.accountId,
            destinationAccountId: transaction.destinationAccountId ?? "",
            categoryId: transaction.categoryId ?? "",
            assignedToUserId: transaction.assignedToUserId ?? "",
            transactionDate: transaction.transactionDate,
            dueDate: transaction.dueDate ?? "",
            status:
              transaction.status === "PAID" || transaction.status === "PENDING"
                ? transaction.status
                : "PLANNED",
            notes: transaction.notes ?? "",
            recurring: Boolean(transaction.recurringRuleId),
          }}
        />
      </Surface>
    </PageShell>
  );
}
