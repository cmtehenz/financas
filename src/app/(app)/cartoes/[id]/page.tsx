import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { CancelPurchaseButton, StatementPaymentForm } from "@/features/cards/card-forms";
import { monthlyCardCommitments, peakCommitmentMonth } from "@/domain/cards";
import { formatBRL } from "@/lib/money";
import { requireCompletedHousehold } from "@/lib/require-household";
import { todayInSaoPaulo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { listHouseholdAccounts } from "@/services/accounts";
import { cardDetail } from "@/services/cards";
import { listHouseholdMembers } from "@/services/households";

export const metadata: Metadata = {
  title: "Cartão",
};

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { household } = await requireCompletedHousehold();
  const { id } = await params;

  const [detail, accounts, members] = await Promise.all([
    cardDetail(household.id, id).catch(() => null),
    listHouseholdAccounts(household.id),
    listHouseholdMembers(household.id),
  ]);

  if (!detail) {
    notFound();
  }

  const today = todayInSaoPaulo();
  const parsed = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const commitments = monthlyCardCommitments(
    detail.installments.map((item) => ({
      amountCents: item.amountCents,
      referenceYear: item.referenceYear,
      referenceMonth: item.referenceMonth,
      purchaseActive: detail.purchases.find((purchase) => purchase.id === item.purchaseId)?.status === "ACTIVE",
    })),
    parsed.year,
    parsed.month,
    12,
  );
  const peak = peakCommitmentMonth(commitments);
  const open = detail.statements.filter((item) => item.status === "OPEN");
  const future = detail.statements.filter((item) => item.closingDate > today);
  const history = detail.statements.filter((item) => item.status !== "OPEN");

  return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl tracking-tight">{detail.card.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.card.issuer} ·{" "}
              {members.find((member) => member.userId === detail.card.holderUserId)?.name ?? "Titular"}
            </p>
          </div>
          <Link href={`/cartoes/${detail.card.id}/compras/nova`} className={cn(buttonVariants(), "h-11")}>
            Nova compra
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Limite" value={formatBRL(detail.card.limitCents)} />
          <Stat label="Utilizado" value={formatBRL(detail.usedCents)} />
          <Stat label="Disponível" value={formatBRL(detail.availableLimitCents)} testId="card-available" />
        </section>
        {detail.availableLimitCents < BigInt(0) ? <p>Limite ultrapassado ⚠</p> : null}
        {peak ? (
          <p className="text-sm text-muted-foreground">
            Maior compromisso: {peak.monthKey} · {formatBRL(peak.amountCents)}
          </p>
        ) : null}

        <section>
          <h2 className="font-medium">Compras</h2>
          <ul className="mt-3 space-y-2">
            {detail.purchases.map((purchase) => (
              <li key={purchase.id} className="rounded-2xl border border-border px-4 py-3">
                <p className="font-medium">{purchase.description}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBRL(purchase.totalAmountCents)} · {purchase.installmentCount}x · {purchase.status}
                </p>
                {purchase.status === "ACTIVE" ? <CancelPurchaseButton purchaseId={purchase.id} /> : null}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-medium">Fatura aberta</h2>
          {open.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma fatura aberta.</p>
          ) : (
            open.map((statement) => (
              <article key={statement.id} className="mt-3 rounded-2xl border border-border p-4">
                <p>
                  {statement.referenceYear}-{String(statement.referenceMonth).padStart(2, "0")} · pendente{" "}
                  {formatBRL(statement.pendingCents)} · vence {statement.dueDate}
                </p>
                {statement.pendingCents > BigInt(0) ? (
                  <div className="mt-4">
                    <StatementPaymentForm
                      statementId={statement.id}
                      pendingLabel={formatBRL(statement.pendingCents)}
                      accounts={accounts}
                      defaultDate={today}
                    />
                  </div>
                ) : null}
              </article>
            ))
          )}
        </section>

        <section>
          <h2 className="font-medium">Faturas futuras</h2>
          <ul className="mt-3 space-y-2" data-testid="future-statements">
            {future.map((statement) => (
              <li key={statement.id} className="rounded-2xl border border-border px-4 py-3 text-sm">
                {statement.referenceYear}-{String(statement.referenceMonth).padStart(2, "0")} ·{" "}
                {formatBRL(statement.totalCents)} · vence {statement.dueDate}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-medium">Histórico</h2>
          <ul className="mt-3 space-y-2">
            {history.map((statement) => (
              <li key={statement.id} className="rounded-2xl border border-border px-4 py-3 text-sm">
                {statement.referenceYear}-{String(statement.referenceMonth).padStart(2, "0")} · {statement.status} ·{" "}
                {formatBRL(statement.pendingCents)}
                {statement.pendingCents > BigInt(0) && statement.status !== "OPEN" ? (
                  <div className="mt-3">
                    <StatementPaymentForm
                      statementId={statement.id}
                      pendingLabel={formatBRL(statement.pendingCents)}
                      accounts={accounts}
                      defaultDate={today}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-medium">Compromissos por mês</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {commitments
              .filter((item) => item.amountCents > BigInt(0))
              .map((item) => (
                <li key={item.monthKey} className="rounded-2xl border border-border px-4 py-3 text-sm">
                  {item.monthKey} · {formatBRL(item.amountCents)}
                </li>
              ))}
          </ul>
        </section>
      </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <article className="rounded-2xl border border-border px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading mt-1 text-2xl" data-testid={testId}>
        {value}
      </p>
    </article>
  );
}
