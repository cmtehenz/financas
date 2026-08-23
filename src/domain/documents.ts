export const DOCUMENT_KINDS = ["BOLETO", "RECEIPT", "INVOICE", "OTHER"] as const;
export const DOCUMENT_SUBJECT_TYPES = ["TRANSACTION", "CARD_STATEMENT", "DEBT_INSTALLMENT"] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type DocumentSubjectType = (typeof DOCUMENT_SUBJECT_TYPES)[number];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  BOLETO: "Boleto",
  RECEIPT: "Comprovante",
  INVOICE: "Nota fiscal",
  OTHER: "Outro",
};

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_SUBJECT = 20;

export const ALLOWED_DOCUMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type DocumentSubject = {
  subjectType: DocumentSubjectType;
  subjectId: string;
};

export function isDocumentKind(value: string): value is DocumentKind {
  return DOCUMENT_KINDS.includes(value as DocumentKind);
}

export function isDocumentSubjectType(value: string): value is DocumentSubjectType {
  return DOCUMENT_SUBJECT_TYPES.includes(value as DocumentSubjectType);
}

export function documentCountKey(subject: DocumentSubject) {
  return `${subject.subjectType}:${subject.subjectId}`;
}

export function documentSubjectForIncome(transactionId: string): DocumentSubject {
  return { subjectType: "TRANSACTION", subjectId: transactionId };
}

export function documentSubjectForBill(item: {
  origin: string;
  sourceId: string;
  statementId?: string;
  installmentId?: string;
  id: string;
}): DocumentSubject | null {
  if (item.origin === "CARD") {
    return item.statementId ? { subjectType: "CARD_STATEMENT", subjectId: item.statementId } : null;
  }

  if (item.origin === "DEBT") {
    return item.installmentId ? { subjectType: "DEBT_INSTALLMENT", subjectId: item.installmentId } : null;
  }

  if (item.id.startsWith("investment:")) {
    return null;
  }

  if (item.origin === "LEDGER" || item.origin === "RECURRING" || item.origin === "INVESTMENT") {
    return { subjectType: "TRANSACTION", subjectId: item.sourceId };
  }

  return null;
}

export function sanitizeDocumentFileName(fileName: string) {
  const cleaned = fileName.replace(/[/\\]/g, "").replace(/\0/g, "").trim();
  return (cleaned || "arquivo").slice(0, 180);
}

function hasPrefix(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function detectDocumentContentType(bytes: Uint8Array, declaredType: string): string | null {
  if (bytes.length < 12) {
    return null;
  }

  if (hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return "application/pdf";
  }

  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return "image/png";
  }

  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    hasPrefix(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }

  const brand = String.fromCharCode(...bytes.slice(4, 12));
  if (brand.startsWith("ftyp") && /heic|heif|mif1|msf1/i.test(brand)) {
    return declaredType === "image/heif" ? "image/heif" : "image/heic";
  }

  return null;
}

export function formatDocumentBytes(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(0)} KB`;
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}
