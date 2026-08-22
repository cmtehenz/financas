"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { requestPasswordResetAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordResetSchema,
  type RequestPasswordResetInput,
} from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const form = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: RequestPasswordResetInput) {
    setPending(true);

    try {
      const result = await requestPasswordResetAction(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Se o e-mail existir, o pedido foi registrado.");
      form.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-11"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        O envio de e-mail está desativado neste ambiente. O fluxo de recuperação
        fica preparado para quando o correio for configurado.
      </p>
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Enviando..." : "Solicitar acesso"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
