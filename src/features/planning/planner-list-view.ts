export type PlannerListFilter = "ALL" | "UNPAID";
export type PlannerListSort = "DATE" | "PAID_FIRST" | "AMOUNT_ASC";

export type PlannerListItem = {
  id: string;
  visualStatus: string;
  amountCents: string;
  sortDate: string | null;
  description: string;
};

export function applyPlannerListView<T extends PlannerListItem>(
  items: T[],
  filter: PlannerListFilter,
  sort: PlannerListSort,
): T[] {
  const visible = filter === "UNPAID" ? items.filter((item) => item.visualStatus !== "PAGA") : items.slice();

  return visible.sort((left, right) => {
    if (sort === "PAID_FIRST") {
      const paidDiff = Number(right.visualStatus === "PAGA") - Number(left.visualStatus === "PAGA");
      if (paidDiff !== 0) {
        return paidDiff;
      }
    }

    if (sort === "AMOUNT_ASC") {
      const amountDiff = compareAmount(left.amountCents, right.amountCents);
      if (amountDiff !== 0) {
        return amountDiff;
      }
    }

    return compareDate(left.sortDate, right.sortDate) || left.description.localeCompare(right.description);
  });
}

function compareAmount(left: string, right: string) {
  const leftCents = BigInt(left || "0");
  const rightCents = BigInt(right || "0");
  if (leftCents === rightCents) {
    return 0;
  }
  return leftCents < rightCents ? -1 : 1;
}

function compareDate(left: string | null, right: string | null) {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  return left.localeCompare(right);
}
