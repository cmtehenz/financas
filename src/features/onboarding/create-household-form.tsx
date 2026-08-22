"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createHouseholdAction } from "@/actions/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createHouseholdSchema, type CreateHouseholdInput } from "@/lib/validations/household";

export function CreateHouseholdForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<CreateHouseholdInput>({
    resolver: zodResolver(createHouseholdSchema),
    defaultValues: {
      name: defaultName,
      currency: "BRL",
      timezone: "America/Sao_Paulo",
    },
  });

  async function onSubmit(values: CreateHouseholdInput) {
    setPending(true);

    try {
      const result = await createHouseholdAction(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Casa criada.");
      router.push("/onboarding/contas");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="household-name">Nome da Casa</Label>
        <Input id="household-name" className="h-11" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="currency">Moeda</Label>
          <Input id="currency" className="h-11" readOnly {...form.register("currency")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Fuso horário</Label>
          <Input id="timezone" className="h-11" readOnly {...form.register("timezone")} />
        </div>
      </div>
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Criando..." : "Criar Casa"}
      </Button>
    </form>
  );
}
