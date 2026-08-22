import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="font-heading text-3xl tracking-tight">Editar movimentação</h1>
      <div className="mt-8">
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
          }}
        />
      </div>
    </div>
  );
}
