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
  await page.getByLabel("Nome da Casa").fill("Casa Fase 4");
  await page.getByRole("button", { name: "Criar Casa" }).click();
  await expect(page.getByRole("heading", { name: "Contas e saldos" })).toBeVisible();
  await page.getByLabel("Nome").fill("Carteira");
  await page.getByLabel("Saldo inicial").fill("10000,00");
  await page.getByRole("button", { name: "Adicionar conta" }).click();
  await page.getByRole("link", { name: "Continuar" }).click();
  await page.getByRole("link", { name: "Pular por agora" }).click();
  await page.getByRole("button", { name: "Concluir e ir ao início" }).click();
  await expect(page.getByTestId("available-balance")).toHaveText("R$ 10.000,00");
}

test("cards, statements and debts stay exact on desktop and mobile", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "Gustavo Fase 4", uniqueEmail("p4-owner"));

  await page.goto("/cartoes/novo");
  await page.getByLabel("Nome").fill("Nubank");
  await page.getByLabel("Emissor").fill("Nubank");
  await page.getByLabel("Limite").fill("5000,00");
  await page.getByLabel("Dia de fechamento").fill("10");
  await page.getByLabel("Dia de vencimento").fill("17");
  await page.getByRole("button", { name: "Salvar cartão" }).click();
  await expect(page.getByRole("heading", { name: "Nubank" })).toBeVisible();

  await page.getByRole("link", { name: "Nova compra" }).click();
  await page.getByLabel("Descrição").fill("Farmácia à vista");
  await page.getByLabel("Valor total").fill("80,00");
  await page.getByLabel("Categoria").selectOption({ label: "Saúde" });
  await page.getByLabel("Parcelas").fill("1");
  await page.getByRole("button", { name: "Salvar compra" }).click();
  await expect(page.getByText("Farmácia à vista")).toBeVisible();

  await page.getByRole("link", { name: "Nova compra" }).click();
  await page.getByLabel("Descrição").fill("Notebook parcelado");
  await page.getByLabel("Valor total").fill("1200,00");
  await page.getByLabel("Categoria").selectOption({ label: "Compras" });
  await page.getByLabel("Parcelas").fill("12");
  await expect(page.getByText(/^1\/12 ·/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar compra" }).click();
  await expect(page.getByText("Notebook parcelado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("future-statements")).toBeVisible();

  await expect(page.getByText(/pendente/).first()).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Valor").first().fill("40,00");
  await page.getByRole("button", { name: "Pagar fatura" }).first().click();
  await expect(page.getByText("Pagamento registrado.")).toBeVisible({ timeout: 20_000 });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Valor").first().fill("140,00");
  await page.getByRole("button", { name: "Pagar fatura" }).first().click();
  await expect(page.getByText("Pagamento registrado.")).toBeVisible({ timeout: 20_000 });

  await page.goto("/dividas/nova");
  await page.getByLabel("Nome").fill("Empréstimo pessoal");
  await page.getByLabel("Credor").fill("Banco Teste");
  await page.getByLabel("Valor original").fill("600,00");
  await page.getByLabel("Saldo atual").fill("600,00");
  await page.getByLabel("Parcela", { exact: true }).fill("200,00");
  await page.getByLabel("Quantidade de parcelas").fill("3");
  await page.getByRole("button", { name: "Salvar dívida" }).click();
  await expect(page.getByTestId("debt-outstanding")).toHaveText("R$ 600,00");
  await page.getByRole("button", { name: "Pagar parcela" }).first().click();
  await expect(page.getByTestId("debt-outstanding")).toHaveText("R$ 400,00");

  await page.goto("/dashboard");
  await expect(page.getByTestId("available-balance")).not.toHaveText("R$ —");
  await expect(page.getByTestId("debt-total")).toBeVisible();
});
