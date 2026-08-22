"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createInvitationAction, revokeInvitationAction } from "@/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvitationSchema, type CreateInvitationInput } from "@/lib/validations/household";

export function InviteForm({
  canManage,
  pendingInvites,
}: {
  canManage: boolean;
  pendingInvites: Array<{ id: string; email: string; expiresAtLabel: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const form = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: { email: "" },
  });

  if (!canManage) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Somente quem administra a Casa pode gerar ou revogar convites.
      </p>
    );
  }

  async function onSubmit(values: CreateInvitationInput) {
    setPending(true);

    try {
      const result = await createInvitationAction(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const url = new URL(result.invitePath, window.location.origin).toString();
      setInviteUrl(url);
      toast.success("Convite gerado. Copie o link agora; ele não será mostrado de novo.");
      form.reset({ email: "" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Link copiado.");
  }

  async function revoke(invitationId: string) {
    setPending(true);

    try {
      const result = await revokeInvitationAction({ invitationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Convite revogado.");
      setInviteUrl(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="invite-email">E-mail da esposa</Label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="email"
            className="h-11"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Gerando..." : inviteUrl ? "Gerar novo convite" : "Gerar convite"}
        </Button>
      </form>
      {inviteUrl ? (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <Label htmlFor="invite-link">Link para compartilhar</Label>
          <Input id="invite-link" data-testid="invite-link" readOnly className="h-11" value={inviteUrl} />
          <Button type="button" variant="outline" className="h-11 w-full" onClick={copyLink}>
            Copiar link
          </Button>
        </div>
      ) : null}
      {pendingInvites.length > 0 ? (
        <ul className="space-y-3">
          {pendingInvites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-col gap-2 rounded-2xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{invite.email}</p>
                <p className="text-xs text-muted-foreground">Válido até {invite.expiresAtLabel}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                disabled={pending}
                onClick={() => revoke(invite.id)}
              >
                Revogar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
