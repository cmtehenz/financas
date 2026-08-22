"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  cancelTransactionAction,
  deleteTransactionAction,
  markTransactionPaidAction,
  markTransactionPendingAction,
} from "@/actions/transactions";
import { Button } from "@/components/ui/button";

export function TransactionActions({
  transactionId,
  status,
}: {
  transactionId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(action: (input: { transactionId: string }) => Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    try {
      const result = await action({ transactionId });
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível atualizar.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "PAID" ? (
        <Button
          type="button"
          className="h-9"
          disabled={pending}
          onClick={() => run(markTransactionPaidAction)}
        >
          Marcar como paga
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-9"
          disabled={pending}
          onClick={() => run(markTransactionPendingAction)}
        >
          Voltar para pendente
        </Button>
      )}
      {status !== "CANCELLED" ? (
        <Button
          type="button"
          variant="outline"
          className="h-9"
          disabled={pending}
          onClick={() => run(cancelTransactionAction)}
        >
          Cancelar
        </Button>
      ) : null}
      <Button
        type="button"
        variant="destructive"
        className="h-9"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Excluir esta movimentação?")) {
            void run(deleteTransactionAction);
          }
        }}
      >
        Excluir
      </Button>
    </div>
  );
}
