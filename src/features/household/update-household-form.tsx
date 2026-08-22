"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateHouseholdAction } from "@/actions/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateHouseholdSchema, type UpdateHouseholdInput } from "@/lib/validations/household";

export function UpdateHouseholdForm({ name }: { name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<UpdateHouseholdInput>({
    resolver: zodResolver(updateHouseholdSchema),
    defaultValues: { name },
  });

  async function onSubmit(values: UpdateHouseholdInput) {
    setPending(true);

    try {
      const result = await updateHouseholdAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Casa atualizada.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="settings-household-name">Nome da Casa</Label>
        <Input id="settings-household-name" className="h-11" {...form.register("name")} />
      </div>
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
