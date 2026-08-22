import { expect, test } from "@playwright/test";

test("login page renders in Portuguese", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("signup page renders required fields", async ({ page }) => {
  await page.goto("/cadastro");

  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
  await expect(page.getByLabel("Nome")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirmar senha")).toBeVisible();
});

test("password recovery page explains disabled email", async ({ page }) => {
  await page.goto("/recuperar-acesso");

  await expect(page.getByRole("heading", { name: "Recuperar acesso" })).toBeVisible();
  await expect(page.getByText(/envio de e-mail está desativado/i)).toBeVisible();
});

test("health check does not require OpenAI", async ({ request }) => {
  const response = await request.get("/api/health");
  const body = await response.json();

  expect(response.ok()).toBeTruthy();
  expect(body.checks.ai).toBe("disabled");
});
