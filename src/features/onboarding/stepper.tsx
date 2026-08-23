import { cn } from "@/lib/utils";

const STEPS = [
  { href: "/onboarding", label: "Casa" },
  { href: "/onboarding/contas", label: "Contas" },
  { href: "/onboarding/convite", label: "Convite" },
  { href: "/onboarding/revisao", label: "Revisão" },
] as const;

export function OnboardingStepper({ current }: { current: (typeof STEPS)[number]["href"] }) {
  const currentIndex = STEPS.findIndex((step) => step.href === current);

  return (
    <ol className="grid grid-cols-4 gap-2 text-xs sm:text-sm">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <li
            key={step.href}
            className={cn(
              "rounded-full px-2 py-2 text-center",
              active && "bg-primary text-primary-foreground",
              done && "bg-muted text-foreground",
              !active && !done && "border border-border text-muted-foreground",
            )}
          >
            {index + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}
