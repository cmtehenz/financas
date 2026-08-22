export const TRANSACTION_TYPES = ["INCOME", "EXPENSE", "TRANSFER"] as const;
export const TRANSACTION_STATUSES = ["PLANNED", "PENDING", "PAID", "CANCELLED"] as const;
export const OPEN_STATUSES = ["PLANNED", "PENDING"] as const;
export const RECURRING_FREQUENCIES = ["MONTHLY"] as const;
export const CATEGORY_TYPES = ["INCOME", "EXPENSE"] as const;
export const CATEGORY_KINDS = ["FIXED", "VARIABLE", "DEBT", "INVESTMENT", "OTHER"] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  TRANSFER: "Transferência",
};

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PLANNED: "Prevista",
  PENDING: "Pendente",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

export const CATEGORY_KIND_LABELS: Record<(typeof CATEGORY_KINDS)[number], string> = {
  FIXED: "Fixa",
  VARIABLE: "Variável",
  DEBT: "Dívida",
  INVESTMENT: "Investimento",
  OTHER: "Outra",
};

export function normalizeDescription(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function slugify(value: string) {
  const slug = normalizeDescription(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "categoria";
}
