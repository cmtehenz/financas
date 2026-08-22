"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { upsertBudgetAction, upsertCategoryLimitsAction } from "@/actions/budgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCentsInput } from "@/lib/money";

export function BudgetTotalsForm({
  year,
  month,
  expectedIncome,
  plannedInvestment,
}: {
  year: number;
  month: number;
  expectedIncome: bigint;
  plannedInvestment: bigint;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await upsertBudgetAction({
        year,
        month,
        expectedIncome: String(formData.get("expectedIncome") ?? "0"),
        plannedInvestment: String(formData.get("plannedInvestment") ?? "0"),
        notes: String(formData.get("notes") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Orçamento atualizado.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" action={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expectedIncome">Renda prevista</Label>
          <Input
            id="expectedIncome"
            name="expectedIncome"
            className="h-11"
            defaultValue={formatCentsInput(expectedIncome)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plannedInvestment">Investimento planejado</Label>
          <Input
            id="plannedInvestment"
            name="plannedInvestment"
            className="h-11"
            defaultValue={formatCentsInput(plannedInvestment)}
          />
        </div>
      </div>
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Salvando..." : "Salvar orçamento"}
      </Button>
    </form>
  );
}

export function CategoryLimitsForm({
  year,
  month,
  categories,
}: {
  year: number;
  month: number;
  categories: Array<{ categoryId: string; name: string; limitCents: bigint }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await upsertCategoryLimitsAction({
        year,
        month,
        limits: categories.map((category) => ({
          categoryId: category.categoryId,
          limit: String(formData.get(`limit-${category.categoryId}`) ?? "0"),
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Limites atualizados.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" action={onSubmit}>
      <div className="space-y-3">
        {categories.map((category) => (
          <div key={category.categoryId} className="grid gap-2 sm:grid-cols-[1fr_8rem]">
            <Label htmlFor={`limit-${category.categoryId}`} className="self-center">
              {category.name}
            </Label>
            <Input
              id={`limit-${category.categoryId}`}
              name={`limit-${category.categoryId}`}
              className="h-11"
              defaultValue={formatCentsInput(category.limitCents)}
            />
          </div>
        ))}
      </div>
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Salvando..." : "Salvar limites"}
      </Button>
    </form>
  );
}
