"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createDebtAction, payDebtInstallmentAction, updateDebtStatusAction } from "@/actions/debts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none";

export function DebtForm({
  categories,
  defaultDate,
}: {
  categories: Array<{ id: string; name: string; type: string; kind: string; active: boolean }>;
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await createDebtAction({
        name: String(formData.get("name") ?? ""),
        creditor: String(formData.get("creditor") ?? ""),
        categoryId: String(formData.get("categoryId") ?? ""),
        originalAmount: String(formData.get("originalAmount") ?? ""),
        outstandingBalance: String(formData.get("outstandingBalance") ?? ""),
        installmentAmount: String(formData.get("installmentAmount") ?? ""),
        totalInstallments: Number(formData.get("totalInstallments") || 1),
        annualInterestRate: String(formData.get("annualInterestRate") ?? ""),
        firstDueDate: String(formData.get("firstDueDate") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Dívida cadastrada.");
      router.push(result.id ? `/dividas/${result.id}` : "/dividas");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" action={onSubmit}>
      <Field id="name" label="Nome" />
      <Field id="creditor" label="Credor" />
      <div className="space-y-2">
        <Label htmlFor="categoryId">Categoria</Label>
        <select id="categoryId" name="categoryId" className={selectClassName} required>
          {categories
            .filter((category) => category.active && category.type === "EXPENSE" && category.kind === "DEBT")
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </select>
      </div>
      <Field id="originalAmount" label="Valor original" />
      <Field id="outstandingBalance" label="Saldo atual" />
      <Field id="installmentAmount" label="Parcela" />
      <Field id="totalInstallments" label="Quantidade de parcelas" type="number" defaultValue="1" />
      <Field id="annualInterestRate" label="Taxa anual opcional (%)" />
      <Field id="firstDueDate" label="Primeiro vencimento" type="date" defaultValue={defaultDate} />
      <Field id="notes" label="Observação" />
      <p className="text-sm text-muted-foreground">
        A taxa anual é guardada em basis points. Sem dados de principal e juros, o cronograma é uma
        estimativa e não o saldo informado pelo credor.
      </p>
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Salvando..." : "Salvar dívida"}
      </Button>
    </form>
  );
}

export function PayDebtForm({
  debtId,
  installmentId,
  accounts,
}: {
  debtId: string;
  installmentId: string;
  accounts: Array<{ id: string; name: string; active: boolean }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await payDebtInstallmentAction({
        debtId,
        installmentId,
        accountId: String(formData.get("accountId") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Parcela paga.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-wrap items-end gap-2" action={onSubmit}>
      <select name="accountId" className={selectClassName} required>
        {accounts
          .filter((account) => account.active)
          .map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
      </select>
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Pagando..." : "Pagar parcela"}
      </Button>
    </form>
  );
}

export function DebtStatusButtons({ debtId }: { debtId: string }) {
  const router = useRouter();

  async function run(status: "NEGOTIATING" | "CANCELLED" | "ACTIVE") {
    const result = await updateDebtStatusAction({ debtId, status });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Status atualizado.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="h-9" onClick={() => run("NEGOTIATING")}>
        Marcar negociação
      </Button>
      <Button type="button" variant="outline" className="h-9" onClick={() => run("ACTIVE")}>
        Voltar para ativa
      </Button>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  defaultValue,
}: {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} className="h-11" defaultValue={defaultValue} />
    </div>
  );
}
