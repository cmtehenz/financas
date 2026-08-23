"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { deleteTransactionAction, updateTransactionAction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldControlClassName } from "@/features/app/ui";
import { formatCentsInput } from "@/lib/money";
import { transactionFormSchema, type TransactionFormInput } from "@/lib/validations/ledger";

type CategoryOption = { id: string; name: string; type: string; active: boolean };

export type PlannerEditItem = {
  transactionId: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amountCents: string;
  dueDate: string;
  categoryId: string;
  accountId: string;
  status: "PLANNED" | "PENDING" | "PAID";
  recurring: boolean;
};

export function PlannerEditDialog({
  item,
  categories,
  onClose,
}: {
  item: PlannerEditItem;
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [scope, setScope] = useState<"THIS" | "THIS_AND_FUTURE">("THIS");
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: itemValues(item),
  });

  const type = item.type;
  const visibleCategories = categories.filter((category) => category.active && category.type === type);

  async function onSubmit(values: TransactionFormInput) {
    if (!values.categoryId) {
      form.setError("categoryId", { message: "Selecione a categoria." });
      return;
    }

    const dueDate = values.dueDate || item.dueDate;
    setPending(true);

    try {
      const result = await updateTransactionAction({
        ...values,
        transactionId: item.transactionId,
        type: item.type,
        accountId: item.accountId,
        transactionDate: dueDate,
        dueDate,
        status: item.status,
        recurrenceScope: item.recurring ? scope : "THIS",
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        item.recurring && scope === "THIS_AND_FUTURE"
          ? "Lançamento e próximos meses atualizados."
          : "Lançamento atualizado.",
      );
      onClose();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm(
      item.recurring && scope === "THIS_AND_FUTURE"
        ? "Excluir este lançamento e os próximos meses?"
        : "Excluir este lançamento?",
    );
    if (!confirmed) {
      return;
    }

    setPending(true);
    try {
      const result = await deleteTransactionAction({
        transactionId: item.transactionId,
        recurrenceScope: item.recurring ? scope : "THIS",
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        item.recurring && scope === "THIS_AND_FUTURE"
          ? "Lançamento e próximos meses excluídos."
          : "Lançamento excluído.",
      );
      onClose();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={Boolean(item)} onClose={onClose} title="Editar lançamento">
      <form className="space-y-4" method="post" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <p className="text-secondary">{type === "INCOME" ? "Receita" : "Despesa"}</p>

        <div className="space-y-1.5">
          <Label htmlFor="planner-edit-description">Descrição</Label>
          <Input id="planner-edit-description" autoComplete="off" autoFocus {...form.register("description")} />
          {form.formState.errors.description ? (
            <p className="text-caption text-destructive">{form.formState.errors.description.message}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="planner-edit-amount">Valor</Label>
            <Input id="planner-edit-amount" inputMode="decimal" {...form.register("amount")} />
            {form.formState.errors.amount ? (
              <p className="text-caption text-destructive">{form.formState.errors.amount.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="planner-edit-due-date">Vencimento</Label>
            <Input id="planner-edit-due-date" type="date" {...form.register("dueDate")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="planner-edit-category">Categoria</Label>
          <select id="planner-edit-category" className={fieldControlClassName} {...form.register("categoryId")}>
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

        {item.recurring ? (
          <fieldset className="space-y-2">
            <legend className="text-label">Esta alteração vale para</legend>
            <label htmlFor="planner-edit-scope-this" className="flex min-h-11 items-center gap-2.5 text-sm">
              <input
                id="planner-edit-scope-this"
                type="radio"
                name="recurrence-scope"
                checked={scope === "THIS"}
                onChange={() => setScope("THIS")}
              />
              Somente este
            </label>
            <label htmlFor="planner-edit-scope-future" className="flex min-h-11 items-center gap-2.5 text-sm">
              <input
                id="planner-edit-scope-future"
                type="radio"
                name="recurrence-scope"
                checked={scope === "THIS_AND_FUTURE"}
                onChange={() => setScope("THIS_AND_FUTURE")}
              />
              Este e os próximos
            </label>
            {scope === "THIS_AND_FUTURE" ? (
              <p className="text-caption">Os próximos meses passam a usar o novo valor, vencimento e categoria.</p>
            ) : (
              <p className="text-caption">Os próximos meses continuam com o valor atual da recorrência.</p>
            )}
          </fieldset>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="destructive"
            className="h-10"
            disabled={pending}
            onClick={onDelete}
          >
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="h-10" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 px-5" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function itemValues(item: PlannerEditItem): TransactionFormInput {
  return {
    type: item.type,
    description: item.description,
    amount: formatCentsInput(BigInt(item.amountCents)),
    accountId: item.accountId,
    destinationAccountId: "",
    categoryId: item.categoryId,
    assignedToUserId: "",
    transactionDate: item.dueDate || "2000-01-01",
    dueDate: item.dueDate || "",
    status: item.status,
    notes: "",
    recurring: item.recurring,
    dueDay: "",
  };
}
