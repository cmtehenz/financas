import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/features/app/ui";
import { PlanningBoard } from "@/features/planning/planning-board";
import { PlanningMonthNav } from "@/features/planning/planning-month-nav";
import { parsePlanningSearchParams } from "@/domain/planning";
import { todayInSaoPaulo } from "@/lib/dates";
import { requireCompletedHousehold } from "@/lib/require-household";
import { listHouseholdAccounts } from "@/services/accounts";
import { listHouseholdCategories } from "@/services/categories";
import { listHouseholdMembers } from "@/services/households";
import { getMonthlyPlanningBoard } from "@/services/planning";
import { materializeRecurrencesForMonth } from "@/services/recurrences";

export const metadata: Metadata = {
  title: "Planejamento",
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

  const [board, accounts, categories, members] = await Promise.all([
    getMonthlyPlanningBoard({
      userId: session.user.id,
      householdId: household.id,
      year,
      month,
    }),
    listHouseholdAccounts(household.id),
    listHouseholdCategories(household.id),
    listHouseholdMembers(household.id),
  ]);

  return (
    <PageShell width="wide" className="gap-6">
      <div className="space-y-4">
        <PageHeader title="Planejamento" description={board.monthLabel} />
        <PlanningMonthNav year={year} month={month} />
      </div>
      <PlanningBoard
        board={board}
        today={today}
        lookups={{
          accounts,
          categories,
          members: members.map((member) => ({ userId: member.userId, name: member.name })),
        }}
      />
    </PageShell>
  );
}
