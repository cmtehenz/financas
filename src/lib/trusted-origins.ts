export function getTrustedOrigins(appUrl: string) {
  const origins = new Set<string>([appUrl]);

  try {
    const url = new URL(appUrl);
    const port = url.port ? `:${url.port}` : "";

    if (url.hostname === "localhost") {
      origins.add(`${url.protocol}//127.0.0.1${port}`);
    }

    if (url.hostname === "127.0.0.1") {
      origins.add(`${url.protocol}//localhost${port}`);
    }
  } catch {
    // Ignore invalid URLs; Better Auth will validate the primary base URL.
  }

  return [...origins];
}
