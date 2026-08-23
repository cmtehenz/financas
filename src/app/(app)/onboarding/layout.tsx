import type { ReactNode } from "react";

import { PageShell } from "@/features/app/ui";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <PageShell width="narrow">{children}</PageShell>;
}
