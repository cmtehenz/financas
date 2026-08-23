"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  cancelPlanningItemAction,
  copyPreviousMonthPlanningAction,
  makePlanningItemRecurringAction,
  markPlanningIncomePendingAction,
  settlePlanningItemAction,
} from "@/actions/planning";
import { PayDebtForm } from "@/features/debts/debt-forms";
import { StatementPaymentForm } from "@/features/cards/card-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCentsInput } from "@/lib/money";
import type { PlanningCopyPreviewItem } from "@/services/planning";

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none";

type AccountOption = { id: string; name: string; active: boolean };

export function PlanningSettleForm({
  itemId,
  kind,
  defaultAmountCents,
  defaultAccountId,
  defaultDate,
  accounts,
  year,
  month,
  confirmLabel,
}: {
  itemId: string;
  kind: "LEDGER" | "INVESTMENT";
  defaultAmountCents: string;
  defaultAccountId: string;
  defaultDate: string;
  accounts: AccountOption[];
  year: number;
  month: number;
  confirmLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const defaultAmount = useMemo(() => {
    const cents = BigInt(defaultAmountCents || "0");
    return cents > BigInt(0) ? formatCentsInput(cents) : "";
  }, [defaultAmountCents]);

  async function onSubmit(formData: FormData) {
    if (!window.confirm(`Confirmar ${confirmLabel.toLowerCase()}?`)) {
      return;
    }

    setPending(true);
    try {
      const result = await settlePlanningItemAction({
        itemId,
        kind,
        amount: String(formData.get("amount") ?? ""),
        accountId: String(formData.get("accountId") ?? ""),
        paidAt: String(formData.get("paidAt") ?? ""),
        year,
        month,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Situação atualizada.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]" action={onSubmit}>
      <select name="accountId" className={selectClassName} defaultValue={defaultAccountId} required>
        {accounts
          .filter((account) => account.active)
          .map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
      </select>
      <Input name="amount" className="h-11" defaultValue={defaultAmount} required aria-label="Valor" />
      <Input name="paidAt" type="date" className="h-11" defaultValue={defaultDate} required aria-label="Data" />
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Salvando..." : confirmLabel}
      </Button>
    </form>
  );
}

export function PlanningStatusButtons({
  transactionId,
  showPending,
}: {
  transactionId: string;
  showPending?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(kind: "pending" | "cancel") {
    setPending(true);
    try {
      const result =
        kind === "pending"
          ? await markPlanningIncomePendingAction({ transactionId })
          : await cancelPlanningItemAction({ transactionId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(kind === "pending" ? "Voltou para pendente." : "Item cancelado.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {showPending ? (
        <Button type="button" variant="outline" className="h-9" disabled={pending} onClick={() => run("pending")}>
          Voltar para pendente
        </Button>
      ) : null}
      <Button type="button" variant="outline" className="h-9" disabled={pending} onClick={() => run("cancel")}>
        Cancelar
      </Button>
    </div>
  );
}

export function PlanningRecurringForm({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await makePlanningItemRecurringAction({
        transactionId,
        dueDay: Number(formData.get("dueDay") || 1),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Recorrência criada.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-wrap items-end gap-2" action={onSubmit}>
      <div className="space-y-1">
        <Label htmlFor={`due-day-${transactionId}`}>Dia</Label>
        <Input id={`due-day-${transactionId}`} name="dueDay" type="number" min={1} max={31} className="h-11 w-20" defaultValue="1" />
      </div>
      <Button type="submit" variant="outline" className="h-11" disabled={pending}>
        Tornar recorrente
      </Button>
    </form>
  );
}

export function PlanningCopyForm({
  year,
  month,
  items,
}: {
  year: number;
  month: number;
  items: PlanningCopyPreviewItem[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const selectable = items.filter((item) => !item.alreadyCopied);

  async function onSubmit(formData: FormData) {
    const transactionIds = formData.getAll("transactionIds").map(String);
    if (transactionIds.length === 0) {
      toast.error("Selecione ao menos um item.");
      return;
    }

    if (!window.confirm("Copiar os itens selecionados do mês anterior?")) {
      return;
    }

    setPending(true);
    try {
      const result = await copyPreviousMonthPlanningAction({ year, month, transactionIds });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.created ?? 0} item(ns) copiado(s).`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="rounded-2xl border border-border p-4">
      <summary className="cursor-pointer text-sm font-medium">Copiar planejamento do mês anterior</summary>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nada elegível no mês anterior.</p>
      ) : (
        <form className="mt-4 space-y-3" action={onSubmit}>
          <fieldset>
            <legend className="sr-only">Itens do mês anterior</legend>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="transactionIds"
                    value={item.id}
                    defaultChecked={!item.alreadyCopied}
                    disabled={item.alreadyCopied}
                  />
                  <span>
                    {item.description} · {item.amountLabel}
                    {item.alreadyCopied ? " · já copiado" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </fieldset>
          <Button type="submit" className="h-11" disabled={pending || selectable.length === 0}>
            {pending ? "Copiando..." : "Copiar selecionados"}
          </Button>
        </form>
      )}
    </details>
  );
}

export function PlanningCardPay({
  statementId,
  pendingLabel,
  accounts,
  defaultDate,
}: {
  statementId: string;
  pendingLabel: string;
  accounts: AccountOption[];
  defaultDate: string;
}) {
  return (
    <StatementPaymentForm
      statementId={statementId}
      pendingLabel={pendingLabel}
      accounts={accounts}
      defaultDate={defaultDate}
    />
  );
}

export function PlanningDebtPay({
  debtId,
  installmentId,
  accounts,
}: {
  debtId: string;
  installmentId: string;
  accounts: AccountOption[];
}) {
  return <PayDebtForm debtId={debtId} installmentId={installmentId} accounts={accounts} />;
}
