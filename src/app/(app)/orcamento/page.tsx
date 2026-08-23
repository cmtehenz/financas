import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader, PageShell, SectionTitle, StatCard, StatusBadge, Surface } from "@/features/app/ui";
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
    <PageShell>
      <PageHeader
        title="Orçamento"
        description={
          <>
            Mês {summary.monthKey} ·{" "}
            <Link href={`/planejamento?ano=${year}&mes=${month}`} className="underline">
              Planejamento
            </Link>
            {" · "}
            <Link href="/dashboard" className="underline">
              Início
            </Link>
          </>
        }
        actions={
          <div className="flex gap-3 text-sm">
            <Link href={`/orcamento?mes=${shiftYearMonth(summary.monthKey, -1)}`} className="underline">
              Anterior
            </Link>
            <Link href={`/orcamento?mes=${shiftYearMonth(summary.monthKey, 1)}`} className="underline">
              Próximo
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Renda prevista" value={formatBRL(summary.budget?.expectedIncomeCents ?? BigInt(0))} />
        <StatCard
          label="Investimento planejado"
          value={formatBRL(summary.plannedInvestmentCents)}
          testId="planned-investment"
        />
        <StatCard label="Realizado" value={formatBRL(summary.paidExpenseCents)} />
        <StatCard label="Disponível" value={summary.availableLabel} />
      </section>

      <Surface>
        <SectionTitle>Totais do mês</SectionTitle>
        <div className="mt-4">
          <BudgetTotalsForm
            year={year}
            month={month}
            expectedIncome={summary.budget?.expectedIncomeCents ?? BigInt(0)}
            plannedInvestment={summary.plannedInvestmentCents}
          />
        </div>
      </Surface>

      <Surface>
        <SectionTitle>Limites por categoria</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Comprometido {formatBRL(summary.budgetUsedCents)} de {formatBRL(summary.budgetLimitCents)} ·{" "}
          {summary.budgetPercent}%
        </p>
        {summary.expenseByCategory.length === 0 ? (
          <EmptyState className="mt-4">Nenhuma categoria de despesa neste mês.</EmptyState>
        ) : (
          <ul className="mt-4 space-y-3">
            {summary.expenseByCategory.map((item) => (
              <li key={item.categoryId} className="rounded-xl border border-border px-3 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span>{item.name}</span>
                  <span className="text-money">
                    {formatBRL(item.usedCents)} / {formatBRL(item.limitCents)}
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
                  <StatusBadge
                    tone={item.alert === "over" ? "danger" : item.alert === "warning" ? "warning" : "success"}
                  >
                    {ALERT_TEXT[item.alert]}
                  </StatusBadge>
                  <span>
                    {item.percent}% utilizado
                    {item.alert === "over" ? " ⚠" : item.alert === "warning" ? " !" : " · ok"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
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
      </Surface>
    </PageShell>
  );
}
