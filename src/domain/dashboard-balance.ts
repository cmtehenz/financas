import { addCents } from "@/lib/money";
import type { Cents } from "@/types/money";

export type OpeningBalanceAccount = {
  openingBalanceCents: Cents;
  active: boolean;
  deletedAt?: Date | null;
};

/**
 * PHASE 3: replace this opening-balance sum with
 * openingBalanceCents + posted transactions of the same Casa.
 */
export function availableBalanceFromOpening(accounts: OpeningBalanceAccount[]): Cents {
  const opening = accounts
    .filter((account) => account.active && !account.deletedAt)
    .map((account) => account.openingBalanceCents);

  return addCents(...opening);
}
