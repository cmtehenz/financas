import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState, MoneyText, PageHeader, PageShell, StatCard, Surface } from "@/features/app/ui";
import { formatBRL } from "@/lib/money";
import { parseYearMonth, todayInSaoPaulo } from "@/lib/dates";
import { requireCompletedHousehold } from "@/lib/require-household";
import { cn } from "@/lib/utils";
import { getMonthlySummary } from "@/services/monthly-summary";
import { materializeRecurrencesForMonth } from "@/services/recurrences";

export const metadata: Metadata = {
  title: "Início",
};

export default async function DashboardPage() {
  const { session, household } = await requireCompletedHousehold();
  const { year, month } = parseYearMonth(todayInSaoPaulo().slice(0, 7));
  await materializeRecurrencesForMonth({
    userId: session.user.id,
    householdId: household.id,
    year,
    month,
  });
  const summary = await getMonthlySummary(household.id, year, month);
  const maxExpense = summary.expenseByCategory.reduce(
    (highest, item) => (item.usedCents > highest ? item.usedCents : highest),
    BigInt(0),
  );

  return (
    <PageShell>
      <PageHeader
        title={household.name}
        description={`Olá, ${session.user.name}`}
        actions={
          <>
            <Link href="/planejamento" className={cn(buttonVariants(), "h-11")}>
              Planejamento do mês
            </Link>
            <Link href="/orcamento" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
              Orçamento
            </Link>
          </>
        }
      />

      <section className="surface p-6 sm:p-8">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Saldo realmente disponível
        </p>
        <p className="text-money mt-3 text-4xl sm:text-5xl" data-testid="available-balance">
          {summary.availableLabel}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Saldo atual da Casa (caixa já liquidado) + receitas pendentes − despesas
          pendentes − reserva de investimento − faturas não pagas com vencimento até o
          fim do mês. Faturas futuras entram só na projeção, não neste número.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Saldo atual" value={summary.currentHouseholdLabel} />
        <StatCard label="Receitas recebidas" value={formatBRL(summary.paidIncomeCents)} tone="success" />
        <StatCard
          label="Receitas pendentes"
          value={formatBRL(summary.pendingIncomeCents)}
          testId="pending-income"
          tone="success"
        />
        <StatCard label="Despesas pagas" value={formatBRL(summary.paidExpenseCents)} tone="danger" />
        <StatCard
          label="Despesas pendentes"
          value={formatBRL(summary.pendingExpenseCents)}
          testId="pending-expense"
          tone="danger"
        />
        <StatCard label="Orçamento consumido" value={`${summary.budgetPercent}%`} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Faturas a vencer"
          value={formatBRL(summary.unpaidCardStatementsCents)}
          hint={`${summary.statementsThisMonth.length} no mês`}
        />
        <StatCard
          label="Dívidas"
          value={formatBRL(summary.debtOutstandingCents)}
          testId="debt-total"
          hint={`${summary.debtsThisMonth.length} parcelas no mês`}
        />
      </section>
      {summary.overdueAlerts.length > 0 ? (
        <p className="text-sm text-warning">Há fatura ou dívida vencida ⚠</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Limite usado {formatBRL(summary.cardUsedCents)} · faturas futuras {summary.futureStatements.length} ·
        maior compromisso {summary.peakCardCommitment ? `${summary.peakCardCommitment.monthKey}` : "—"}
      </p>

      <Surface>
        <h2 className="text-section-title">Investimento planejado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Planejado {formatBRL(summary.plannedInvestmentCents)} · realizado{" "}
          {formatBRL(summary.realizedInvestmentCents)} · já lançado{" "}
          {formatBRL(summary.pendingInvestmentCents)} · reserva{" "}
          {formatBRL(summary.reserveCents)}
        </p>
      </Surface>

      <section>
        <h2 className="text-section-title">Saldos das contas</h2>
        <ul className="mt-3 space-y-2">
          {summary.accountBalances
            .filter((account) => account.active)
            .map((account) => (
              <li key={account.id} className="surface flex items-center justify-between px-4 py-3">
                <span>{account.name}</span>
                <MoneyText testId={`account-balance-${account.name}`}>{formatBRL(account.balanceCents)}</MoneyText>
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="text-section-title">Próximas contas</h2>
        {summary.upcoming.length === 0 ? (
          <EmptyState className="mt-3">Nenhuma despesa prevista ou pendente.</EmptyState>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.upcoming.map((item) => (
              <li key={item.id} className="surface flex items-center justify-between px-4 py-3">
                <span>{item.description}</span>
                <MoneyText>{formatBRL(item.amountCents)}</MoneyText>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-section-title">Gastos por categoria</h2>
        <ul className="mt-4 space-y-3">
          {summary.expenseByCategory
            .filter((item) => item.usedCents > BigInt(0) || item.limitCents > BigInt(0))
            .map((item) => {
              const width =
                maxExpense > BigInt(0) ? Number((item.usedCents * BigInt(100)) / maxExpense) : 0;
              return (
                <li key={item.categoryId}>
                  <div className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <MoneyText>{formatBRL(item.usedCents)}</MoneyText>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(width, 100)}%` }} />
                  </div>
                </li>
              );
            })}
        </ul>
      </section>

      <section>
        <h2 className="text-section-title">Evolução mensal</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {summary.evolution.map((item) => (
            <li key={item.month} className="surface px-4 py-3 text-sm">
              <p className="font-medium">{item.month}</p>
              <p className="text-muted-foreground">
                Entradas <MoneyText tone="success">{formatBRL(item.incomeCents)}</MoneyText>
              </p>
              <p className="text-muted-foreground">
                Saídas <MoneyText tone="danger">{formatBRL(item.expenseCents)}</MoneyText>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
