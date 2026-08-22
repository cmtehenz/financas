import { z } from "zod";

import { toCents } from "@/lib/money";

const moneyInput = z
  .string()
  .trim()
  .min(1, "Informe o valor.")
  .refine((value) => {
    try {
      return toCents(value) > BigInt(0);
    } catch {
      return false;
    }
  }, "Informe um valor maior que zero.");

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.trim() ? value : undefined))
  .refine((value) => {
    if (!value) {
      return true;
    }

    try {
      return toCents(value) > BigInt(0);
    } catch {
      return false;
    }
  }, "Informe um valor válido.");

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

export const debtFormSchema = z.object({
  name: z.string().trim().min(2).max(80),
  creditor: z.string().trim().min(2).max(80),
  categoryId: z.string().min(1, "Informe a categoria."),
  originalAmount: moneyInput,
  outstandingBalance: moneyInput,
  installmentAmount: optionalMoney,
  totalInstallments: z.coerce.number().int().min(1).max(360).optional(),
  annualInterestRate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.trim() ? value : undefined)),
  firstDueDate: isoDate,
  notes: z.string().trim().max(500).optional().transform((value) => (value ? value : undefined)),
});

export const debtSchema = debtFormSchema.transform((values) => {
  const rate = values.annualInterestRate
    ? Math.round(Number(values.annualInterestRate.replace(",", ".")) * 100)
    : undefined;

  return {
    ...values,
    originalAmountCents: toCents(values.originalAmount),
    outstandingBalanceCents: toCents(values.outstandingBalance),
    installmentAmountCents: values.installmentAmount ? toCents(values.installmentAmount) : undefined,
    annualInterestRateBasisPoints: rate !== undefined && Number.isFinite(rate) ? rate : undefined,
  };
});

export const payDebtSchema = z.object({
  debtId: z.string().uuid(),
  installmentId: z.string().uuid(),
  accountId: z.string().min(1),
});

export const debtStatusSchema = z.object({
  debtId: z.string().uuid(),
  status: z.enum(["NEGOTIATING", "CANCELLED", "ACTIVE"]),
});

export type DebtFormInput = z.input<typeof debtFormSchema>;
