import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DebtStatusButtons, PayDebtForm } from "@/features/debts/debt-forms";
import { formatBRL } from "@/lib/money";
import { requireCompletedHousehold } from "@/lib/require-household";
import { todayInSaoPaulo } from "@/lib/dates";
import { listHouseholdAccounts } from "@/services/accounts";
import { getDebt, listDebtInstallments } from "@/services/debts";

export const metadata: Metadata = {
  title: "Dívida",
};

export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { household } = await requireCompletedHousehold();
  const { id } = await params;
  const [debt, installments, accounts] = await Promise.all([
    getDebt(household.id, id),
    listDebtInstallments(household.id, id),
    listHouseholdAccounts(household.id),
  ]);

  if (!debt) {
    notFound();
  }

  const today = todayInSaoPaulo();
  const next = installments
    .filter((item) => item.status === "PENDING" || item.status === "OVERDUE")
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
  const overdue = installments.filter((item) => item.status === "OVERDUE" || (item.status === "PENDING" && item.dueDate < today));
  const paid = installments.filter((item) => item.status === "PAID");
  const estimated = Boolean(debt.annualInterestRateBasisPoints) || !debt.installmentAmountCents;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">{debt.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {debt.creditor} · {debt.status}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Saldo devedor" value={formatBRL(debt.outstandingBalanceCents)} testId="debt-outstanding" />
        <Stat label="Original" value={formatBRL(debt.originalAmountCents)} />
        <Stat label="Pagas" value={`${debt.paidInstallments}/${debt.totalInstallments ?? 0}`} />
      </section>
      {estimated ? (
        <p className="text-sm text-muted-foreground">
          Cronograma estimado. Não trata este valor como saldo exato informado pelo credor.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Próximo vencimento {next ? `${next.dueDate} · ${formatBRL(next.amountCents)}` : "nenhum"} · atrasadas{" "}
        {overdue.length}
      </p>
      <DebtStatusButtons debtId={debt.id} />

      <section>
        <h2 className="font-medium">Parcelas</h2>
        <ul className="mt-3 space-y-3">
          {installments.map((item) => (
            <li key={item.id} className="space-y-2 rounded-2xl border border-border px-4 py-3">
              <p>
                {item.installmentNumber} · {item.dueDate} · {formatBRL(item.amountCents)} · {item.status}
              </p>
              {item.status !== "PAID" && item.status !== "CANCELLED" ? (
                <PayDebtForm debtId={debt.id} installmentId={item.id} accounts={accounts} />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium">Pagamentos</h2>
        {paid.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum pagamento ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {paid.map((item) => (
              <li key={item.id} className="rounded-2xl border border-border px-4 py-3 text-sm">
                Parcela {item.installmentNumber} · {formatBRL(item.amountCents)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <article className="rounded-2xl border border-border px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading mt-1 text-2xl" data-testid={testId}>
        {value}
      </p>
    </article>
  );
}
