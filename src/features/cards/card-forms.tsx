"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  cancelCardPurchaseAction,
  createCardPurchaseAction,
  createCreditCardAction,
  payCardStatementAction,
  setCreditCardActiveAction,
  updateCreditCardAction,
} from "@/actions/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewCardInstallments } from "@/domain/cards";
import { formatBRL, formatCentsInput, toCents } from "@/lib/money";
import { createId } from "@/lib/ids";

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none";

export function CreditCardForm({
  members,
}: {
  members: Array<{ userId: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await createCreditCardAction({
        name: String(formData.get("name") ?? ""),
        issuer: String(formData.get("issuer") ?? ""),
        holderUserId: String(formData.get("holderUserId") ?? ""),
        lastFourDigits: String(formData.get("lastFourDigits") ?? ""),
        limit: String(formData.get("limit") ?? ""),
        closingDay: Number(formData.get("closingDay")),
        dueDay: Number(formData.get("dueDay")),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cartão cadastrado.");
      router.push(result.id ? `/cartoes/${result.id}` : "/cartoes");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" action={onSubmit}>
      <Field id="name" label="Nome" />
      <Field id="issuer" label="Emissor" />
      <div className="space-y-2">
        <Label htmlFor="holderUserId">Titular</Label>
        <select id="holderUserId" name="holderUserId" className={selectClassName} required>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      <Field id="lastFourDigits" label="4 últimos dígitos" maxLength={4} />
      <Field id="limit" label="Limite" placeholder="0,00" />
      <Field id="closingDay" label="Dia de fechamento" type="number" />
      <Field id="dueDay" label="Dia de vencimento" type="number" />
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Salvando..." : "Salvar cartão"}
      </Button>
    </form>
  );
}

export function EditCreditCardForm({
  card,
}: {
  card: {
    id: string;
    name: string;
    issuer: string;
    limitCents: bigint;
    closingDay: number;
    dueDay: number;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await updateCreditCardAction({
        creditCardId: card.id,
        name: String(formData.get("name") ?? ""),
        issuer: String(formData.get("issuer") ?? ""),
        limit: String(formData.get("limit") ?? ""),
        closingDay: Number(formData.get("closingDay")),
        dueDay: Number(formData.get("dueDay")),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cartão atualizado.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" action={onSubmit}>
      <Field id="name" label="Nome" defaultValue={card.name} />
      <Field id="issuer" label="Emissor" defaultValue={card.issuer} />
      <Field id="limit" label="Limite" defaultValue={formatCentsInput(card.limitCents)} />
      <Field id="closingDay" label="Dia de fechamento" type="number" defaultValue={String(card.closingDay)} />
      <Field id="dueDay" label="Dia de vencimento" type="number" defaultValue={String(card.dueDay)} />
      <p className="text-sm text-muted-foreground">
        Fechamento e vencimento novos valem para compras futuras. Faturas já geradas mantêm as datas
        originais.
      </p>
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}

export function CardActiveButton({ creditCardId, active }: { creditCardId: string; active: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11"
      disabled={pending}
      onClick={async () => {
        const message = active
          ? "Desativar este cartão? O histórico permanece e novas compras serão bloqueadas."
          : "Reativar este cartão? Ele voltará a aceitar compras.";
        if (!window.confirm(message)) {
          return;
        }
        setPending(true);
        const result = await setCreditCardActiveAction({ creditCardId, active: !active });
        if (!result.ok) {
          toast.error(result.error);
        } else {
          toast.success(active ? "Cartão desativado." : "Cartão reativado.");
          router.refresh();
        }
        setPending(false);
      }}
    >
      {active ? "Desativar cartão" : "Reativar cartão"}
    </Button>
  );
}

export function CardPurchaseForm({
  creditCardId,
  closingDay,
  dueDay,
  categories,
  members,
  defaultDate,
}: {
  creditCardId: string;
  closingDay: number;
  dueDay: number;
  categories: Array<{ id: string; name: string; type: string; active: boolean }>;
  members: Array<{ userId: string; name: string }>;
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("1");
  const [purchaseDate, setPurchaseDate] = useState(defaultDate);
  const preview = useMemo(() => {
    try {
      const total = toCents(amount || "0");
      const installments = Number(count);
      if (total <= BigInt(0) || installments < 1) {
        return [];
      }

      return previewCardInstallments({
        totalAmountCents: total,
        installmentCount: installments,
        purchaseDate,
        closingDay,
        dueDay,
      });
    } catch {
      return [];
    }
  }, [amount, count, purchaseDate, closingDay, dueDay]);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await createCardPurchaseAction({
        creditCardId,
        description: String(formData.get("description") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        purchaseDate: String(formData.get("purchaseDate") ?? ""),
        categoryId: String(formData.get("categoryId") ?? ""),
        assignedToUserId: String(formData.get("assignedToUserId") ?? ""),
        installmentCount: Number(formData.get("installmentCount")),
        notes: String(formData.get("notes") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Compra lançada.");
      router.push(`/cartoes/${creditCardId}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" action={onSubmit}>
      <Field id="description" label="Descrição" />
      <div className="space-y-2">
        <Label htmlFor="amount">Valor total</Label>
        <Input id="amount" name="amount" className="h-11" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="purchaseDate">Data</Label>
        <Input
          id="purchaseDate"
          name="purchaseDate"
          type="date"
          className="h-11"
          value={purchaseDate}
          onChange={(event) => setPurchaseDate(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="categoryId">Categoria</Label>
        <select id="categoryId" name="categoryId" className={selectClassName} required>
          {categories
            .filter((category) => category.active && category.type === "EXPENSE")
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="assignedToUserId">Responsável</Label>
        <select id="assignedToUserId" name="assignedToUserId" className={selectClassName}>
          <option value="">Compartilhado</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="installmentCount">Parcelas</Label>
        <Input
          id="installmentCount"
          name="installmentCount"
          type="number"
          min={1}
          className="h-11"
          value={count}
          onChange={(event) => setCount(event.target.value)}
        />
      </div>
      <Field id="notes" label="Observação" />
      {preview.length > 0 ? (
        <div className="rounded-2xl border border-border p-4 text-sm">
          <p className="font-medium">Prévia das parcelas</p>
          <ul className="mt-2 space-y-1">
            {preview.map((item) => (
              <li key={item.installmentNumber}>
                {item.installmentNumber}/{item.installmentCount} · {item.monthKey} · {formatBRL(item.amountCents)} ·
                vence {item.dueDate}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Salvando..." : "Salvar compra"}
      </Button>
    </form>
  );
}

export function StatementPaymentForm({
  statementId,
  pendingLabel,
  accounts,
  defaultDate,
}: {
  statementId: string;
  pendingLabel: string;
  accounts: Array<{ id: string; name: string; active: boolean }>;
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createId());

  async function onSubmit(formData: FormData) {
    if (!window.confirm(`Confirmar pagamento da fatura ${pendingLabel}?`)) {
      return;
    }

    setPending(true);
    try {
      const result = await payCardStatementAction({
        statementId,
        accountId: String(formData.get("accountId") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        paidAt: String(formData.get("paidAt") ?? ""),
        idempotencyKey,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setIdempotencyKey(createId());
      toast.success("Pagamento registrado.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" action={onSubmit}>
      <p className="text-sm text-muted-foreground">Saldo pendente {pendingLabel}</p>
      <div className="space-y-2">
        <Label htmlFor={`account-${statementId}`}>Conta</Label>
        <select id={`account-${statementId}`} name="accountId" className={selectClassName} required>
          {accounts
            .filter((account) => account.active)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
        </select>
      </div>
      <Field id={`amount-${statementId}`} name="amount" label="Valor" />
      <Field id={`paidAt-${statementId}`} name="paidAt" label="Data" type="date" defaultValue={defaultDate} />
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Pagando..." : "Pagar fatura"}
      </Button>
    </form>
  );
}

export function CancelPurchaseButton({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm("Cancelar esta compra?")) {
          return;
        }
        setPending(true);
        const result = await cancelCardPurchaseAction({ purchaseId });
        if (!result.ok) {
          toast.error(result.error);
        } else {
          toast.success("Compra cancelada.");
          router.refresh();
        }
        setPending(false);
      }}
    >
      Cancelar compra
    </Button>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  placeholder,
  maxLength,
  defaultValue,
}: {
  id: string;
  name?: string;
  label: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name ?? id}
        type={type}
        className="h-11"
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={defaultValue}
      />
    </div>
  );
}
