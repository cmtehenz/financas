"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { completeOnboardingAction } from "@/actions/household";
import { Button } from "@/components/ui/button";

export function CompleteOnboardingButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onComplete() {
    setPending(true);

    try {
      const result = await completeOnboardingAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Casa pronta.");
      router.push("/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" className="h-11 w-full" disabled={pending} onClick={onComplete}>
      {pending ? "Concluindo..." : "Concluir e ir ao início"}
    </Button>
  );
}
