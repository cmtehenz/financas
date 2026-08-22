import { z } from "zod";

import { CATEGORY_KINDS, CATEGORY_TYPES, TRANSACTION_STATUSES, TRANSACTION_TYPES } from "@/domain/transaction-types";
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
  }, "Informe um valor maior que zero, como 150,00.");

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const emptyToUndefined = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value : undefined));
const optionalId = emptyToUndefined;

export const transactionFormSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  description: z.string().trim().min(2, "Informe a descrição.").max(120),
  amount: moneyInput,
  accountId: z.string().min(1, "Informe a conta."),
  destinationAccountId: optionalId,
  categoryId: optionalId,
  assignedToUserId: optionalId,
  transactionDate: isoDate,
  dueDate: emptyToUndefined,
  status: z.enum(["PLANNED", "PENDING", "PAID"]),
  notes: z.string().trim().max(500).optional().transform((value) => (value ? value : undefined)),
  recurring: z.boolean().optional(),
  dueDay: z.string().optional(),
});

export const transactionSchema = transactionFormSchema.transform((values) => ({
  ...values,
  amountCents: toCents(values.amount),
  dueDate: values.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(values.dueDate) ? values.dueDate : undefined,
}));

export const updateTransactionSchema = transactionFormSchema
  .omit({ recurring: true, dueDay: true })
  .extend({ transactionId: z.string().uuid() })
  .transform((values) => ({
    ...values,
    amountCents: toCents(values.amount),
    dueDate: values.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(values.dueDate) ? values.dueDate : undefined,
  }));

export const transactionIdSchema = z.object({
  transactionId: z.string().uuid(),
});

export const transactionFiltersSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

const nonNegativeMoney = z
  .string()
  .trim()
  .min(1, "Informe o valor.")
  .refine((value) => {
    try {
      return toCents(value) >= BigInt(0);
    } catch {
      return false;
    }
  }, "Informe um valor válido.");

export const budgetFormSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  expectedIncome: nonNegativeMoney,
  plannedInvestment: nonNegativeMoney,
  notes: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
});

export const budgetSchema = budgetFormSchema.transform((values) => ({
  year: values.year,
  month: values.month,
  expectedIncomeCents: toCents(values.expectedIncome),
  plannedInvestmentCents: toCents(values.plannedInvestment),
  notes: values.notes,
}));

export const categoryLimitSchema = z.object({
  categoryId: z.string().min(1),
  limit: z
    .string()
    .trim()
    .refine((value) => {
      try {
        return toCents(value || "0") >= BigInt(0);
      } catch {
        return false;
      }
    }, "Informe um limite válido."),
});

export const categoryLimitsSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  limits: z.array(categoryLimitSchema),
});

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  type: z.enum(CATEGORY_TYPES),
  kind: z.enum(CATEGORY_KINDS),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor.").optional(),
  icon: z.string().trim().max(40).optional(),
});

export const updateCategorySchema = categoryFormSchema.extend({
  categoryId: z.string().uuid(),
});

export const deactivateCategorySchema = z.object({
  categoryId: z.string().uuid(),
});

export const recurringRuleSchema = z.object({
  ruleId: z.string().uuid(),
  description: z.string().trim().min(2).max(120),
  amount: moneyInput,
  dueDay: z.coerce.number().int().min(1).max(31),
  endDate: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  defaultStatus: z.enum(["PLANNED", "PENDING"]),
});

export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type BudgetFormInput = z.input<typeof budgetFormSchema>;
export type CategoryFormInput = z.input<typeof categoryFormSchema>;
