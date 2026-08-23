"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { markPlanningIncomePendingAction, settlePlanningItemAction } from "@/actions/planning";
import { formatCentsInput } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PlannerStatusToggle({
  kind,
  visualStatus,
  canPay,
  transactionId,
  accountId,
  amountCents,
  paidAt,
  year,
  month,
}: {
  kind: "income" | "expense";
  visualStatus: string;
  canPay: boolean;
  transactionId?: string;
  accountId: string;
  amountCents: string;
  paidAt: string;
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const paid = visualStatus === "PAGA";
  const canUndo = paid && Boolean(transactionId);
  const clickable = Boolean(transactionId) && (canPay || canUndo);
  const label = statusLabel(kind, visualStatus);
  const ariaLabel = paid
    ? kind === "income"
      ? "Desfazer recebimento"
      : "Desfazer pagamento"
    : kind === "income"
      ? "Marcar como recebida"
      : "Marcar como paga";

  async function onClick() {
    if (!clickable || pending || !transactionId) {
      return;
    }

    setPending(true);
    try {
      const result = paid
        ? await markPlanningIncomePendingAction({ transactionId })
        : await settlePlanningItemAction({
            itemId: transactionId,
            kind: "LEDGER",
            amount: formatCentsInput(BigInt(amountCents)),
            accountId,
            paidAt,
            year,
            month,
          });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        paid
          ? kind === "income"
            ? "Recebimento desfeito."
            : "Pagamento desfeito."
          : kind === "income"
            ? "Marcado como recebido."
            : "Marcado como pago.",
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!clickable) {
    return <StatusChip label={label} status={visualStatus} paid={paid} />;
  }

  return (
    <button
      type="button"
      data-testid="planner-status-toggle"
      aria-label={ariaLabel}
      disabled={pending}
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors",
        chipClass(visualStatus, paid),
        "hover:brightness-[0.98] disabled:cursor-wait disabled:opacity-70",
      )}
      onClick={onClick}
    >
      <span aria-hidden="true">{paid ? "✓" : "○"}</span>
      {label}
    </button>
  );
}

function StatusChip({
  label,
  status,
  paid,
}: {
  label: string;
  status: string;
  paid: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium",
        chipClass(status, paid),
      )}
    >
      <span aria-hidden="true">{paid ? "✓" : "○"}</span>
      {label}
    </span>
  );
}

export function statusLabel(kind: "income" | "expense", visualStatus: string) {
  if (visualStatus === "PAGA") {
    return kind === "income" ? "Recebida" : "Paga";
  }
  if (visualStatus === "VENCIDA") {
    return "Atrasada";
  }
  if (visualStatus === "CANCELADA") {
    return "Cancelada";
  }
  if (visualStatus === "A_DEFINIR") {
    return "A definir";
  }
  return kind === "income" ? "Não recebida" : "Não paga";
}

function chipClass(status: string, paid: boolean) {
  if (paid || status === "PAGA") {
    return "border-emerald-100 bg-emerald-50 text-emerald-800";
  }
  if (status === "VENCIDA" || status === "CANCELADA") {
    return "border-red-100 bg-red-50 text-red-800";
  }
  if (status === "PENDENTE") {
    return "border-amber-100 bg-amber-50 text-amber-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}
