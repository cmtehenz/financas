import { AppHeader } from "@/features/app/app-header";
import { getActiveHousehold } from "@/lib/require-household";
import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const active = await getActiveHousehold(session.user.id);
  const completed = Boolean(active?.household.onboardingCompletedAt);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader householdName={active?.household.name} showNav={completed} />
      {children}
    </div>
  );
}
