"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deactivateAccountAction } from "@/actions/accounts";
import { Button } from "@/components/ui/button";

export function DeactivateAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDeactivate() {
    setPending(true);

    try {
      const result = await deactivateAccountAction({ accountId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Conta desativada.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" className="h-10" disabled={pending} onClick={onDeactivate}>
      {pending ? "Desativando..." : "Desativar"}
    </Button>
  );
}
