import { redirect } from "next/navigation";

import { getOptionalSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getOptionalSession();
  redirect(session ? "/dashboard" : "/login");
}
