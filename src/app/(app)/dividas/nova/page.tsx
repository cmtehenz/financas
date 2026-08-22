import type { Metadata } from "next";

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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="font-heading text-3xl tracking-tight">Nova dívida</h1>
      <div className="mt-8">
        <DebtForm categories={categories} defaultDate={todayInSaoPaulo()} />
      </div>
    </div>
  );
}
