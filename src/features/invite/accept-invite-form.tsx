"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { acceptInvitationAction } from "@/actions/invitations";
import { Button } from "@/components/ui/button";

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onAccept() {
    setPending(true);

    try {
      const result = await acceptInvitationAction({ token });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Você entrou na Casa.");
      router.push("/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" className="h-11 w-full" disabled={pending} onClick={onAccept}>
      {pending ? "Entrando..." : "Aceitar convite"}
    </Button>
  );
}
