import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const password = "CasaTeste@123";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.test`;
}

async function signUpAndOnboard(page: Page, name: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Crie a Casa" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Nome da Casa").fill("Casa Planejamento");
  await page.getByRole("button", { name: "Criar Casa" }).click();
  await expect(page.getByRole("heading", { name: "Contas e saldos" })).toBeVisible();
  await page.getByLabel("Nome").fill("Carteira");
  await page.getByLabel("Saldo inicial").fill("1000,00");
  await page.getByRole("button", { name: "Adicionar conta" }).click();
  await page.getByRole("link", { name: "Continuar" }).click();
  await page.getByRole("link", { name: "Pular por agora" }).click();
  await page.getByRole("button", { name: "Concluir e ir ao início" }).click();
  await expect(page.getByTestId("available-balance")).toHaveText("R$ 1.000,00");
}

test("monthly planning keeps the selected month and works on mobile tabs", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "Gustavo Planejamento", uniqueEmail("p42-owner"));

  await page.goto("/planejamento?ano=2026&mes=9");
  await expect(page.getByRole("heading", { name: "Planejamento" })).toBeVisible();
  await expect(page).toHaveURL(/ano=2026&mes=9/);
  await expect(page.getByTestId("planning-year")).toHaveText("2026");
  await expect(page.getByTestId("planning-month-9")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("planning-empty")).toBeVisible();

  await page.getByTestId("planning-next-year").click();
  await expect(page).toHaveURL(/ano=2027&mes=9/);
  await expect(page.getByTestId("planning-year")).toHaveText("2027");

  await page.getByTestId("planning-month-2").click();
  await expect(page).toHaveURL(/ano=2027&mes=2/);
  await page.reload();
  await expect(page).toHaveURL(/ano=2027&mes=2/);
  await expect(page.getByTestId("planning-month-2")).toHaveAttribute("aria-current", "page");

  await page.goto("/planejamento?ano=2026&mes=9");
  const incomes = page.getByTestId("planning-incomes");
  await incomes.getByText("Criar entrada").click();
  await incomes.getByLabel("Descrição").fill("Salário setembro");
  await incomes.getByLabel("Valor", { exact: true }).fill("24000,00");
  await incomes.getByLabel("Categoria").selectOption({ label: "Salário" });
  await incomes.getByRole("button", { name: "Salvar movimentação" }).click();
  await expect(page.getByText("Salário setembro")).toBeVisible();
  await expect(page.getByTestId("planning-planned-income")).toHaveText("R$ 24.000,00");

  const bills = page.getByTestId("planning-bills");
  await bills.getByText("Criar conta").click();
  await bills.getByLabel("Descrição").fill("Aluguel");
  await bills.getByLabel("Valor", { exact: true }).fill("3000,00");
  await bills.getByLabel("Categoria").selectOption({ label: "Moradia" });
  await bills.getByRole("button", { name: "Salvar movimentação" }).click();
  await expect(page.getByText("Aluguel")).toBeVisible();
  await expect(page.getByTestId("planning-planned-balance")).toHaveText("R$ 21.000,00");

  if (testInfo.project.name === "mobile-chrome") {
    const tabs = page.getByTestId("planning-month-tabs");
    await expect(tabs).toBeVisible();
    await tabs.evaluate((node) => {
      node.scrollLeft = node.scrollWidth;
    });
    await expect(page.getByTestId("planning-month-12")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Planejamento" })).toBeVisible();
  }
});
