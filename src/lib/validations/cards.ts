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

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const emptyToUndefined = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value : undefined));

export const creditCardFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  issuer: z.string().trim().min(2, "Informe a bandeira ou o banco.").max(80),
  holderUserId: z.string().min(1, "Informe o titular."),
  lastFourDigits: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || /^\d{4}$/.test(value), "Informe só os 4 últimos dígitos."),
  limit: moneyInput,
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
});

export const creditCardSchema = creditCardFormSchema.transform((values) => ({
  ...values,
  limitCents: toCents(values.limit),
}));

export const cardPurchaseFormSchema = z.object({
  description: z.string().trim().min(2).max(120),
  amount: moneyInput,
  purchaseDate: isoDate,
  categoryId: z.string().min(1, "Informe a categoria."),
  assignedToUserId: emptyToUndefined,
  installmentCount: z.coerce.number().int().min(1).max(60),
  notes: z.string().trim().max(500).optional().transform((value) => (value ? value : undefined)),
});

export const cardPurchaseSchema = cardPurchaseFormSchema.transform((values) => ({
  ...values,
  totalAmountCents: toCents(values.amount),
}));

export const cardPaymentFormSchema = z.object({
  statementId: z.string().uuid(),
  accountId: z.string().min(1),
  amount: moneyInput,
  paidAt: isoDate,
  idempotencyKey: z.string().min(8).max(80),
});

export const cardPaymentSchema = cardPaymentFormSchema.transform((values) => ({
  ...values,
  amountCents: toCents(values.amount),
}));

export const updateCreditCardSchema = z.object({
  creditCardId: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  issuer: z.string().trim().min(2, "Informe a bandeira ou o banco.").max(80),
  limit: moneyInput,
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
}).transform((values) => ({
  ...values,
  limitCents: toCents(values.limit),
}));

export const cardActiveSchema = z.object({
  creditCardId: z.string().uuid(),
  active: z.boolean(),
});

export const cancelPurchaseSchema = z.object({
  purchaseId: z.string().uuid(),
});

export type CreditCardFormInput = z.input<typeof creditCardFormSchema>;
export type CardPurchaseFormInput = z.input<typeof cardPurchaseFormSchema>;
