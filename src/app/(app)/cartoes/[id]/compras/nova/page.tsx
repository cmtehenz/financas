import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell, Surface } from "@/features/app/ui";
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

  if (!card.active) {
    return (
      <PageShell width="narrow">
        <PageHeader title="Nova compra" />
        <p className="text-sm">Cartão desativado não aceita novas compras.</p>
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <PageHeader title="Nova compra" description={card.name} />
      <Surface>
        <CardPurchaseForm
          creditCardId={card.id}
          closingDay={card.closingDay}
          dueDay={card.dueDay}
          categories={categories}
          members={members}
          defaultDate={todayInSaoPaulo()}
        />
      </Surface>
    </PageShell>
  );
}
