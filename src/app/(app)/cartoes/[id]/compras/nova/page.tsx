import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardPurchaseForm } from "@/features/cards/card-forms";
import { todayInSaoPaulo } from "@/lib/dates";
import { requireCompletedHousehold } from "@/lib/require-household";
import { listHouseholdCategories } from "@/services/categories";
import { getCreditCard } from "@/services/cards";
import { listHouseholdMembers } from "@/services/households";

export const metadata: Metadata = {
  title: "Nova compra",
};

export default async function NewPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { household } = await requireCompletedHousehold();
  const { id } = await params;
  const [card, categories, members] = await Promise.all([
    getCreditCard(household.id, id),
    listHouseholdCategories(household.id),
    listHouseholdMembers(household.id),
  ]);

  if (!card) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="font-heading text-3xl tracking-tight">Nova compra</h1>
      <p className="mt-2 text-sm text-muted-foreground">{card.name}</p>
      <div className="mt-8">
        <CardPurchaseForm
          creditCardId={card.id}
          closingDay={card.closingDay}
          dueDay={card.dueDay}
          categories={categories}
          members={members}
          defaultDate={todayInSaoPaulo()}
        />
      </div>
    </div>
  );
}
