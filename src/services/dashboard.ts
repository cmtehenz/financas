import { getDb, type AppDatabase } from "@/db";
import { availableBalanceFromOpening } from "@/domain/dashboard-balance";
import { formatBRL } from "@/lib/money";

import { listHouseholdAccounts } from "./accounts";
import { hasPendingInvitation, listHouseholdInvitations } from "./invitations";
import { countHouseholdCategories, listHouseholdMembers } from "./households";

type Db = AppDatabase;

export async function getHouseholdDashboard(householdId: string, db: Db = getDb()) {
  const [accounts, members, invitations, categoryCount] = await Promise.all([
    listHouseholdAccounts(householdId, db),
    listHouseholdMembers(householdId, db),
    listHouseholdInvitations(householdId, db),
    countHouseholdCategories(householdId, db),
  ]);

  const availableCents = availableBalanceFromOpening(accounts);

  return {
    availableCents,
    availableLabel: formatBRL(availableCents),
    accountCount: accounts.filter((account) => account.active).length,
    memberCount: members.length,
    members,
    categoryCount,
    hasPendingInvite: hasPendingInvitation(invitations),
  };
}
