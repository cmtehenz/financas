import Link from "next/link";

import { TransactionForm } from "@/features/ledger/transaction-form";
import { planningPath } from "@/domain/planning";
import { occurrenceDate } from "@/lib/dates";
import type { MonthlyPlanningBoard } from "@/services/planning";

import {
  PlanningCardPay,
  PlanningCopyForm,
  PlanningDebtPay,
  PlanningRecurringForm,
  PlanningSettleForm,
  PlanningStatusButtons,
} from "./planning-forms";

type FormLookups = {
  accounts: Array<{ id: string; name: string; active: boolean }>;
  categories: Array<{ id: string; name: string; type: string; active: boolean }>;
  members: Array<{ userId: string; name: string }>;
};

export function PlanningBoard({
  board,
  lookups,
  today,
}: {
  board: MonthlyPlanningBoard;
  lookups: FormLookups;
  today: string;
}) {
  const returnTo = planningPath(board.year, board.month);
  const defaultDate = occurrenceDate(board.year, board.month, Number(today.slice(8, 10)));
  const defaultAccountId = lookups.accounts.find((account) => account.active)?.id ?? "";

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="planning-summary">
        <SummaryCard label="Entradas previstas" value={board.totals.plannedIncomeLabel} testId="planning-planned-income" />
        <SummaryCard label="Entradas recebidas" value={board.totals.receivedIncomeLabel} testId="planning-received-income" />
        <SummaryCard label="Total de contas" value={board.totals.billsTotalLabel} testId="planning-bills-total" />
        <SummaryCard label="Total já pago" value={board.totals.paidBillsLabel} testId="planning-paid-total" />
        <SummaryCard label="Falta pagar" value={board.totals.remainingToPayLabel} testId="planning-remaining" />
        <SummaryCard label="Saldo planejado do mês" value={board.totals.plannedBalanceLabel} testId="planning-planned-balance" />
        <SummaryCard label="Saldo realmente disponível" value={board.totals.availableLabel} testId="planning-available" />
      </section>

      <p className="text-sm text-muted-foreground">
        O saldo planejado é o resultado previsto do mês e não muda quando uma conta é marcada como
        paga. O disponível continua sendo o saldo oficial da Casa.{" "}
        <Link href="/dashboard" className="underline">
          Início
        </Link>
        {" · "}
        <Link href={`/orcamento?mes=${board.monthKey}`} className="underline">
          Orçamento
        </Link>
      </p>

      <PlanningCopyForm year={board.year} month={board.month} items={board.copyPreview} />

      {board.empty ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground" data-testid="planning-empty">
          Nenhum lançamento neste mês. Crie entradas, contas ou copie o mês anterior.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4" data-testid="planning-incomes">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-2xl">Entradas</h2>
            <p className="text-sm text-muted-foreground">Total {board.totals.plannedIncomeLabel}</p>
          </div>
          <details className="rounded-2xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">Criar entrada</summary>
            <div className="mt-4">
              <TransactionForm
                accounts={lookups.accounts}
                categories={lookups.categories}
                members={lookups.members}
                defaultDate={defaultDate}
                redirectTo={returnTo}
                idPrefix="planning-income-"
                defaultValues={{ type: "INCOME", status: "PLANNED", transactionDate: defaultDate }}
              />
            </div>
          </details>
          {board.incomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma entrada neste mês.</p>
          ) : (
            <ul className="space-y-3">
              {board.incomes.map((item) => (
                <li key={item.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.expectedDateLabel} · {item.assigneeName} · {item.accountName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-xl">{item.amountLabel}</p>
                      <p className="text-sm">{item.statusLabel}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <Link href={`/movimentacoes/${item.id}`} className="underline">
                      Editar
                    </Link>
                    <span>Destino: {item.accountName}</span>
                  </div>
                  {item.canReceive ? (
                    <div className="mt-3">
                      <PlanningSettleForm
                        itemId={item.id}
                        kind="LEDGER"
                        defaultAmountCents={item.amountCents}
                        defaultAccountId={item.accountId}
                        defaultDate={today}
                        accounts={lookups.accounts}
                        year={board.year}
                        month={board.month}
                        confirmLabel="Marcar como recebida"
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-3">
                    <PlanningStatusButtons transactionId={item.id} showPending={item.visualStatus === "PAGA"} />
                    {item.recurring ? null : <PlanningRecurringForm transactionId={item.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4" data-testid="planning-bills">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-2xl">Contas a pagar</h2>
            <p className="text-sm text-muted-foreground">Total {board.totals.billsTotalLabel}</p>
          </div>
          <details className="rounded-2xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">Criar conta</summary>
            <div className="mt-4">
              <TransactionForm
                accounts={lookups.accounts}
                categories={lookups.categories}
                members={lookups.members}
                defaultDate={defaultDate}
                redirectTo={returnTo}
                idPrefix="planning-bill-"
                defaultValues={{ type: "EXPENSE", status: "PLANNED", transactionDate: defaultDate }}
              />
            </div>
          </details>
          {board.bills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta neste mês.</p>
          ) : (
            <ul className="space-y-3">
              {board.bills.map((item) => (
                <li key={item.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.originLabel} · {item.dueDateLabel} · {item.assigneeName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-xl">{item.amountLabel}</p>
                      <p className="text-sm">{item.statusLabel}</p>
                    </div>
                  </div>
                  {item.origin === "LEDGER" || item.origin === "RECURRING" || (item.origin === "INVESTMENT" && !item.id.startsWith("investment:")) ? (
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <Link href={`/movimentacoes/${item.sourceId}`} className="underline">
                        Editar
                      </Link>
                      <PlanningStatusButtons transactionId={item.sourceId} />
                      {item.origin === "RECURRING" ? null : <PlanningRecurringForm transactionId={item.sourceId} />}
                    </div>
                  ) : null}
                  {item.canPay &&
                  (item.origin === "LEDGER" ||
                    item.origin === "RECURRING" ||
                    (item.origin === "INVESTMENT" && !item.id.startsWith("investment:"))) ? (
                    <div className="mt-3">
                      <PlanningSettleForm
                        itemId={item.sourceId}
                        kind="LEDGER"
                        defaultAmountCents={item.amountCents}
                        defaultAccountId={defaultAccountId}
                        defaultDate={today}
                        accounts={lookups.accounts}
                        year={board.year}
                        month={board.month}
                        confirmLabel="Marcar como paga"
                      />
                    </div>
                  ) : null}
                  {item.canPay && item.origin === "INVESTMENT" && item.id.startsWith("investment:") ? (
                    <div className="mt-3">
                      <PlanningSettleForm
                        itemId={item.id}
                        kind="INVESTMENT"
                        defaultAmountCents={item.amountCents}
                        defaultAccountId={defaultAccountId}
                        defaultDate={today}
                        accounts={lookups.accounts}
                        year={board.year}
                        month={board.month}
                        confirmLabel="Registrar investimento"
                      />
                    </div>
                  ) : null}
                  {item.canPay && item.origin === "CARD" && item.statementId && item.pendingLabel ? (
                    <div className="mt-3">
                      <PlanningCardPay
                        statementId={item.statementId}
                        pendingLabel={item.pendingLabel}
                        accounts={lookups.accounts}
                        defaultDate={today}
                      />
                    </div>
                  ) : null}
                  {item.canPay && item.origin === "DEBT" && item.debtId && item.installmentId ? (
                    <div className="mt-3">
                      <PlanningDebtPay
                        debtId={item.debtId}
                        installmentId={item.installmentId}
                        accounts={lookups.accounts}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <article className="rounded-2xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading mt-1 text-2xl" data-testid={testId}>
        {value}
      </p>
    </article>
  );
}
