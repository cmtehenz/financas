import type { Metadata } from "next";
import Link from "next/link";

import { formatBRL } from "@/lib/money";
import { parseYearMonth, todayInSaoPaulo } from "@/lib/dates";
import { requireCompletedHousehold } from "@/lib/require-household";
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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm text-muted-foreground">Olá, {session.user.name}</p>
        <h1 className="font-heading mt-1 text-3xl tracking-tight">{household.name}</h1>
      </header>

      <section className="mt-10">
        <p className="text-sm font-medium text-muted-foreground">Saldo realmente disponível</p>
        <p className="font-heading mt-2 text-4xl tracking-tight sm:text-5xl" data-testid="available-balance">
          {summary.availableLabel}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Saldo atual da Casa (caixa já liquidado) + receitas pendentes − despesas
          pendentes − reserva de investimento − faturas não pagas com vencimento até o
          fim do mês. Faturas futuras entram só na projeção, não neste número.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href="/planejamento" className="underline">
            Planejamento do mês
          </Link>
          {" · "}
          <Link href="/orcamento" className="underline">
            Orçamento
          </Link>
        </p>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Saldo atual" value={summary.currentHouseholdLabel} />
        <Stat label="Receitas recebidas" value={formatBRL(summary.paidIncomeCents)} />
        <Stat label="Receitas pendentes" value={formatBRL(summary.pendingIncomeCents)} testId="pending-income" />
        <Stat label="Despesas pagas" value={formatBRL(summary.paidExpenseCents)} />
        <Stat label="Despesas pendentes" value={formatBRL(summary.pendingExpenseCents)} testId="pending-expense" />
        <Stat
          label="Orçamento consumido"
          value={`${summary.budgetPercent}%`}
        />
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">Faturas a vencer</p>
          <p className="font-heading mt-1 text-2xl">{formatBRL(summary.unpaidCardStatementsCents)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{summary.statementsThisMonth.length} no mês</p>
        </article>
        <article className="rounded-2xl border border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">Dívidas</p>
          <p className="font-heading mt-1 text-2xl" data-testid="debt-total">
            {formatBRL(summary.debtOutstandingCents)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{summary.debtsThisMonth.length} parcelas no mês</p>
        </article>
      </section>
      {summary.overdueAlerts.length > 0 ? (
        <p className="mt-4 text-sm">Há fatura ou dívida vencida ⚠</p>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">
        Limite usado {formatBRL(summary.cardUsedCents)} · faturas futuras {summary.futureStatements.length} ·
        maior compromisso {summary.peakCardCommitment ? `${summary.peakCardCommitment.monthKey}` : "—"}
      </p>

      <section className="mt-8 rounded-2xl border border-border bg-card px-5 py-5">
        <h2 className="font-medium">Investimento planejado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Planejado {formatBRL(summary.plannedInvestmentCents)} · realizado{" "}
          {formatBRL(summary.realizedInvestmentCents)} · já lançado{" "}
          {formatBRL(summary.pendingInvestmentCents)} · reserva{" "}
          {formatBRL(summary.reserveCents)}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-medium">Saldos das contas</h2>
        <ul className="mt-3 space-y-2">
          {summary.accountBalances
            .filter((account) => account.active)
            .map((account) => (
              <li key={account.id} className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                <span>{account.name}</span>
                <span data-testid={`account-balance-${account.name}`}>{formatBRL(account.balanceCents)}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-medium">Próximas contas</h2>
        {summary.upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma despesa prevista ou pendente.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.upcoming.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                <span>{item.description}</span>
                <span>{formatBRL(item.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-medium">Gastos por categoria</h2>
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
                    <span>{formatBRL(item.usedCents)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(width, 100)}%` }} />
                  </div>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-medium">Evolução mensal</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {summary.evolution.map((item) => (
            <li key={item.month} className="rounded-2xl border border-border px-4 py-3 text-sm">
              <p className="font-medium">{item.month}</p>
              <p className="text-muted-foreground">Entradas {formatBRL(item.incomeCents)}</p>
              <p className="text-muted-foreground">Saídas {formatBRL(item.expenseCents)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading mt-1 text-2xl" data-testid={testId}>
        {value}
      </p>
    </article>
  );
}
