import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  CancelPurchaseButton,
  CardActiveButton,
  EditCreditCardForm,
  StatementPaymentForm,
} from "@/features/cards/card-forms";
import { EmptyState, PageHeader, PageShell, SectionTitle, StatCard, StatusBadge, Surface } from "@/features/app/ui";
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
    <PageShell>
      <PageHeader
        title={detail.card.name}
        description={`${detail.card.issuer} · ${members.find((member) => member.userId === detail.card.holderUserId)?.name ?? "Titular"}`}
        actions={
          detail.card.active ? (
            <Link href={`/cartoes/${detail.card.id}/compras/nova`} className={cn(buttonVariants(), "h-11")}>
              Nova compra
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Cartão desativado — só consulta.</p>
          )
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Limite" value={formatBRL(detail.card.limitCents)} />
        <StatCard label="Utilizado" value={formatBRL(detail.usedCents)} />
        <StatCard label="Disponível" value={formatBRL(detail.availableLimitCents)} testId="card-available" />
      </section>
      {detail.availableLimitCents < BigInt(0) ? <p className="text-sm text-danger">Limite ultrapassado ⚠</p> : null}
      {!detail.card.active ? <p className="text-sm">Este cartão está desativado. O histórico permanece.</p> : null}

      <Surface>
        <SectionTitle>Configurações do cartão</SectionTitle>
        <div className="mt-4">
          <EditCreditCardForm card={detail.card} />
        </div>
        <div className="mt-4">
          <CardActiveButton creditCardId={detail.card.id} active={detail.card.active} />
        </div>
      </Surface>
      {peak ? (
        <p className="text-sm text-muted-foreground">
          Maior compromisso: {peak.monthKey} · {formatBRL(peak.amountCents)}
        </p>
      ) : null}

      <section>
        <SectionTitle>Compras</SectionTitle>
        {detail.purchases.length === 0 ? (
          <EmptyState className="mt-3">Nenhuma compra cadastrada.</EmptyState>
        ) : (
          <ul className="mt-3 space-y-2">
            {detail.purchases.map((purchase) => (
              <li key={purchase.id} className="surface px-4 py-3">
                <p className="text-card-title">{purchase.description}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-money">{formatBRL(purchase.totalAmountCents)}</span>
                  <span>{purchase.installmentCount}x</span>
                  <StatusBadge tone={purchase.status === "ACTIVE" ? "info" : "neutral"}>{purchase.status}</StatusBadge>
                </p>
                {purchase.status === "ACTIVE" ? <CancelPurchaseButton purchaseId={purchase.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Fatura aberta</SectionTitle>
        {open.length === 0 ? (
          <EmptyState className="mt-3">Nenhuma fatura aberta.</EmptyState>
        ) : (
          open.map((statement) => (
            <article key={statement.id} className="surface mt-3 p-4">
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
        <SectionTitle>Faturas futuras</SectionTitle>
        <ul className="mt-3 space-y-2" data-testid="future-statements">
          {future.map((statement) => (
            <li key={statement.id} className="surface px-4 py-3 text-sm">
              {statement.referenceYear}-{String(statement.referenceMonth).padStart(2, "0")} ·{" "}
              {formatBRL(statement.totalCents)} · vence {statement.dueDate}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Histórico</SectionTitle>
        <ul className="mt-3 space-y-2">
          {history.map((statement) => (
            <li key={statement.id} className="surface px-4 py-3 text-sm">
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
        <SectionTitle>Compromissos por mês</SectionTitle>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {commitments
            .filter((item) => item.amountCents > BigInt(0))
            .map((item) => (
              <li key={item.monthKey} className="surface px-4 py-3 text-sm">
                {item.monthKey} · {formatBRL(item.amountCents)}
              </li>
            ))}
        </ul>
      </section>
    </PageShell>
  );
}
