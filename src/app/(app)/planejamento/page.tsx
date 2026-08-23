import type { Metadata } from "next";

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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Planejamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">{board.monthLabel}</p>
        </div>
        <PlanningMonthNav year={year} month={month} />
      </header>
      <PlanningBoard
        board={board}
        today={today}
        lookups={{
          accounts,
          categories,
          members: members.map((member) => ({ userId: member.userId, name: member.name })),
        }}
      />
    </div>
  );
}
