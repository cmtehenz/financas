export const FINANCIAL_ACCOUNT_TYPES = [
  "CHECKING",
  "SAVINGS",
  "CASH",
  "INVESTMENT",
  "OTHER",
] as const;

export type FinancialAccountType = (typeof FINANCIAL_ACCOUNT_TYPES)[number];

export const FINANCIAL_ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  CASH: "Dinheiro",
  INVESTMENT: "Investimento",
  OTHER: "Outra",
};

export function isFinancialAccountType(value: string): value is FinancialAccountType {
  return (FINANCIAL_ACCOUNT_TYPES as readonly string[]).includes(value);
}
