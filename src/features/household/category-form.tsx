"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createCategoryAction, deactivateCategoryAction } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_KIND_LABELS, CATEGORY_KINDS } from "@/domain/transaction-types";

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function CategoryForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await createCategoryAction({
        name: String(formData.get("name") ?? ""),
        type: String(formData.get("type") ?? "EXPENSE"),
        kind: String(formData.get("kind") ?? "OTHER"),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Categoria criada.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" action={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="category-name">Nome</Label>
        <Input id="category-name" name="name" className="h-11" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="type" className={selectClassName} defaultValue="EXPENSE">
          <option value="INCOME">Receita</option>
          <option value="EXPENSE">Despesa</option>
        </select>
        <select name="kind" className={selectClassName} defaultValue="OTHER">
          {CATEGORY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {CATEGORY_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Salvando..." : "Adicionar categoria"}
      </Button>
    </form>
  );
}

export function DeactivateCategoryButton({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await deactivateCategoryAction({ categoryId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Categoria desativada.");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      Desativar
    </Button>
  );
}
