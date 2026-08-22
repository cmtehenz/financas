import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cardAvailableLimitCents, cardUsedLimitCents } from "@/domain/cards";
import { todayInSaoPaulo } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { requireCompletedHousehold } from "@/lib/require-household";
import { cn } from "@/lib/utils";
import { householdCardState } from "@/services/cards";
import { listHouseholdMembers } from "@/services/households";

export const metadata: Metadata = {
  title: "Cartões",
};

export default async function CardsPage() {
  const { household } = await requireCompletedHousehold();
  const [state, members] = await Promise.all([
    householdCardState(household.id, todayInSaoPaulo()),
    listHouseholdMembers(household.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Cartões</h1>
          <p className="mt-1 text-sm text-muted-foreground">Limites, faturas e compromissos futuros.</p>
        </div>
        <Link href="/cartoes/novo" className={cn(buttonVariants(), "h-11")}>
          Novo cartão
        </Link>
      </header>

      {state.cards.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {state.cards.map((card) => {
            const holder = members.find((member) => member.userId === card.holderUserId)?.name ?? "Titular";
            const statements = state.statements.filter((item) => item.creditCardId === card.id);
            const current = statements.find((item) => item.status === "OPEN") ?? statements[0];
            const used = cardUsedLimitCents(
              state.installments
                .filter((item) => item.creditCardId === card.id)
                .map((item) => ({
                  amountCents: item.amountCents,
                  purchaseActive:
                    state.purchases.find((purchase) => purchase.id === item.purchaseId)?.status === "ACTIVE",
                  statementPendingCents:
                    statements.find((statement) => statement.id === item.statementId)?.pendingCents ?? BigInt(0),
                })),
            );
            const available = cardAvailableLimitCents(card.limitCents, used);
            return (
              <li key={card.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{card.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {card.issuer} · {holder}
                      {card.lastFourDigits ? ` · final ${card.lastFourDigits}` : ""}
                    </p>
                  </div>
                  <Link href={`/cartoes/${card.id}`} className="text-sm underline">
                    Abrir
                  </Link>
                </div>
                <p className="mt-3 text-sm">
                  Limite {formatBRL(card.limitCents)} · usado {formatBRL(used)} · disponível{" "}
                  <span data-testid={`card-available-${card.name}`}>{formatBRL(available)}</span>
                </p>
                {available < BigInt(0) ? (
                  <p className="mt-1 text-sm">Limite ultrapassado ⚠</p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">
                  Fatura atual {current ? formatBRL(current.pendingCents) : "R$ 0,00"} · vence{" "}
                  {current?.dueDate ?? "—"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
