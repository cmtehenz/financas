import { z } from "zod";

import { DOCUMENT_KINDS, DOCUMENT_SUBJECT_TYPES } from "@/domain/documents";

export const documentSubjectSchema = z.object({
  subjectType: z.enum(DOCUMENT_SUBJECT_TYPES),
  subjectId: z.string().min(1).max(120),
});

export const listDocumentsSchema = documentSubjectSchema;

export const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

export const uploadDocumentsSchema = documentSubjectSchema.extend({
  kind: z.enum(DOCUMENT_KINDS),
});
