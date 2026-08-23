const PROJECT_HOST_PREFIX = "financeiro-familiar";

function hostnameOf(value: string) {
  return value.replace(/^https?:\/\//, "").split("/")[0] ?? "";
}

function originFromUrl(value: string) {
  return new URL(value).origin;
}

function originFromHost(host: string) {
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return originFromUrl(host);
  }

  return `https://${host}`;
}

function isLocalhostUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function isAllowedVercelHost(hostname: string, projectName = PROJECT_HOST_PREFIX) {
  if (!hostname.endsWith(".vercel.app")) {
    return false;
  }

  return hostname === `${projectName}.vercel.app` || hostname.startsWith(`${projectName}-`);
}

export function vercelDeploymentOrigin(env: Record<string, string | undefined> = process.env) {
  const host = env.VERCEL_URL;
  if (!host) {
    return undefined;
  }

  const hostname = hostnameOf(host);
  if (!hostname.endsWith(".vercel.app")) {
    return undefined;
  }

  return `https://${hostname}`;
}

export function productionDeploymentOrigin(env: Record<string, string | undefined> = process.env) {
  const host = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!host) {
    return undefined;
  }

  try {
    return originFromHost(host);
  } catch {
    return undefined;
  }
}

export function getAppBaseUrl(
  configuredUrl?: string,
  env: Record<string, string | undefined> = process.env,
) {
  const vercelOrigin = vercelDeploymentOrigin(env);
  const productionOrigin = productionDeploymentOrigin(env);
  const configuredIsLocal = !configuredUrl || isLocalhostUrl(configuredUrl);

  if (env.VERCEL_ENV === "preview") {
    return vercelOrigin ?? configuredUrl ?? "http://localhost:3000";
  }

  if (env.VERCEL_ENV === "production") {
    return (configuredIsLocal ? undefined : configuredUrl) ?? productionOrigin ?? vercelOrigin ?? configuredUrl ?? "http://localhost:3000";
  }

  return configuredUrl ?? vercelOrigin ?? "http://localhost:3000";
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

  const productionOrigin = productionDeploymentOrigin(env);
  if (productionOrigin) {
    origins.add(productionOrigin);
  }

  const extras = env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? [];
  for (const extra of extras) {
    const trimmed = extra.trim();
    if (!trimmed) {
      continue;
    }

    try {
      origins.add(originFromUrl(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`));
    } catch {
      // Skip invalid extra origins instead of widening trust.
    }
  }

  return [...origins];
}
