"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createTransactionAction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldControlClassName } from "@/features/app/ui";
import { cn } from "@/lib/utils";
import { transactionFormSchema, type TransactionFormInput } from "@/lib/validations/ledger";

type CategoryOption = { id: string; name: string; type: string; active: boolean };

function defaults(defaultDate: string, defaultAccountId: string): TransactionFormInput {
  return {
    type: "EXPENSE",
    description: "",
    amount: "",
    accountId: defaultAccountId,
    destinationAccountId: "",
    categoryId: "",
    assignedToUserId: "",
    transactionDate: defaultDate,
    dueDate: defaultDate,
    status: "PLANNED",
    notes: "",
    recurring: false,
    dueDay: "",
  };
}

export function PlanningAddControl({
  defaultDate,
  defaultAccountId,
  categories,
}: {
  defaultDate: string;
  defaultAccountId: string;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaults(defaultDate, defaultAccountId),
  });

  const [type, setType] = useState<TransactionFormInput["type"]>("EXPENSE");
  const visibleCategories = categories.filter((category) => category.active && category.type === type);

  function openDialog() {
    form.reset(defaults(defaultDate, defaultAccountId));
    setType("EXPENSE");
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  async function onSubmit(values: TransactionFormInput) {
    if (!defaultAccountId) {
      toast.error("Cadastre uma conta para lançar.");
      return;
    }

    if (!values.categoryId) {
      form.setError("categoryId", { message: "Selecione a categoria." });
      return;
    }

    const dueDate = values.dueDate || defaultDate;
    setPending(true);

    try {
      const result = await createTransactionAction({
        ...values,
        accountId: defaultAccountId,
        transactionDate: dueDate,
        dueDate,
        status: "PLANNED",
        recurring: Boolean(values.recurring && values.type === "EXPENSE"),
        dueDay:
          values.recurring && values.type === "EXPENSE"
            ? String(Number(dueDate.slice(8, 10)))
            : "",
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Lançamento adicionado.");
      close();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="planner-add-button"
        aria-label="Adicionar lançamento"
        className="h-10 shrink-0 px-3.5"
        onClick={openDialog}
      >
        + Adicionar
      </Button>

      <Dialog open={open} onClose={close} title="Novo lançamento">
        <form className="space-y-4" method="post" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo">
            {(["EXPENSE", "INCOME"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                className={cn(
                  "flex h-10 items-center justify-center rounded-xl border text-sm font-medium transition-colors",
                  type === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => {
                  setType(value);
                  form.setValue("type", value);
                  form.setValue("categoryId", "");
                  if (value !== "EXPENSE") {
                    form.setValue("recurring", false);
                  }
                }}
              >
                {value === "INCOME" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="planner-add-description">Descrição</Label>
            <Input
              id="planner-add-description"
              autoComplete="off"
              autoFocus
              placeholder="Ex.: Energia"
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <p className="text-caption text-destructive">{form.formState.errors.description.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="planner-add-amount">Valor</Label>
              <Input
                id="planner-add-amount"
                inputMode="decimal"
                placeholder="R$ 0,00"
                {...form.register("amount")}
              />
              {form.formState.errors.amount ? (
                <p className="text-caption text-destructive">{form.formState.errors.amount.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="planner-add-due-date">Vencimento</Label>
              <Input id="planner-add-due-date" type="date" {...form.register("dueDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="planner-add-category">Categoria</Label>
            <select id="planner-add-category" className={fieldControlClassName} {...form.register("categoryId")}>
              <option value="">Selecione</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {form.formState.errors.categoryId ? (
              <p className="text-caption text-destructive">{form.formState.errors.categoryId.message}</p>
            ) : null}
          </div>

          {type === "EXPENSE" ? (
            <label htmlFor="planner-add-recurring" className="flex min-h-11 items-center gap-2.5 text-sm text-foreground">
              <input
                id="planner-add-recurring"
                type="checkbox"
                className="size-4 rounded border-border"
                {...form.register("recurring")}
              />
              Repetir mensalmente
            </label>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" className="h-10" onClick={close} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 px-5" disabled={pending}>
              {pending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
