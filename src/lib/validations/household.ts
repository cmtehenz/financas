import { z } from "zod";

import { FINANCIAL_ACCOUNT_TYPES } from "@/domain/account-types";
import { toCents } from "@/lib/money";

const email = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .transform((value) => value.toLowerCase());

export const createHouseholdSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da Casa.")
    .max(80, "O nome da Casa é longo demais."),
  currency: z.literal("BRL"),
  timezone: z.literal("America/Sao_Paulo"),
});

export const financialAccountFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da conta.").max(80, "O nome é longo demais."),
  institutionName: z
    .string()
    .trim()
    .max(80, "O nome da instituição é longo demais.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  type: z.enum(FINANCIAL_ACCOUNT_TYPES, { error: "Informe o tipo da conta." }),
  openingBalance: z
    .string()
    .trim()
    .min(1, "Informe o saldo inicial.")
    .refine((value) => {
      try {
        toCents(value);
        return true;
      } catch {
        return false;
      }
    }, "Informe um valor em reais, como 1500,00."),
  openingBalanceDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do saldo inicial."),
});

export const financialAccountSchema = financialAccountFormSchema.transform((values) => ({
  ...values,
  openingBalanceCents: toCents(values.openingBalance),
}));

export const updateFinancialAccountSchema = financialAccountFormSchema
  .extend({
    accountId: z.string().uuid("Conta inválida."),
  })
  .transform((values) => ({
    ...values,
    openingBalanceCents: toCents(values.openingBalance),
  }));

export const deactivateFinancialAccountSchema = z.object({
  accountId: z.string().uuid("Conta inválida."),
});

export const createInvitationSchema = z.object({
  email,
});

export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid("Convite inválido."),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(16, "Convite inválido.").max(128, "Convite inválido."),
});

export const updateHouseholdSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da Casa.")
    .max(80, "O nome da Casa é longo demais."),
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type FinancialAccountInput = z.infer<typeof financialAccountFormSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
