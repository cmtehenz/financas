const FALLBACK = "/dashboard";

const ALLOWED_PATH =
  /^\/(dashboard|onboarding(?:\/(?:contas|convite|revisao))?|configuracoes|movimentacoes(?:\/[A-Za-z0-9_-]+)?|orcamento|cartoes(?:\/[A-Za-z0-9_-]+(?:\/compras\/nova)?)?|dividas(?:\/[A-Za-z0-9_-]+)?|convite\/[A-Za-z0-9_-]{16,})(?:\/)?$/;

export function getSafeInternalPath(
  value: string | null | undefined,
  fallback = FALLBACK,
) {
  if (!value) {
    return fallback;
  }

  const path = value.trim();

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.includes("://") ||
    path.includes("@") ||
    path.includes("\n") ||
    path.includes("\r")
  ) {
    return fallback;
  }

  const [pathname] = path.split("?");

  if (!pathname || !ALLOWED_PATH.test(pathname)) {
    return fallback;
  }

  return pathname;
}
