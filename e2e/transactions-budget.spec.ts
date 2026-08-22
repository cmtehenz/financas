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
  await page.getByLabel("Nome da Casa").fill("Casa Fase 3");
  await page.getByRole("button", { name: "Criar Casa" }).click();
  await expect(page.getByRole("heading", { name: "Contas e saldos" })).toBeVisible();
  await page.getByLabel("Nome").fill("Carteira");
  await page.getByLabel("Saldo inicial").fill("1000,00");
  await page.getByRole("button", { name: "Adicionar conta" }).click();
  await expect(page.getByText("R$ 1.000,00")).toBeVisible();
  await page.getByLabel("Nome").fill("Banco");
  await page.getByLabel("Saldo inicial").fill("500,00");
  await page.getByRole("button", { name: "Adicionar conta" }).click();
  await page.getByRole("link", { name: "Continuar" }).click();
  await page.getByRole("link", { name: "Pular por agora" }).click();
  await page.getByRole("button", { name: "Concluir e ir ao início" }).click();
  await expect(page.getByTestId("available-balance")).toHaveText("R$ 1.500,00");
}

test("transactions, budget and dashboard stay exact on desktop and mobile", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "Gustavo Fase 3", uniqueEmail("p3-owner"));

  await page.goto("/movimentacoes");
  await expect(page.getByRole("heading", { name: "Movimentações" })).toBeVisible();
  await page.getByRole("link", { name: "Nova movimentação" }).click();
  await page.getByText("Receita", { exact: true }).click();
  await page.getByLabel("Descrição").fill("Salário agosto");
  await page.getByLabel("Valor").fill("200,00");
  await page.getByLabel("Categoria").selectOption({ label: "Salário" });
  await page.getByLabel("Situação").selectOption("PAID");
  await page.getByRole("button", { name: "Salvar movimentação" }).click();
  await expect(page.getByText("Salário agosto")).toBeVisible();

  await page.getByRole("link", { name: "Nova movimentação" }).click();
  await page.getByText("Despesa", { exact: true }).click();
  await page.getByLabel("Descrição").fill("Mercado da semana");
  await page.getByLabel("Valor").fill("50,00");
  await page.getByLabel("Categoria").selectOption({ label: "Mercado" });
  await page.getByLabel("Situação").selectOption("PENDING");
  await page.getByRole("button", { name: "Salvar movimentação" }).click();
  await expect(page.getByText("Mercado da semana")).toBeVisible();
  await page.getByRole("button", { name: "Marcar como paga" }).first().click();

  await page.getByRole("link", { name: "Nova movimentação" }).click();
  await page.getByText("Transferência", { exact: true }).click();
  await page.getByLabel("Descrição").fill("Reforço da carteira");
  await page.getByLabel("Valor").fill("80,00");
  await page.getByLabel("Conta de origem").selectOption({ label: "Banco" });
  await page.getByLabel("Conta de destino").selectOption({ label: "Carteira" });
  await page.getByLabel("Situação").selectOption("PAID");
  await page.getByRole("button", { name: "Salvar movimentação" }).click();
  await expect(page.getByText("Reforço da carteira")).toBeVisible();

  await page.getByRole("link", { name: "Nova movimentação" }).click();
  await page.getByText("Despesa", { exact: true }).click();
  await page.getByLabel("Descrição").fill("Internet mensal");
  await page.getByLabel("Valor").fill("120,00");
  await page.getByLabel("Categoria").selectOption({ label: "Internet" });
  await page.locator("label").filter({ hasText: "Recorrência mensal" }).click();
  await page.getByLabel("Dia do vencimento").fill("10");
  await page.getByRole("button", { name: "Salvar movimentação" }).click();
  await expect(page.getByText("Internet mensal")).toBeVisible();

  await page.goto("/orcamento");
  await expect(page.getByRole("heading", { name: "Orçamento" })).toBeVisible();
  await page.getByLabel("Renda prevista").fill("3000,00");
  await page.getByLabel("Investimento planejado").fill("400,00");
  await page.getByRole("button", { name: "Salvar orçamento" }).click();
  await expect(page.getByTestId("planned-investment")).toHaveText("R$ 400,00");
  await page.getByLabel("Mercado").fill("200,00");
  await page.getByRole("button", { name: "Salvar limites" }).click();
  await expect(page.locator("li").filter({ hasText: "Mercado" }).getByText("R$ 200,00")).toBeVisible({
    timeout: 20_000,
  });

  await page.goto("/dashboard");
  await expect(page.getByTestId("available-balance")).not.toHaveText("R$ —");
  await expect(page.getByTestId("account-balance-Carteira")).toBeVisible();
  await expect(page.getByTestId("account-balance-Banco")).toBeVisible();

  await page.goto("/movimentacoes");
  await page.locator("select[name='tipo']").selectOption("TRANSFER");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText("Reforço da carteira")).toBeVisible();
  await expect(page.getByText("Salário agosto")).toHaveCount(0);
});
