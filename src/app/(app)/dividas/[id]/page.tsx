import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DebtStatusButtons, PayDebtForm } from "@/features/debts/debt-forms";
import { EmptyState, PageHeader, PageShell, SectionTitle, StatCard, StatusBadge } from "@/features/app/ui";
import { formatBRL } from "@/lib/money";
import { requireCompletedHousehold } from "@/lib/require-household";
import { todayInSaoPaulo } from "@/lib/dates";
import { listHouseholdAccounts } from "@/services/accounts";
import { getDebt, listDebtInstallments } from "@/services/debts";

export const metadata: Metadata = {
  title: "Dívida",
};

export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { household } = await requireCompletedHousehold();
  const { id } = await params;
  const [debt, installments, accounts] = await Promise.all([
    getDebt(household.id, id),
    listDebtInstallments(household.id, id),
    listHouseholdAccounts(household.id),
  ]);

  if (!debt) {
    notFound();
  }

  const today = todayInSaoPaulo();
  const next = installments
    .filter((item) => item.status === "PENDING" || item.status === "OVERDUE")
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
  const overdue = installments.filter((item) => item.status === "OVERDUE" || (item.status === "PENDING" && item.dueDate < today));
  const paid = installments.filter((item) => item.status === "PAID");
  const estimated = Boolean(debt.annualInterestRateBasisPoints) || !debt.installmentAmountCents;

  return (
    <PageShell>
      <PageHeader
        title={debt.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{debt.creditor}</span>
            <StatusBadge tone={debt.status === "ACTIVE" ? "warning" : "neutral"}>{debt.status}</StatusBadge>
          </span>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Saldo devedor" value={formatBRL(debt.outstandingBalanceCents)} testId="debt-outstanding" />
        <StatCard label="Original" value={formatBRL(debt.originalAmountCents)} />
        <StatCard label="Pagas" value={`${debt.paidInstallments}/${debt.totalInstallments ?? 0}`} />
      </section>
      {estimated ? (
        <p className="text-sm text-muted-foreground">
          Cronograma estimado. Não trata este valor como saldo exato informado pelo credor.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Próximo vencimento {next ? `${next.dueDate} · ${formatBRL(next.amountCents)}` : "nenhum"} · atrasadas{" "}
        {overdue.length}
      </p>
      <DebtStatusButtons debtId={debt.id} />

      <section>
        <SectionTitle>Parcelas</SectionTitle>
        <ul className="mt-3 space-y-3">
          {installments.map((item) => (
            <li key={item.id} className="surface space-y-2 px-4 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span>
                  {item.installmentNumber} · {item.dueDate} · {formatBRL(item.amountCents)}
                </span>
                <StatusBadge
                  tone={item.status === "PAID" ? "success" : item.status === "OVERDUE" ? "danger" : "warning"}
                >
                  {item.status}
                </StatusBadge>
              </p>
              {item.status !== "PAID" && item.status !== "CANCELLED" ? (
                <PayDebtForm debtId={debt.id} installmentId={item.id} accounts={accounts} />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Pagamentos</SectionTitle>
        {paid.length === 0 ? (
          <EmptyState className="mt-3">Nenhum pagamento ainda.</EmptyState>
        ) : (
          <ul className="mt-3 space-y-2">
            {paid.map((item) => (
              <li key={item.id} className="surface px-4 py-3 text-sm">
                Parcela {item.installmentNumber} · {formatBRL(item.amountCents)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
