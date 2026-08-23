"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createAccountAction, updateAccountAction } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FINANCIAL_ACCOUNT_TYPE_LABELS, FINANCIAL_ACCOUNT_TYPES } from "@/domain/account-types";
import { fieldControlClassName } from "@/features/app/ui";
import {
  financialAccountFormSchema,
  type FinancialAccountInput,
} from "@/lib/validations/household";

export function AccountForm({
  defaultDate,
  accountId,
  defaultValues,
  submitLabel = "Salvar conta",
  onSaved,
}: {
  defaultDate: string;
  accountId?: string;
  defaultValues?: Partial<FinancialAccountInput>;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<FinancialAccountInput>({
    resolver: zodResolver(financialAccountFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      institutionName: defaultValues?.institutionName ?? "",
      type: defaultValues?.type ?? "CHECKING",
      openingBalance: defaultValues?.openingBalance ?? "0,00",
      openingBalanceDate: defaultValues?.openingBalanceDate ?? defaultDate,
    },
  });

  async function onSubmit(values: FinancialAccountInput) {
    setPending(true);

    try {
      const result = accountId
        ? await updateAccountAction({ ...values, accountId })
        : await createAccountAction(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(accountId ? "Conta atualizada." : "Conta cadastrada.");
      form.reset({
        name: "",
        institutionName: "",
        type: "CHECKING",
        openingBalance: "0,00",
        openingBalanceDate: defaultDate,
      });
      onSaved?.();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor={`account-name-${accountId ?? "new"}`}>Nome</Label>
        <Input
          id={`account-name-${accountId ?? "new"}`}
          className="h-11"
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`account-institution-${accountId ?? "new"}`}>Instituição</Label>
        <Input
          id={`account-institution-${accountId ?? "new"}`}
          className="h-11"
          placeholder="Opcional"
          {...form.register("institutionName")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`account-type-${accountId ?? "new"}`}>Tipo</Label>
          <select
            id={`account-type-${accountId ?? "new"}`}
            className={fieldControlClassName}
            {...form.register("type")}
          >
            {FINANCIAL_ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {FINANCIAL_ACCOUNT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`account-date-${accountId ?? "new"}`}>Data do saldo</Label>
          <Input
            id={`account-date-${accountId ?? "new"}`}
            type="date"
            className="h-11"
            {...form.register("openingBalanceDate")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`account-balance-${accountId ?? "new"}`}>Saldo inicial</Label>
        <Input
          id={`account-balance-${accountId ?? "new"}`}
          className="h-11"
          inputMode="decimal"
          placeholder="0,00"
          {...form.register("openingBalance")}
        />
        {form.formState.errors.openingBalance ? (
          <p className="text-sm text-destructive">{form.formState.errors.openingBalance.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
