import { and, eq, sql } from "drizzle-orm";

import { creditCardStatements, debtInstallments, householdDocuments, transactions } from "@/db/schema";
import {
  detectDocumentContentType,
  documentCountKey,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS_PER_SUBJECT,
  sanitizeDocumentFileName,
  type DocumentKind,
  type DocumentSubject,
  type DocumentSubjectType,
} from "@/domain/documents";
import { ForbiddenError } from "@/lib/access";
import { createId, isUuid } from "@/lib/ids";
import { getDb, type AppDatabase } from "@/db";

import { recordAudit } from "./audit";
import { assertHouseholdAccessForUser } from "./households";

type Db = AppDatabase;

export class DocumentError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_FILE" | "TOO_MANY" | "NOT_FOUND" | "SUBJECT_NOT_FOUND",
  ) {
    super(message);
    this.name = "DocumentError";
  }
}

export type DocumentFileInput = {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
};

export type HouseholdDocumentSummary = {
  id: string;
  kind: DocumentKind;
  fileName: string;
  contentType: string;
  byteSize: number;
  createdAt: Date;
};

export async function listDocumentCounts(householdId: string, db: Db = getDb()) {
  const rows = await db
    .select({
      subjectType: householdDocuments.subjectType,
      subjectId: householdDocuments.subjectId,
      count: sql<number>`count(*)::int`,
    })
    .from(householdDocuments)
    .where(eq(householdDocuments.householdId, householdId))
    .groupBy(householdDocuments.subjectType, householdDocuments.subjectId);

  return new Map(
    rows.map((row) => [
      documentCountKey({
        subjectType: row.subjectType as DocumentSubjectType,
        subjectId: row.subjectId,
      }),
      Number(row.count),
    ]),
  );
}

export async function listHouseholdDocuments(
  input: {
    userId: string;
    householdId: string;
    subjectType: DocumentSubjectType;
    subjectId: string;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  await assertDocumentSubject(input.householdId, input, db);

  return db
    .select({
      id: householdDocuments.id,
      kind: householdDocuments.kind,
      fileName: householdDocuments.fileName,
      contentType: householdDocuments.contentType,
      byteSize: householdDocuments.byteSize,
      createdAt: householdDocuments.createdAt,
    })
    .from(householdDocuments)
    .where(
      and(
        eq(householdDocuments.householdId, input.householdId),
        eq(householdDocuments.subjectType, input.subjectType),
        eq(householdDocuments.subjectId, input.subjectId),
      ),
    )
    .orderBy(householdDocuments.createdAt);
}

export async function getHouseholdDocument(
  input: { userId: string; householdId: string; documentId: string },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  if (!isUuid(input.documentId)) {
    return null;
  }

  const [row] = await db
    .select()
    .from(householdDocuments)
    .where(and(eq(householdDocuments.id, input.documentId), eq(householdDocuments.householdId, input.householdId)))
    .limit(1);

  return row ?? null;
}

export async function addHouseholdDocuments(
  input: {
    userId: string;
    householdId: string;
    subjectType: DocumentSubjectType;
    subjectId: string;
    kind: DocumentKind;
    files: DocumentFileInput[];
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  await assertDocumentSubject(input.householdId, input, db);

  if (input.files.length === 0) {
    throw new DocumentError("Selecione ao menos um arquivo.", "INVALID_FILE");
  }

  const existing = await listHouseholdDocuments(input, db);
  if (existing.length + input.files.length > MAX_DOCUMENTS_PER_SUBJECT) {
    throw new DocumentError(
      `Esta linha já pode ter no máximo ${MAX_DOCUMENTS_PER_SUBJECT} arquivos.`,
      "TOO_MANY",
    );
  }

  const created: HouseholdDocumentSummary[] = [];

  for (const file of input.files) {
    const prepared = prepareDocumentFile(file);
    const id = createId();

    await db.insert(householdDocuments).values({
      id,
      householdId: input.householdId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      kind: input.kind,
      fileName: prepared.fileName,
      contentType: prepared.contentType,
      byteSize: prepared.bytes.byteLength,
      content: prepared.bytes,
      createdByUserId: input.userId,
    });

    await recordAudit(
      {
        householdId: input.householdId,
        actorUserId: input.userId,
        action: "document.create",
        entityType: "household_document",
        entityId: id,
        changedFields: ["kind", "fileName"],
      },
      db,
    );

    created.push({
      id,
      kind: input.kind,
      fileName: prepared.fileName,
      contentType: prepared.contentType,
      byteSize: prepared.bytes.byteLength,
      createdAt: new Date(),
    });
  }

  return created;
}

export async function deleteHouseholdDocument(
  input: { userId: string; householdId: string; documentId: string },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  const existing = await getHouseholdDocument(input, db);
  if (!existing) {
    throw new DocumentError("Arquivo não encontrado.", "NOT_FOUND");
  }

  await db
    .delete(householdDocuments)
    .where(and(eq(householdDocuments.id, existing.id), eq(householdDocuments.householdId, input.householdId)));

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: "document.delete",
      entityType: "household_document",
      entityId: existing.id,
      changedFields: ["deleted"],
    },
    db,
  );
}

export function prepareDocumentFile(file: DocumentFileInput) {
  if (file.bytes.byteLength === 0) {
    throw new DocumentError("O arquivo está vazio.", "INVALID_FILE");
  }

  if (file.bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new DocumentError("Cada arquivo pode ter no máximo 4 MB.", "INVALID_FILE");
  }

  const contentType = detectDocumentContentType(file.bytes, file.contentType);
  if (!contentType) {
    throw new DocumentError(
      "Use PDF, JPG, PNG, WEBP ou HEIC para boleto, comprovante ou nota fiscal.",
      "INVALID_FILE",
    );
  }

  return {
    fileName: sanitizeDocumentFileName(file.fileName),
    contentType,
    bytes: file.bytes,
  };
}

async function assertDocumentSubject(householdId: string, subject: DocumentSubject, db: Db) {
  if (subject.subjectType === "TRANSACTION") {
    if (!isUuid(subject.subjectId)) {
      throw new DocumentError("Lançamento inválido.", "SUBJECT_NOT_FOUND");
    }

    const [row] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, subject.subjectId), eq(transactions.householdId, householdId)))
      .limit(1);

    if (!row) {
      throw new ForbiddenError();
    }

    return;
  }

  if (subject.subjectType === "CARD_STATEMENT") {
    if (!isUuid(subject.subjectId)) {
      throw new DocumentError("Fatura inválida.", "SUBJECT_NOT_FOUND");
    }

    const [row] = await db
      .select({ id: creditCardStatements.id })
      .from(creditCardStatements)
      .where(and(eq(creditCardStatements.id, subject.subjectId), eq(creditCardStatements.householdId, householdId)))
      .limit(1);

    if (!row) {
      throw new ForbiddenError();
    }

    return;
  }

  if (!isUuid(subject.subjectId)) {
    throw new DocumentError("Parcela inválida.", "SUBJECT_NOT_FOUND");
  }

  const [row] = await db
    .select({ id: debtInstallments.id })
    .from(debtInstallments)
    .where(and(eq(debtInstallments.id, subject.subjectId), eq(debtInstallments.householdId, householdId)))
    .limit(1);

  if (!row) {
    throw new ForbiddenError();
  }
}
