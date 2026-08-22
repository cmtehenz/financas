import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const password = "CasaTeste@123";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.test`;
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: /Crie a Casa|Entrar em / })).toBeVisible({
    timeout: 30_000,
  });
}

test("owner onboards, spouse joins, stranger is isolated", async ({ browser, page }) => {
  test.setTimeout(120_000);

  const ownerEmail = uniqueEmail("owner");
  const spouseEmail = uniqueEmail("spouse");
  const strangerEmail = uniqueEmail("stranger");

  await signUp(page, "Gustavo Teste", ownerEmail);
  await expect(page.getByRole("heading", { name: "Crie a Casa" })).toBeVisible();

  await page.getByLabel("Nome da Casa").fill("Casa Gustavo e Aline");
  await page.getByRole("button", { name: "Criar Casa" }).click();
  await expect(page.getByRole("heading", { name: "Contas e saldos" })).toBeVisible();

  await page.getByLabel("Nome").fill("Carteira");
  await page.getByLabel("Instituição").fill("Dinheiro");
  await page.getByLabel("Saldo inicial").fill("1500,50");
  await page.getByRole("button", { name: "Adicionar conta" }).click();
  await expect(page.getByText("R$ 1.500,50")).toBeVisible();
  await page.getByRole("link", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Convide sua esposa" })).toBeVisible();
  await page.getByLabel("E-mail da esposa").fill(spouseEmail);
  await page.getByRole("button", { name: "Gerar convite" }).click();
  const inviteLink = page.getByTestId("invite-link");
  await expect(inviteLink).toBeVisible();
  const inviteUrl = await inviteLink.inputValue();
  expect(inviteUrl).toContain("/convite/");

  await page.getByRole("link", { name: "Pular por agora" }).click();
  await expect(page.getByRole("heading", { name: "Revise a Casa" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Casa Gustavo e Aline" })).toBeVisible();
  await page.getByRole("button", { name: "Concluir e ir ao início" }).click();
  await expect(page.getByTestId("available-balance")).toHaveText("R$ 1.500,50");
  await expect(page.getByText("R$ —")).toHaveCount(0);

  const spouseContext = await browser.newContext();
  const spousePage = await spouseContext.newPage();
  await spousePage.goto(inviteUrl);
  await spousePage.getByRole("link", { name: "Criar conta" }).click();
  await spousePage.getByLabel("Nome").fill("Aline Teste");
  await spousePage.getByLabel("E-mail").fill(spouseEmail);
  await spousePage.getByLabel("Senha", { exact: true }).fill(password);
  await spousePage.getByLabel("Confirmar senha").fill(password);
  await spousePage.getByRole("button", { name: "Criar conta" }).click();
  await expect(spousePage.getByRole("heading", { name: /Entrar em Casa Gustavo e Aline/ })).toBeVisible();
  await spousePage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(spousePage.getByTestId("available-balance")).toHaveText("R$ 1.500,50");
  await expect(spousePage.getByRole("heading", { name: "Casa Gustavo e Aline" })).toBeVisible();

  const strangerContext = await browser.newContext();
  const strangerPage = await strangerContext.newPage();
  await signUp(strangerPage, "Terceiro Teste", strangerEmail);
  await expect(strangerPage.getByRole("heading", { name: "Crie a Casa" })).toBeVisible();
  await expect(strangerPage.getByRole("heading", { name: "Casa Gustavo e Aline" })).toHaveCount(0);

  const ownerCookies = await page.context().cookies();
  const householdCookie = ownerCookies.find((cookie) => cookie.name === "ff_active_household");
  if (householdCookie) {
    await strangerContext.addCookies([householdCookie]);
  }

  await strangerPage.goto("/dashboard");
  await expect(strangerPage.getByRole("heading", { name: "Crie a Casa" })).toBeVisible();
  await expect(strangerPage.getByText("R$ 1.500,50")).toHaveCount(0);

  await spouseContext.close();
  await strangerContext.close();
});
