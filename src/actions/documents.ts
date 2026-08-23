"use server";

import { ForbiddenError } from "@/lib/access";
import { requireHouseholdMembership } from "@/lib/require-household";
import { deleteDocumentSchema, listDocumentsSchema, uploadDocumentsSchema } from "@/lib/validations/documents";
import {
  addHouseholdDocuments,
  deleteHouseholdDocument,
  DocumentError,
  listHouseholdDocuments,
} from "@/services/documents";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function toError(error: unknown): ActionResult<never> {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Você não tem permissão para esta ação." };
  }

  if (error instanceof DocumentError) {
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "Não foi possível atualizar os arquivos." };
}

export async function listHouseholdDocumentsAction(input: unknown) {
  const parsed = listDocumentsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const documents = await listHouseholdDocuments({
      userId: session.user.id,
      householdId: household.id,
      ...parsed.data,
    });
    return { ok: true as const, data: documents };
  } catch (error) {
    return toError(error);
  }
}

export async function uploadHouseholdDocumentsAction(formData: FormData) {
  const parsed = uploadDocumentsSchema.safeParse({
    subjectType: formData.get("subjectType"),
    subjectId: formData.get("subjectId"),
    kind: formData.get("kind"),
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const files = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);

  try {
    const { session, household } = await requireHouseholdMembership();
    const created = await addHouseholdDocuments({
      userId: session.user.id,
      householdId: household.id,
      ...parsed.data,
      files: await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          contentType: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        })),
      ),
    });
    return { ok: true as const, data: created };
  } catch (error) {
    return toError(error);
  }
}

export async function deleteHouseholdDocumentAction(input: unknown) {
  const parsed = deleteDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await deleteHouseholdDocument({
      userId: session.user.id,
      householdId: household.id,
      documentId: parsed.data.documentId,
    });
    return { ok: true as const };
  } catch (error) {
    return toError(error);
  }
}
