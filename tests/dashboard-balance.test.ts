import { describe, expect, it } from "vitest";

import { availableBalanceFromOpening } from "@/domain/dashboard-balance";
import { formatBRL } from "@/lib/money";

describe("availableBalanceFromOpening", () => {
  it("sums opening balances of active accounts in cents", () => {
    const total = availableBalanceFromOpening([
      { openingBalanceCents: BigInt(150050), active: true },
      { openingBalanceCents: BigInt(2000), active: true },
      { openingBalanceCents: BigInt(9999), active: false },
      { openingBalanceCents: BigInt(500), active: true, deletedAt: new Date() },
    ]);

    expect(total).toBe(BigInt(152050));
    expect(formatBRL(total)).toBe("R$ 1.520,50");
    expect(formatBRL(total)).not.toBe("R$ —");
  });

  it("does not invent a production placeholder when there are no accounts", () => {
    expect(formatBRL(availableBalanceFromOpening([]))).toBe("R$ 0,00");
  });
});
