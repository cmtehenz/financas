"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { MonthlyPlanningBoard, PlanningBillRow } from "@/services/planning";

import { PlannerEditDialog, type PlannerEditItem } from "./edit-entry-dialog";
import {
  applyPlannerListView,
  type PlannerListFilter,
  type PlannerListSort,
} from "./planner-list-view";
import { PLANNER_ROW_GRID, PlannerTransactionRow } from "./planner-transaction-row";
import { PlannerStatusToggle } from "./planner-status-toggle";

type AccountOption = { id: string; name: string; active: boolean };
type CategoryOption = { id: string; name: string; type: string; active: boolean };

export function PlanningLists({
  board,
  accounts,
  categories,
  today,
}: {
  board: MonthlyPlanningBoard;
  accounts: AccountOption[];
  categories: CategoryOption[];
  today: string;
}) {
  const [tab, setTab] = useState<"income" | "expense">("income");
  const [filter, setFilter] = useState<PlannerListFilter>("ALL");
  const [sort, setSort] = useState<PlannerListSort>("DATE");
  const [editing, setEditing] = useState<PlannerEditItem | null>(null);
  const showingIncome = tab === "income";
  const incomes = applyPlannerListView(
    board.incomes.map((item) => ({ ...item, sortDate: item.expectedDate })),
    filter,
    sort,
  );
  const bills = applyPlannerListView(
    board.bills.map((item) => ({ ...item, sortDate: item.dueDate })),
    filter,
    sort,
  );
  const sourceCount = showingIncome ? board.incomes.length : board.bills.length;
  const visibleCount = showingIncome ? incomes.length : bills.length;
  const total = showingIncome ? board.totals.plannedIncomeLabel : board.totals.billsTotalLabel;
  const defaultAccountId = accounts.find((account) => account.active)?.id ?? "";

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <div
          role="tablist"
          aria-label="Tipo de lançamento"
          className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/50 p-1.5"
        >
          <TabButton
            selected={showingIncome}
            tone="income"
            count={board.incomes.length}
            onClick={() => setTab("income")}
          >
            Receitas
          </TabButton>
          <TabButton
            selected={!showingIncome}
            tone="expense"
            count={board.bills.length}
            onClick={() => setTab("expense")}
          >
            Despesas
          </TabButton>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-label">{showingIncome ? "Lista de receitas" : "Lista de despesas"}</p>
          <p
            className={cn(
              "text-money text-[0.9375rem] tabular-nums",
              showingIncome ? "text-emerald-700" : "text-rose-700",
            )}
          >
            {total}
          </p>
        </div>

        {sourceCount > 0 ? (
          <PlannerListControls
            kind={tab}
            filter={filter}
            sort={sort}
            onFilter={setFilter}
            onSort={setSort}
          />
        ) : null}
      </div>

      <div
        role="tabpanel"
        data-testid={showingIncome ? "planning-incomes" : "planning-bills"}
        className="space-y-3"
      >
        {visibleCount === 0 ? (
          <p className="text-secondary" data-testid={board.empty ? "planning-empty" : undefined}>
            {sourceCount > 0
              ? showingIncome
                ? "Nenhuma receita em aberto neste mês."
                : "Nenhuma despesa em aberto neste mês."
              : showingIncome
                ? "Nenhuma receita neste mês."
                : "Nenhuma despesa neste mês."}
          </p>
        ) : (
          <div>
            <div className={cn("text-label hidden pb-2 md:grid", PLANNER_ROW_GRID)}>
              <span>Descrição</span>
              <span>{showingIncome ? "Data" : "Vencimento"}</span>
              <span>Situação</span>
              <span className="text-right">Valor</span>
              <span className="sr-only">Ação</span>
            </div>
            <ul>
              {showingIncome
                ? incomes.map((item) => (
                    <PlannerTransactionRow
                      key={item.id}
                      description={item.description}
                      date={item.expectedDate}
                      amountLabel={item.amountLabel}
                      recurring={item.recurring}
                      onEdit={() =>
                        setEditing({
                          transactionId: item.id,
                          type: "INCOME",
                          description: item.description,
                          amountCents: item.amountCents,
                          dueDate: item.expectedDate,
                          categoryId: item.categoryId,
                          accountId: item.accountId,
                          status: item.status,
                          recurring: item.recurring,
                        })
                      }
                      statusControl={
                        <PlannerStatusToggle
                          kind="income"
                          visualStatus={item.visualStatus}
                          canPay={item.canReceive}
                          transactionId={item.id}
                          accountId={item.accountId}
                          amountCents={item.amountCents}
                          paidAt={today}
                          year={board.year}
                          month={board.month}
                        />
                      }
                    />
                  ))
                : bills.map((item) => (
                    <PlannerTransactionRow
                      key={item.id}
                      description={item.description}
                      date={item.dueDate}
                      amountLabel={item.amountLabel}
                      recurring={item.origin === "RECURRING"}
                      onEdit={
                        canEditBill(item)
                          ? () =>
                              setEditing({
                                transactionId: item.sourceId,
                                type: "EXPENSE",
                                description: item.description,
                                amountCents: item.amountCents,
                                dueDate: item.dueDate ?? today,
                                categoryId: item.categoryId ?? "",
                                accountId: item.accountId ?? defaultAccountId,
                                status: item.status ?? "PLANNED",
                                recurring: item.origin === "RECURRING",
                              })
                          : undefined
                      }
                      statusControl={
                        <PlannerStatusToggle
                          kind="expense"
                          visualStatus={item.visualStatus}
                          canPay={item.canPay && canSettleBill(item)}
                          transactionId={canSettleBill(item) ? item.sourceId : undefined}
                          accountId={defaultAccountId}
                          amountCents={item.amountCents}
                          paidAt={today}
                          year={board.year}
                          month={board.month}
                        />
                      }
                    />
                  ))}
            </ul>
          </div>
        )}
      </div>

      {editing ? (
        <PlannerEditDialog
          key={editing.transactionId}
          item={editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function PlannerListControls({
  kind,
  filter,
  sort,
  onFilter,
  onSort,
}: {
  kind: "income" | "expense";
  filter: PlannerListFilter;
  sort: PlannerListSort;
  onFilter: (value: PlannerListFilter) => void;
  onSort: (value: PlannerListSort) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtro da lista">
        <ControlChip selected={filter === "ALL"} onClick={() => onFilter("ALL")} testId="planner-filter-all">
          Todas
        </ControlChip>
        <ControlChip selected={filter === "UNPAID"} onClick={() => onFilter("UNPAID")} testId="planner-filter-unpaid">
          {kind === "income" ? "Falta receber" : "Falta pagar"}
        </ControlChip>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ordenação da lista">
        <ControlChip selected={sort === "DATE"} onClick={() => onSort("DATE")} testId="planner-sort-date">
          Data
        </ControlChip>
        <ControlChip selected={sort === "PAID_FIRST"} onClick={() => onSort("PAID_FIRST")} testId="planner-sort-paid">
          {kind === "income" ? "Recebidas primeiro" : "Pagas primeiro"}
        </ControlChip>
        <ControlChip selected={sort === "AMOUNT_ASC"} onClick={() => onSort("AMOUNT_ASC")} testId="planner-sort-amount">
          Menor valor
        </ControlChip>
      </div>
    </div>
  );
}

function ControlChip({
  selected,
  onClick,
  testId,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  testId: string;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={testId}
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-[0.8125rem] transition-colors",
        selected
          ? "border-border bg-card font-medium text-foreground shadow-[0_1px_2px_rgba(26,29,35,0.04)]"
          : "border-transparent bg-transparent text-muted-foreground hover:bg-card hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TabButton({
  selected,
  tone,
  count,
  onClick,
  children,
}: {
  selected: boolean;
  tone: "income" | "expense";
  count: number;
  onClick: () => void;
  children: string;
}) {
  const Icon = tone === "income" ? TrendingUp : TrendingDown;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn(
        "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm transition-colors",
        selected && "font-semibold",
        selected && tone === "income" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        selected && tone === "expense" && "border-rose-200 bg-rose-50 text-rose-800",
        !selected && "border-transparent bg-transparent text-muted-foreground hover:bg-card hover:text-foreground",
      )}
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {children}
      <span
        className={cn(
          "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] tabular-nums",
          selected && tone === "income" && "bg-emerald-100/80",
          selected && tone === "expense" && "bg-rose-100/80",
          !selected && "bg-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function canSettleBill(item: PlanningBillRow) {
  return (
    item.origin === "LEDGER" ||
    item.origin === "RECURRING" ||
    (item.origin === "INVESTMENT" && !item.id.startsWith("investment:"))
  );
}

function canEditBill(item: PlanningBillRow) {
  return canSettleBill(item);
}
