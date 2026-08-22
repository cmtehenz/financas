const PROJECT_HOST_PREFIX = "financeiro-familiar";

function originFromUrl(value: string) {
  return new URL(value).origin;
}

export function isAllowedVercelHost(hostname: string, projectName = PROJECT_HOST_PREFIX) {
  if (!hostname.endsWith(".vercel.app")) {
    return false;
  }

  return hostname === `${projectName}.vercel.app` || hostname.startsWith(`${projectName}-`);
}

export function vercelDeploymentOrigin(env: Record<string, string | undefined> = process.env) {
  const host = env.VERCEL_URL;
  if (!host || !isAllowedVercelHost(host, env.VERCEL_PROJECT_NAME ?? PROJECT_HOST_PREFIX)) {
    return undefined;
  }

  return `https://${host}`;
}

export function getAppBaseUrl(
  configuredUrl?: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (env.VERCEL_ENV === "preview") {
    return vercelDeploymentOrigin(env) ?? configuredUrl ?? "http://localhost:3000";
  }

  return configuredUrl ?? vercelDeploymentOrigin(env) ?? "http://localhost:3000";
}

export function getTrustedOrigins(
  appUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const origins = new Set<string>([originFromUrl(appUrl)]);

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

  const vercelOrigin = vercelDeploymentOrigin(env);
  if (vercelOrigin) {
    origins.add(vercelOrigin);
  }

  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionHost && isAllowedVercelHost(productionHost, env.VERCEL_PROJECT_NAME ?? PROJECT_HOST_PREFIX)) {
    origins.add(`https://${productionHost}`);
  }

  const extras = env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? [];
  for (const extra of extras) {
    const trimmed = extra.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const origin = originFromUrl(trimmed);
      const hostname = new URL(origin).hostname;
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        isAllowedVercelHost(hostname, env.VERCEL_PROJECT_NAME ?? PROJECT_HOST_PREFIX)
      ) {
        origins.add(origin);
      }
    } catch {
      // Skip invalid extra origins instead of widening trust.
    }
  }

  return [...origins];
}
