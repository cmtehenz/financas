const TEST_BRANCH_MARKERS = /\b(test|preview|vitest)\b/i;

function normalizeConnectionString(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
}

function connectionHaystack(value: string, branchName?: string) {
  try {
    const url = new URL(value);
    return `${url.hostname} ${url.username} ${url.pathname} ${url.search} ${branchName ?? ""}`;
  } catch {
    return `${value} ${branchName ?? ""}`;
  }
}

export function isIdentifiedTestDatabase(
  testUrl: string,
  primaryUrl?: string,
  branchName = process.env.TEST_DATABASE_BRANCH,
) {
  if (!testUrl.trim()) {
    return false;
  }

  if (primaryUrl && normalizeConnectionString(testUrl) === normalizeConnectionString(primaryUrl)) {
    return false;
  }

  return TEST_BRANCH_MARKERS.test(connectionHaystack(testUrl, branchName));
}

export function requireTestDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const testUrl = env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required for tests that write to the database. Create a Neon branch named test or preview and set TEST_DATABASE_URL plus TEST_DATABASE_BRANCH in .env.local.",
    );
  }

  const primaryUrl = env.FINANCEIRO_PRIMARY_DATABASE_URL ?? env.DATABASE_URL;
  if (!isIdentifiedTestDatabase(testUrl, primaryUrl, env.TEST_DATABASE_BRANCH)) {
    throw new Error(
      "TEST_DATABASE_URL must target a database identified as test or preview and must not match DATABASE_URL.",
    );
  }

  return testUrl;
}

export function applyTestDatabaseEnv(env: NodeJS.ProcessEnv = process.env) {
  if (env.FINANCEIRO_TEST_DB_APPLIED === "1" && env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const testUrl = requireTestDatabaseUrl(env);
  if (env.DATABASE_URL && !env.FINANCEIRO_PRIMARY_DATABASE_URL) {
    env.FINANCEIRO_PRIMARY_DATABASE_URL = env.DATABASE_URL;
  }
  env.DATABASE_URL = testUrl;
  env.FINANCEIRO_TEST_DB_APPLIED = "1";
  return testUrl;
}
