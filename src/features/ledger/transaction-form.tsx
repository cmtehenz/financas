"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createTransactionAction, updateTransactionAction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS } from "@/domain/transaction-types";
import { cn } from "@/lib/utils";
import { transactionFormSchema, type TransactionFormInput } from "@/lib/validations/ledger";

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function TransactionForm({
  accounts,
  categories,
  members,
  defaultDate,
  transactionId,
  defaultValues,
  redirectTo = "/movimentacoes",
  idPrefix = "",
}: {
  accounts: Array<{ id: string; name: string; active: boolean }>;
  categories: Array<{ id: string; name: string; type: string; active: boolean }>;
  members: Array<{ userId: string; name: string }>;
  defaultDate: string;
  transactionId?: string;
  defaultValues?: Partial<TransactionFormInput>;
  redirectTo?: string;
  idPrefix?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: defaultValues?.type ?? "EXPENSE",
      description: defaultValues?.description ?? "",
      amount: defaultValues?.amount ?? "",
      accountId: defaultValues?.accountId ?? accounts.find((account) => account.active)?.id ?? "",
      destinationAccountId: defaultValues?.destinationAccountId ?? "",
      categoryId: defaultValues?.categoryId ?? "",
      assignedToUserId: defaultValues?.assignedToUserId ?? "",
      transactionDate: defaultValues?.transactionDate ?? defaultDate,
      dueDate: defaultValues?.dueDate ?? "",
      status: defaultValues?.status ?? "PENDING",
      notes: defaultValues?.notes ?? "",
      recurring: false,
      dueDay: defaultValues?.dueDay ?? "",
    },
  });

  const selectedType = form.getValues("type");
  const [type, setType] = useState(selectedType);
  const [recurring, setRecurring] = useState(Boolean(defaultValues?.recurring));
  const visibleCategories = categories.filter((category) => category.active && category.type === type);

  async function onSubmit(values: TransactionFormInput) {
    setPending(true);

    try {
      const result = transactionId
        ? await updateTransactionAction({ ...values, transactionId })
        : await createTransactionAction(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(transactionId ? "Movimentação atualizada." : "Movimentação criada.");
      router.push(redirectTo);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" method="post" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <fieldset className="grid grid-cols-3 gap-2">
        {(["INCOME", "EXPENSE", "TRANSFER"] as const).map((value) => (
          <label
            key={value}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border text-sm",
              type === value ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
          >
            <input
              type="radio"
              value={value}
              className="sr-only"
              {...form.register("type", {
                onChange: (event) => setType(event.target.value as TransactionFormInput["type"]),
              })}
            />
            {TRANSACTION_TYPE_LABELS[value]}
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}description`}>Descrição</Label>
        <Input id={`${idPrefix}description`} className="h-11" {...form.register("description")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}amount`}>Valor</Label>
        <Input id={`${idPrefix}amount`} className="h-11" inputMode="decimal" placeholder="0,00" {...form.register("amount")} />
        {form.formState.errors.amount ? (
          <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}accountId`}>{type === "TRANSFER" ? "Conta de origem" : "Conta"}</Label>
        <select id={`${idPrefix}accountId`} className={selectClassName} {...form.register("accountId")}>
          {accounts
            .filter((account) => account.active)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
        </select>
      </div>

      {type === "TRANSFER" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}destinationAccountId`}>Conta de destino</Label>
          <select
            id={`${idPrefix}destinationAccountId`}
            className={selectClassName}
            {...form.register("destinationAccountId")}
          >
            <option value="">Selecione</option>
            {accounts
              .filter((account) => account.active)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}categoryId`}>Categoria</Label>
          <select id={`${idPrefix}categoryId`} className={selectClassName} {...form.register("categoryId")}>
            <option value="">Selecione</option>
            {visibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}assignedToUserId`}>Responsável</Label>
        <select id={`${idPrefix}assignedToUserId`} className={selectClassName} {...form.register("assignedToUserId")}>
          <option value="">Compartilhado</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}transactionDate`}>Data</Label>
          <Input id={`${idPrefix}transactionDate`} type="date" className="h-11" {...form.register("transactionDate")} />
        </div>
        {type !== "TRANSFER" ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}dueDate`}>Vencimento</Label>
            <Input id={`${idPrefix}dueDate`} type="date" className="h-11" {...form.register("dueDate")} />
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}status`}>Situação</Label>
        <select id={`${idPrefix}status`} className={selectClassName} {...form.register("status")}>
          {(["PLANNED", "PENDING", "PAID"] as const).map((status) => (
            <option key={status} value={status}>
              {TRANSACTION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {type !== "TRANSFER" && !transactionId ? (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...form.register("recurring", {
                onChange: (event) => setRecurring(event.target.checked),
              })}
            />
            Recorrência mensal
          </label>
          {recurring ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}dueDay`}>Dia do vencimento</Label>
              <Input id={`${idPrefix}dueDay`} type="number" min={1} max={31} className="h-11" {...form.register("dueDay")} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}notes`}>Observação</Label>
        <Input id={`${idPrefix}notes`} className="h-11" {...form.register("notes")} />
      </div>

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Salvando..." : transactionId ? "Salvar alterações" : "Salvar movimentação"}
      </Button>
    </form>
  );
}
