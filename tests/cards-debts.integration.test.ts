import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import { households } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { availableBalance, currentAccountBalance } from "@/domain/ledger";
import { createId } from "@/lib/ids";
import { createFinancialAccount } from "@/services/accounts";
import {
  cancelCardPurchase,
  createCardPurchase,
  createCreditCard,
  householdCardState,
  payCardStatement,
} from "@/services/cards";
import { listHouseholdCategories } from "@/services/categories";
import { createDebt, DebtError, listDebtInstallments, payDebtInstallment } from "@/services/debts";
import { createHouseholdForUser } from "@/services/households";
import { listAllHouseholdTransactions } from "@/services/transactions";

const db = getDb();
const createdUserIds: string[] = [];
const createdHouseholdIds: string[] = [];

async function insertUser(name: string) {
  const id = crypto.randomUUID();
  const email = `vitest-p4-${id}@example.test`;
  await db.insert(user).values({ id, name, email, emailVerified: true });
  createdUserIds.push(id);
  return { id, email, name };
}

describe.sequential("cards and debts isolation", { timeout: 40_000 }, () => {
  afterAll(async () => {
    if (createdHouseholdIds.length > 0) {
      await db.delete(households).where(inArray(households.id, createdHouseholdIds));
    }

    if (createdUserIds.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUserIds));
    }

    await closeDb();
  });

  it("isolates cards and debts and keeps available balance invariant", async () => {
    const ownerA = await insertUser("Owner Cards A");
    const ownerB = await insertUser("Owner Cards B");
    const houseA = await createHouseholdForUser({ userId: ownerA.id, name: "Casa Cards A" });
    const houseB = await createHouseholdForUser({ userId: ownerB.id, name: "Casa Cards B" });
    createdHouseholdIds.push(houseA.household.id, houseB.household.id);

    const accountA = await createFinancialAccount({
      userId: ownerA.id,
      householdId: houseA.household.id,
      name: "Caixa A",
      type: "CASH",
      openingBalanceCents: BigInt(1_000_000),
      openingBalanceDate: "2026-08-01",
    });
    const accountB = await createFinancialAccount({
      userId: ownerB.id,
      householdId: houseB.household.id,
      name: "Caixa B",
      type: "CASH",
      openingBalanceCents: BigInt(1_000_000),
      openingBalanceDate: "2026-08-01",
    });
    const catsA = await listHouseholdCategories(houseA.household.id);
    const catsB = await listHouseholdCategories(houseB.household.id);
    const mercado = catsA.find((item) => item.slug === "mercado")!;
    const dividas = catsA.find((item) => item.slug === "dividas")!;
    const mercadoB = catsB.find((item) => item.slug === "mercado")!;

    const cardA = await createCreditCard({
      userId: ownerA.id,
      householdId: houseA.household.id,
      name: "Nubank",
      issuer: "Nubank",
      holderUserId: ownerA.id,
      limitCents: BigInt(500_000),
      closingDay: 10,
      dueDay: 17,
    });

    await expect(
      createCreditCard({
        userId: ownerB.id,
        householdId: houseA.household.id,
        name: "Invasao",
        issuer: "X",
        holderUserId: ownerB.id,
        limitCents: BigInt(1_000),
        closingDay: 5,
        dueDay: 12,
      }),
    ).rejects.toBeInstanceOf(Error);

    await expect(
      createCardPurchase({
        userId: ownerA.id,
        householdId: houseA.household.id,
        creditCardId: cardA!.id,
        categoryId: mercadoB.id,
        description: "Categoria alheia",
        totalAmountCents: BigInt(1_000),
        purchaseDate: "2026-08-05",
        installmentCount: 1,
      }),
    ).rejects.toBeInstanceOf(Error);

    const purchase = await createCardPurchase({
      userId: ownerA.id,
      householdId: houseA.household.id,
      creditCardId: cardA!.id,
      categoryId: mercado.id,
      description: "Mercado cartao",
      totalAmountCents: BigInt(200_000),
      purchaseDate: "2026-08-05",
      installmentCount: 1,
    });

    const beforePay = await householdCardState(houseA.household.id, "2026-08-31");
    const statement = beforePay.statements.find((item) => item.creditCardId === cardA!.id)!;
    expect(statement.pendingCents).toBe(BigInt(200_000));
    expect(beforePay.usedCents).toBe(BigInt(200_000));

    const txsBefore = await listAllHouseholdTransactions(houseA.household.id);
    const currentBefore = currentAccountBalance(
      { id: accountA!.id, openingBalanceCents: accountA!.openingBalanceCents, active: true },
      txsBefore.map((item) => ({
        ...item,
        type: item.type as "EXPENSE",
        status: item.status as "PAID",
        origin: item.origin as "MANUAL",
        budgetImpact: item.budgetImpact,
      })),
    );
    const availableBefore = availableBalance({
      currentHouseholdCents: currentBefore,
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: statement.pendingCents,
    });

    await expect(
      payCardStatement({
        userId: ownerA.id,
        householdId: houseA.household.id,
        statementId: statement.id,
        accountId: accountB!.id,
        amountCents: BigInt(200_000),
        paidAt: new Date("2026-08-20T15:00:00.000Z"),
        idempotencyKey: createId(),
      }),
    ).rejects.toBeInstanceOf(Error);

    const key = createId();
    const firstPay = await payCardStatement({
      userId: ownerA.id,
      householdId: houseA.household.id,
      statementId: statement.id,
      accountId: accountA!.id,
      amountCents: BigInt(80_000),
      paidAt: new Date("2026-08-20T15:00:00.000Z"),
      idempotencyKey: key,
    });
    const repeat = await payCardStatement({
      userId: ownerA.id,
      householdId: houseA.household.id,
      statementId: statement.id,
      accountId: accountA!.id,
      amountCents: BigInt(80_000),
      paidAt: new Date("2026-08-20T15:00:00.000Z"),
      idempotencyKey: key,
    });
    expect(repeat?.id).toBe(firstPay?.id);

    await payCardStatement({
      userId: ownerA.id,
      householdId: houseA.household.id,
      statementId: statement.id,
      accountId: accountA!.id,
      amountCents: BigInt(120_000),
      paidAt: new Date("2026-08-21T15:00:00.000Z"),
      idempotencyKey: createId(),
    });

    const afterPay = await householdCardState(houseA.household.id, "2026-08-31");
    const paidStatement = afterPay.statements.find((item) => item.id === statement.id)!;
    expect(paidStatement.pendingCents).toBe(BigInt(0));
    const txsAfter = await listAllHouseholdTransactions(houseA.household.id);
    const currentAfter = currentAccountBalance(
      { id: accountA!.id, openingBalanceCents: accountA!.openingBalanceCents, active: true },
      txsAfter.map((item) => ({
        ...item,
        type: item.type as "EXPENSE",
        status: item.status as "PAID",
        origin: item.origin as "CARD_PAYMENT" | "MANUAL",
        budgetImpact: item.budgetImpact,
      })),
    );
    expect(currentAfter).toBe(BigInt(800_000));
    const availableAfter = availableBalance({
      currentHouseholdCents: currentAfter,
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: paidStatement.pendingCents,
    });
    expect(availableAfter).toBe(availableBefore);

    const later = await createCardPurchase({
      userId: ownerA.id,
      householdId: houseA.household.id,
      creditCardId: cardA!.id,
      categoryId: mercado.id,
      description: "Compra cancelavel",
      totalAmountCents: BigInt(30_000),
      purchaseDate: "2026-08-12",
      installmentCount: 1,
    });
    await cancelCardPurchase({
      userId: ownerA.id,
      householdId: houseA.household.id,
      purchaseId: later!.id,
    });
    const afterCancel = await householdCardState(houseA.household.id, "2026-09-30");
    expect(afterCancel.purchases.find((item) => item.id === later!.id)?.status).toBe("CANCELLED");

    const debt = await createDebt({
      userId: ownerA.id,
      householdId: houseA.household.id,
      name: "Financiamento",
      creditor: "Banco",
      categoryId: dividas.id,
      originalAmountCents: BigInt(100_000),
      outstandingBalanceCents: BigInt(100_000),
      installmentAmountCents: BigInt(50_000),
      totalInstallments: 2,
      firstDueDate: "2026-08-15",
    });

    await expect(
      createDebt({
        userId: ownerB.id,
        householdId: houseA.household.id,
        name: "Invasao",
        creditor: "X",
        categoryId: dividas.id,
        originalAmountCents: BigInt(1_000),
        outstandingBalanceCents: BigInt(1_000),
        firstDueDate: "2026-08-15",
      }),
    ).rejects.toBeInstanceOf(Error);

    const installment = (await listDebtInstallments(houseA.household.id, debt!.id))[0];

    const firstDebtPay = await payDebtInstallment({
      userId: ownerA.id,
      householdId: houseA.household.id,
      debtId: debt!.id,
      installmentId: installment!.id,
      accountId: accountA!.id,
    });
    expect(firstDebtPay.outstanding).toBe(BigInt(50_000));

    await expect(
      payDebtInstallment({
        userId: ownerA.id,
        householdId: houseA.household.id,
        debtId: debt!.id,
        installmentId: installment!.id,
        accountId: accountA!.id,
      }),
    ).rejects.toBeInstanceOf(DebtError);

    expect(purchase).toBeTruthy();
    expect(accountB).toBeTruthy();
  });
});
