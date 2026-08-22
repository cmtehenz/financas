import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeInternalPath } from "@/lib/safe-redirect";

const AUTH_PATHS = new Set(["/login", "/cadastro", "/recuperar-acesso"]);

function isAppPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/movimentacoes") ||
    pathname.startsWith("/orcamento")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  if (isAppPath(pathname) && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", getSafeInternalPath(pathname));
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PATHS.has(pathname) && sessionCookie) {
    const next = getSafeInternalPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/configuracoes/:path*",
    "/movimentacoes",
    "/movimentacoes/:path*",
    "/orcamento",
    "/orcamento/:path*",
    "/login",
    "/cadastro",
    "/recuperar-acesso",
  ],
};
