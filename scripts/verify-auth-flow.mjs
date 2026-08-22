const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const stamp = Date.now();
const email = `fase1.dev.${stamp}@example.com`;
const password = `DevTest-${stamp}-Aa1`;
const cookieJar = new Map();

function storeCookies(response) {
  const raw = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];

  for (const item of raw) {
    const [pair] = item.split(";");
    const [name, ...rest] = pair.split("=");
    if (name) {
      cookieJar.set(name.trim(), rest.join("="));
    }
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });

  storeCookies(response);
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { status: response.status, hasJson: Boolean(json), keys: json ? Object.keys(json) : [] };
}

const signup = await request("/api/auth/sign-up/email", {
  method: "POST",
  body: { name: "Usuario Fase 1", email, password },
});

const sessionAfterSignup = await request("/api/auth/get-session");

const signout = await request("/api/auth/sign-out", { method: "POST" });
cookieJar.clear();

const sessionAfterSignout = await request("/api/auth/get-session");

const signin = await request("/api/auth/sign-in/email", {
  method: "POST",
  body: { email, password },
});

const sessionAfterSignin = await request("/api/auth/get-session");

console.log(
  JSON.stringify({
    signupStatus: signup.status,
    sessionAfterSignup: sessionAfterSignup.status,
    signoutStatus: signout.status,
    sessionAfterSignout: sessionAfterSignout.status,
    signinStatus: signin.status,
    sessionAfterSignin: sessionAfterSignin.status,
    cookieCountAfterSignin: cookieJar.size,
  }),
);

if (signup.status >= 400 || signin.status >= 400) {
  process.exit(1);
}
