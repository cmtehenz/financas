import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import { households } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { ForbiddenError } from "@/lib/access";
import { requireTestDatabaseUrl } from "@/lib/test-database";
import { createFinancialAccount } from "@/services/accounts";
import { listHouseholdCategories } from "@/services/categories";
import {
  addHouseholdDocuments,
  deleteHouseholdDocument,
  DocumentError,
  getHouseholdDocument,
  listHouseholdDocuments,
} from "@/services/documents";
import { createHouseholdForUser } from "@/services/households";
import { createTransaction } from "@/services/transactions";

const canWrite = Boolean(process.env.TEST_DATABASE_URL);
if (canWrite) {
  requireTestDatabaseUrl();
}

const db = canWrite ? getDb() : null!;
const createdUserIds: string[] = [];
const createdHouseholdIds: string[] = [];

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

async function insertUser(name: string) {
  const id = crypto.randomUUID();
  await db.insert(user).values({
    id,
    name,
    email: `vitest-docs-${id}@example.test`,
    emailVerified: true,
  });
  createdUserIds.push(id);
  return { id, name };
}

describe.skipIf(!canWrite).sequential("household documents", { timeout: 30_000 }, () => {
  afterAll(async () => {
    if (createdHouseholdIds.length > 0) {
      await db.delete(households).where(inArray(households.id, createdHouseholdIds));
    }

    if (createdUserIds.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUserIds));
    }

    await closeDb();
  });

  it("stores multiple files on a row and isolates households", async () => {
    const ownerA = await insertUser("Docs A");
    const ownerB = await insertUser("Docs B");
    const houseA = await createHouseholdForUser({ userId: ownerA.id, name: "Casa Docs A" });
    const houseB = await createHouseholdForUser({ userId: ownerB.id, name: "Casa Docs B" });
    createdHouseholdIds.push(houseA.household.id, houseB.household.id);

    const account = await createFinancialAccount({
      userId: ownerA.id,
      householdId: houseA.household.id,
      name: "Caixa Docs",
      type: "CASH",
      openingBalanceCents: BigInt(100_000),
      openingBalanceDate: "2026-08-01",
    });
    const categories = await listHouseholdCategories(houseA.household.id);
    const housing = categories.find((category) => category.name === "Moradia");
    expect(housing).toBeTruthy();

    const expense = await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      accountId: account.id,
      categoryId: housing!.id,
      description: "Aluguel docs",
      type: "EXPENSE",
      amountCents: BigInt(300_000),
      status: "PENDING",
      transactionDate: "2026-09-05",
      dueDate: "2026-09-05",
    });

    const created = await addHouseholdDocuments({
      userId: ownerA.id,
      householdId: houseA.household.id,
      subjectType: "TRANSACTION",
      subjectId: expense.id,
      kind: "BOLETO",
      files: [
        { fileName: "boleto.png", contentType: "image/png", bytes: PNG },
        { fileName: "comprovante.png", contentType: "image/png", bytes: PNG },
      ],
    });

    expect(created).toHaveLength(2);

    const listed = await listHouseholdDocuments({
      userId: ownerA.id,
      householdId: houseA.household.id,
      subjectType: "TRANSACTION",
      subjectId: expense.id,
    });
    expect(listed.map((item) => item.fileName)).toEqual(["boleto.png", "comprovante.png"]);

    await expect(
      listHouseholdDocuments({
        userId: ownerB.id,
        householdId: houseB.household.id,
        subjectType: "TRANSACTION",
        subjectId: expense.id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const downloaded = await getHouseholdDocument({
      userId: ownerA.id,
      householdId: houseA.household.id,
      documentId: created[0].id,
    });
    expect(downloaded?.content.byteLength).toBe(PNG.byteLength);

    await deleteHouseholdDocument({
      userId: ownerA.id,
      householdId: houseA.household.id,
      documentId: created[0].id,
    });
    const remaining = await listHouseholdDocuments({
      userId: ownerA.id,
      householdId: houseA.household.id,
      subjectType: "TRANSACTION",
      subjectId: expense.id,
    });
    expect(remaining).toHaveLength(1);

    await expect(
      addHouseholdDocuments({
        userId: ownerA.id,
        householdId: houseA.household.id,
        subjectType: "TRANSACTION",
        subjectId: expense.id,
        kind: "OTHER",
        files: [{ fileName: "x.txt", contentType: "text/plain", bytes: new Uint8Array(12).fill(1) }],
      }),
    ).rejects.toBeInstanceOf(DocumentError);
  });
});
