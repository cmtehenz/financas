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
  await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planejamento" })).toHaveCount(0);
  await expect(page.getByText("Criar entrada")).toHaveCount(0);
  await expect(page.getByText("Criar conta")).toHaveCount(0);
  await expect(page.getByTestId("planner-add-button")).toBeVisible();
  await expect(page.getByText("Copiar mês anterior")).toBeVisible();
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
  await page.getByTestId("planner-add-button").click();
  const firstDialog = page.getByRole("dialog");
  await expect(firstDialog.getByRole("heading", { name: "Novo lançamento" })).toBeVisible();
  await firstDialog.getByRole("button", { name: "Receita" }).click();
  await firstDialog.getByLabel("Descrição").fill("Salário setembro");
  await firstDialog.getByLabel("Valor").fill("24000,00");
  await firstDialog.getByLabel("Categoria").selectOption({ label: "Salário" });
  await firstDialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Salário setembro")).toBeVisible();
  await expect(page.getByTestId("planning-planned-income")).toHaveText("R$ 24.000,00");

  await page.getByTestId("planner-add-button").click();
  const secondDialog = page.getByRole("dialog");
  await secondDialog.getByRole("button", { name: "Despesa" }).click();
  await expect(secondDialog.getByLabel("Repetir mensalmente")).toBeVisible();
  await expect(secondDialog.getByRole("button", { name: "Adicionar" })).toBeVisible();
  await secondDialog.getByLabel("Descrição").fill("Aluguel");
  await secondDialog.getByLabel("Valor").fill("3000,00");
  await secondDialog.getByLabel("Categoria").selectOption({ label: "Moradia" });
  await secondDialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Salário setembro")).toBeVisible();
  await page.getByRole("tab", { name: /Despesas/ }).click();
  await expect(page.getByText("Aluguel")).toBeVisible();
  await expect(page.getByText("Destino:")).toHaveCount(0);
  await expect(page.getByText("Origem:")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editar lançamento" }).first()).toBeVisible();
  await expect(page.getByTestId("planning-planned-balance")).toHaveText("R$ 21.000,00");
  await expect(page.getByTestId("planning-remaining")).toHaveText("R$ 3.000,00");
  await expect(page.getByTestId("planner-status-toggle")).toHaveText(/Não paga/);

  await page.getByTestId("planner-status-toggle").click();
  await expect(page.getByTestId("planner-status-toggle")).toHaveText(/Paga/, { timeout: 15_000 });
  await expect(page.getByTestId("planning-paid-total")).toHaveText("R$ 3.000,00");
  await expect(page.getByTestId("planning-remaining")).toHaveText("R$ 0,00");
  await expect(page).toHaveURL(/ano=2026&mes=9/);
  await expect(page.getByRole("tab", { name: /Despesas/ })).toHaveAttribute("aria-selected", "true");

  await page.getByTestId("planner-status-toggle").click();
  await expect(page.getByTestId("planner-status-toggle")).toHaveText(/Não paga/, { timeout: 15_000 });
  await expect(page.getByTestId("planning-paid-total")).toHaveText("R$ 0,00");
  await expect(page.getByTestId("planning-remaining")).toHaveText("R$ 3.000,00");

  await page.getByRole("tab", { name: /Receitas/ }).click();
  await expect(page.getByTestId("planner-status-toggle")).toHaveText(/Não recebida/);
  await page.getByTestId("planner-status-toggle").click();
  await expect(page.getByTestId("planner-status-toggle")).toHaveText(/Recebida/, { timeout: 15_000 });
  await expect(page.getByTestId("planning-received-income")).toHaveText("R$ 24.000,00");
  await expect(page).toHaveURL(/ano=2026&mes=9/);
  await expect(page.getByRole("tab", { name: /Receitas/ })).toHaveAttribute("aria-selected", "true");

  await page.getByTestId("planner-add-button").click();
  const recurringDialog = page.getByRole("dialog");
  await recurringDialog.getByRole("button", { name: "Despesa" }).click();
  await expect(recurringDialog.getByLabel("Repetir mensalmente")).toBeVisible();
  await recurringDialog.getByLabel("Descrição").fill("Guarda");
  await recurringDialog.getByLabel("Valor").fill("40,00");
  await recurringDialog.getByLabel("Categoria").selectOption({ label: "Moradia" });
  await recurringDialog.getByLabel("Repetir mensalmente").check();
  await recurringDialog.getByRole("button", { name: "Adicionar" }).click();
  await page.getByRole("tab", { name: /Despesas/ }).click();
  await expect(page.getByText("Guarda")).toBeVisible();
  const billRows = page.getByTestId("planning-bills").locator("li");
  await page.getByTestId("planner-sort-amount").click();
  await expect(billRows.nth(0)).toContainText("Guarda");
  await expect(billRows.nth(1)).toContainText("Aluguel");
  await page.locator("li", { hasText: "Aluguel" }).getByTestId("planner-status-toggle").click();
  await expect(page.locator("li", { hasText: "Aluguel" }).getByTestId("planner-status-toggle")).toHaveText(/Paga/, {
    timeout: 15_000,
  });
  await page.getByTestId("planner-sort-paid").click();
  await expect(billRows.nth(0)).toContainText("Aluguel");
  await page.getByTestId("planner-filter-unpaid").click();
  await expect(page.getByText("Guarda")).toBeVisible();
  await expect(page.getByText("Aluguel")).toHaveCount(0);
  await page.getByTestId("planner-filter-all").click();
  await expect(page.getByText("Aluguel")).toBeVisible();
  await page.getByTestId("planner-sort-date").click();
  await page.locator("li", { hasText: "Aluguel" }).getByTestId("planner-status-toggle").click();
  await expect(page.locator("li", { hasText: "Aluguel" }).getByTestId("planner-status-toggle")).toHaveText(/Não paga/, {
    timeout: 15_000,
  });
  if (testInfo.project.name === "mobile-chrome") {
    await expect(page.getByLabel("Recorrente")).toBeVisible();
  } else {
    await expect(page.getByText("Recorrente")).toBeVisible();
  }

  await page.locator("li", { hasText: "Aluguel" }).getByRole("button", { name: "Editar lançamento" }).click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog.getByRole("heading", { name: "Editar lançamento" })).toBeVisible();
  await expect(editDialog.getByLabel("Somente este")).toHaveCount(0);
  await editDialog.getByLabel("Descrição").fill("Aluguel apto");
  await editDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/ano=2026&mes=9/);
  await expect(page.getByText("Aluguel apto")).toBeVisible();

  await page.locator("li", { hasText: "Guarda" }).getByRole("button", { name: "Editar lançamento" }).click();
  const recurringEdit = page.getByRole("dialog");
  await expect(recurringEdit.getByLabel("Somente este")).toBeVisible();
  await expect(recurringEdit.getByLabel("Este e os próximos")).toBeVisible();
  await recurringEdit.getByLabel("Valor").fill("55,00");
  await recurringEdit.getByLabel("Este e os próximos").check();
  await recurringEdit.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("planning-bills").getByText("R$ 55,00")).toBeVisible();

  await page.getByTestId("planning-month-10").click();
  await expect(page).toHaveURL(/ano=2026&mes=10/);
  await page.getByRole("tab", { name: /Despesas/ }).click();
  await expect(page.getByText("Guarda")).toBeVisible();
  await expect(page.getByTestId("planning-bills").getByText("R$ 55,00")).toBeVisible();
  await page.getByTestId("planning-month-9").click();
  await expect(page).toHaveURL(/ano=2026&mes=9/);
  await page.getByRole("tab", { name: /Despesas/ }).click();

  await page.getByTestId("planner-add-button").click();
  const deleteDialog = page.getByRole("dialog");
  await deleteDialog.getByRole("button", { name: "Despesa" }).click();
  await deleteDialog.getByLabel("Descrição").fill("Lixo");
  await deleteDialog.getByLabel("Valor").fill("15,00");
  await deleteDialog.getByLabel("Categoria").selectOption({ label: "Moradia" });
  await deleteDialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("tab", { name: /Despesas/ }).click();
  await expect(page.getByText("Lixo")).toBeVisible();

  await page.locator("li", { hasText: "Lixo" }).getByRole("button", { name: "Editar lançamento" }).click();
  const removeDialog = page.getByRole("dialog");
  await expect(removeDialog.getByRole("button", { name: "Excluir" })).toBeVisible();
  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await removeDialog.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Lixo")).toHaveCount(0);
  await expect(page).toHaveURL(/ano=2026&mes=9/);

  if (testInfo.project.name === "mobile-chrome") {
    const tabs = page.getByTestId("planning-month-tabs");
    await expect(tabs).toBeVisible();
    await tabs.evaluate((node) => {
      node.scrollLeft = node.scrollWidth;
    });
    await expect(page.getByTestId("planning-month-12")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();
  }
});
