import { expect, test } from "@playwright/test";

/**
 * Página inicial pública (exigida na verificação do Google e na análise da Meta): quem chega sem login
 * vê o que é o sistema, o uso dos dados do Google e da Meta, a versão em inglês e os links legais.
 * Quem está logado vai direto para o Início.
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;

test("sem login, a página inicial explica o sistema e liga para privacidade e termos", async ({ page }) => {
  await page.context().clearCookies();
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Sistema Extend", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "About this app" })).toBeVisible();
  await expect(page.getByText(/Google Ads API/).first()).toBeVisible();
  const privacy = page.getByRole("link", { name: "Privacy Policy" });
  await expect(privacy).toHaveAttribute("href", "/privacidade");
  await expect(page.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/termos");
  await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login/);
  // Ícone do app (Meta) público.
  const icon = await page.request.get("/brand/app-icon-1024.png");
  expect(icon.status()).toBe(200);
});

test("logado, a página inicial leva ao Início", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD.");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.getByLabel(/^Senha/).fill(adminPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
  await page.goto("/");
  await expect(page).toHaveURL(/\/inicio/);
});
