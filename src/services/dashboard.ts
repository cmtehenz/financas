import { parseYearMonth, todayInSaoPaulo } from "@/lib/dates";

import { getMonthlySummary } from "./monthly-summary";

export async function getHouseholdDashboard(householdId: string, month = todayInSaoPaulo().slice(0, 7)) {
  const parsed = parseYearMonth(month);
  return getMonthlySummary(householdId, parsed.year, parsed.month);
}
