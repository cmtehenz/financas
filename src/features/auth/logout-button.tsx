"use client";

import { useTransition } from "react";

import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="h-10"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {pending ? "Saindo..." : "Sair"}
    </Button>
  );
}
