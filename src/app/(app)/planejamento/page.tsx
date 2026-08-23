import type { Metadata } from "next";

import { PageShell } from "@/features/app/ui";
import { PlanningAddControl } from "@/features/planning/add-entry-dialog";
import { PlanningBoard } from "@/features/planning/planning-board";
import { PlanningCopyForm } from "@/features/planning/planning-forms";
import { PlanningMonthNav } from "@/features/planning/planning-month-nav";
import { parsePlanningSearchParams } from "@/domain/planning";
import { occurrenceDate, todayInSaoPaulo } from "@/lib/dates";
import { requireCompletedHousehold } from "@/lib/require-household";
import { listHouseholdAccounts } from "@/services/accounts";
import { listHouseholdCategories } from "@/services/categories";
import { getMonthlyPlanningBoard } from "@/services/planning";
import { materializeRecurrencesForMonth } from "@/services/recurrences";

export const metadata: Metadata = {
  title: "Planner",
};

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const { session, household } = await requireCompletedHousehold();
  const params = await searchParams;
  const today = todayInSaoPaulo();
  const { year, month } = parsePlanningSearchParams(params, today);

  await materializeRecurrencesForMonth({
    userId: session.user.id,
    householdId: household.id,
    year,
    month,
  });

  const [board, accounts, categories] = await Promise.all([
    getMonthlyPlanningBoard({
      userId: session.user.id,
      householdId: household.id,
      year,
      month,
    }),
    listHouseholdAccounts(household.id),
    listHouseholdCategories(household.id),
  ]);
  const defaultDate = occurrenceDate(year, month, Number(today.slice(8, 10)));
  const defaultAccountId = accounts.find((account) => account.active)?.id ?? "";

  return (
    <PageShell width="wide" className="gap-6">
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-page-title">Planner</h1>
            <p className="text-page-subtitle mt-1">{board.monthLabel}</p>
          </div>
          <PlanningAddControl
            defaultDate={defaultDate}
            defaultAccountId={defaultAccountId}
            categories={categories}
          />
        </header>
        <PlanningMonthNav
          year={year}
          month={month}
          extra={<PlanningCopyForm year={year} month={month} items={board.copyPreview} />}
        />
      </div>
      <PlanningBoard board={board} accounts={accounts} categories={categories} today={today} />
    </PageShell>
  );
}
