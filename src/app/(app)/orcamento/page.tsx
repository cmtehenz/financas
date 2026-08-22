import type { Metadata } from "next";
import Link from "next/link";

import { BudgetTotalsForm, CategoryLimitsForm } from "@/features/ledger/budget-forms";
import { parseYearMonth, shiftYearMonth, todayInSaoPaulo } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { requireCompletedHousehold } from "@/lib/require-household";
import { getMonthlySummary } from "@/services/monthly-summary";
import { materializeRecurrencesForMonth } from "@/services/recurrences";

export const metadata: Metadata = {
  title: "Orçamento",
};

const ALERT_TEXT = {
  ok: "Abaixo de 80%",
  warning: "Entre 80% e 99%",
  over: "100% ou mais",
};

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { session, household } = await requireCompletedHousehold();
  const params = await searchParams;
  const monthValue = params.mes ?? todayInSaoPaulo().slice(0, 7);
  const { year, month } = parseYearMonth(monthValue);
  await materializeRecurrencesForMonth({
    userId: session.user.id,
    householdId: household.id,
    year,
    month,
  });
  const summary = await getMonthlySummary(household.id, year, month);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Orçamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mês {summary.monthKey}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/orcamento?mes=${shiftYearMonth(summary.monthKey, -1)}`} className="underline">
            Anterior
          </Link>
          <Link href={`/orcamento?mes=${shiftYearMonth(summary.monthKey, 1)}`} className="underline">
            Próximo
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Renda prevista</p>
          <p className="font-heading mt-1 text-2xl">{formatBRL(summary.budget?.expectedIncomeCents ?? BigInt(0))}</p>
        </article>
        <article className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Investimento planejado</p>
          <p className="font-heading mt-1 text-2xl" data-testid="planned-investment">
            {formatBRL(summary.plannedInvestmentCents)}
          </p>
        </article>
        <article className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Realizado</p>
          <p className="font-heading mt-1 text-2xl">{formatBRL(summary.paidExpenseCents)}</p>
        </article>
        <article className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Disponível</p>
          <p className="font-heading mt-1 text-2xl">{summary.availableLabel}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-border p-5">
        <h2 className="font-medium">Totais do mês</h2>
        <div className="mt-4">
          <BudgetTotalsForm
            year={year}
            month={month}
            expectedIncome={summary.budget?.expectedIncomeCents ?? BigInt(0)}
            plannedInvestment={summary.plannedInvestmentCents}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border p-5">
        <h2 className="font-medium">Limites por categoria</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Comprometido {formatBRL(summary.budgetUsedCents)} de {formatBRL(summary.budgetLimitCents)} ·{" "}
          {summary.budgetPercent}%
        </p>
        <ul className="mt-4 space-y-3">
          {summary.expenseByCategory.map((item) => (
            <li key={item.categoryId} className="rounded-xl border border-border px-3 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <span>{item.name}</span>
                <span>
                  {formatBRL(item.usedCents)} / {formatBRL(item.limitCents)}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {item.percent}% utilizado · {ALERT_TEXT[item.alert]}
                {item.alert === "over" ? " ⚠" : item.alert === "warning" ? " !" : " · ok"}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <CategoryLimitsForm
            year={year}
            month={month}
            categories={summary.expenseByCategory.map((item) => ({
              categoryId: item.categoryId,
              name: item.name,
              limitCents: item.limitCents,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
