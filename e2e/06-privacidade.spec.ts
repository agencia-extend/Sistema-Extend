import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** LGPD: política pública, ciência no sistema, cópia dos dados, pedido do titular e resposta do admin. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && adminEmail && adminPassword);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const madu = { id: "", email: `madu.lgpd.${stamp}@extend.test`, name: `Madu LGPD ${stamp}` };
let savedController: Record<string, unknown> | null = null;

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: r } = await admin.from("roles").select("id").eq("key", "social_media").single();
  const { data, error } = await admin.auth.admin.createUser({ email: madu.email, password: pw, email_confirm: true, user_metadata: { full_name: madu.name, role_id: r!.id } });
  if (error) throw error;
  madu.id = data.user.id;
  const { data: c } = await admin.from("privacy_settings").select("*").maybeSingle();
  savedController = c;
});

test("1. política e termos abrem sem login; aviso de cookies some depois de aceitar", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");
  const cookies = page.getByRole("region", { name: "Aviso de cookies" });
  await expect(cookies).toBeVisible();
  await cookies.getByRole("button", { name: "Aceitar" }).click();
  await expect(cookies).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(cookies).toHaveCount(0);
  await page.getByRole("link", { name: "Política de Privacidade" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(page.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Seus direitos e como pedir/ })).toBeVisible();
  await expect(page.getByRole("table", { name: "Prazos de guarda" })).toBeVisible();
  await page.getByRole("navigation", { name: "Documentos" }).getByRole("link", { name: "Termos de uso" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeVisible();
});

test("2. dentro do sistema não há aviso de privacidade; a Madu baixa os dados e faz um pedido", async ({ page }) => {
  await login(page, madu.email, pw);
  await expect(page.getByRole("heading", { name: "Minhas pendências" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Aviso de privacidade" })).toHaveCount(0);

  await page.goto("/configuracoes/perfil");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar meus dados" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^meus-dados-extend-\d{4}-\d{2}-\d{2}\.json$/);
  const json = JSON.parse(readFileSync((await file.path())!, "utf8"));
  expect(json.perfil.email).toBe(madu.email);
  expect(json.ciencia_da_politica).toEqual([]);

  await page.getByRole("button", { name: "Fazer um pedido sobre meus dados" }).click();
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByText("Escolha o que você quer.")).toBeVisible();
  await page.getByRole("combobox", { name: "O que você quer" }).click();
  await page.getByRole("option", { name: "Corrigir um dado errado ou desatualizado" }).click();
  await page.getByLabel("Detalhes").fill("Meu telefone mudou para (11) 98888-7777.");
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByText("Pedido enviado. A resposta chega em até 15 dias, aqui e por aviso.")).toBeVisible();
  const mine = page.getByRole("list", { name: "Meus pedidos" });
  await expect(mine).toContainText("Correção");
  await expect(mine).toContainText("Aberto");

  // Não abre a área de quem atende.
  await page.goto("/configuracoes/privacidade").catch(() => undefined); // o redirecionamento pode interromper o carregamento
  await expect(page).toHaveURL(/sem-acesso/);
});

test("3. o admin responde e a Madu é avisada; dados do controlador vão para a política", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/configuracoes/privacidade");
  const row = page.getByRole("row", { name: new RegExp(madu.name) });
  await expect(row).toContainText("Correção");
  await row.getByRole("button", { name: `Responder o pedido de ${madu.name}` }).click();
  await page.getByRole("button", { name: "Enviar resposta" }).click();
  await expect(page.getByText(/Escreva a resposta para a pessoa/)).toBeVisible();
  await page.getByLabel("Resposta para a pessoa").fill("Telefone atualizado no seu perfil.");
  await page.getByRole("button", { name: "Enviar resposta" }).click();
  await expect(page.getByText("Resposta enviada. A pessoa foi avisada.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(madu.name) })).toContainText("Atendido");
  await expect
    .poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", madu.id).eq("kind", "privacy")).count)
    .toBe(1);

  await page.getByLabel("CNPJ").fill("11222333000182");
  await page.getByRole("button", { name: "Salvar dados do controlador" }).click();
  await expect(page.getByText("CNPJ inválido. Confira os números.")).toBeVisible();
  await page.getByLabel("CNPJ").fill("11222333000181");
  await page.getByRole("button", { name: "Salvar dados do controlador" }).click();
  await expect(page.getByText(/Dados do controlador salvos/)).toBeVisible();
  await page.goto("/privacidade");
  await expect(page.getByText("CNPJ 11.222.333/0001-81", { exact: false })).toBeVisible();
});

test.afterAll(async () => {
  if (!configured) return;
  // Devolve os dados reais do controlador (o banco de testes é o mesmo da produção por enquanto).
  if (savedController) await admin.from("privacy_settings").upsert(savedController);
  else await admin.from("privacy_settings").delete().neq("organization_id", "00000000-0000-0000-0000-000000000000");
  if (madu.id) await admin.auth.admin.deleteUser(madu.id);
});
