import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Pendências do briefing de mídias (docs/09): links rápidos na central do cliente, reunião de
 * aprovação de estratégia, serviços novos no catálogo e o aviso de cliente sem retorno nas preferências.
 * A regra do aviso (2 e 5 dias úteis, sem repetir) é coberta por 19_cliente_sem_retorno.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && adminEmail && adminPassword);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const clientName = `Loja Links ${stamp}`;
let clientId = "";

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.getByLabel(/^Senha/).fill(adminPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  const { error: e2 } = await admin.from("client_accounts").insert([
    { client_id: clientId, kind: "instagram", value: "@loja.links" },
    { client_id: clientId, kind: "drive_folder", value: "https://drive.google.com/drive/folders/e2e" },
    { client_id: clientId, kind: "whatsapp", value: "(41) 99999-0000" },
    { client_id: clientId, kind: "bm", value: "123456789" },
  ]);
  if (e2) throw e2;
});

test("1. links rápidos no topo da central do cliente", async ({ page }) => {
  await login(page);
  await page.goto(`/clientes/${clientId}`);
  const nav = page.getByRole("navigation", { name: "Links do cliente" });
  await expect(nav.getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", "https://instagram.com/loja.links");
  await expect(nav.getByRole("link", { name: /Drive/ })).toHaveAttribute("href", "https://drive.google.com/drive/folders/e2e");
  await expect(nav.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/5541999990000");
  await expect(nav.getByRole("link", { name: /Instagram/ })).toHaveAttribute("target", "_blank");
  await expect(nav.getByRole("link")).toHaveCount(3);
  // Os links aparecem em todas as abas do cliente.
  await page.goto(`/clientes/${clientId}/reunioes`);
  await expect(page.getByRole("navigation", { name: "Links do cliente" }).getByRole("link")).toHaveCount(3);
});

test("2. reunião de aprovação de estratégia", async ({ page }) => {
  await login(page);
  await page.goto(`/clientes/${clientId}/reunioes`);
  await page.getByRole("button", { name: "Nova reunião" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Data e hora").fill("2026-11-10T10:00");
  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Aprovação de estratégia" }).click();
  await dialog.getByLabel("Título").fill(`Estratégia de dezembro ${stamp}`);
  await dialog.getByRole("button", { name: "Salvar reunião" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`Estratégia de dezembro ${stamp}`)).toBeVisible();
  await expect(page.getByText("Aprovação de estratégia").first()).toBeVisible();
  const { data } = await admin.from("client_meetings").select("kind").eq("client_id", clientId).single();
  expect(data!.kind).toBe("estrategia");
});

test("3. catálogo e preferência do aviso de cliente sem retorno", async ({ page }) => {
  await login(page);
  const { data } = await admin.from("service_catalog").select("key").in("key", ["consultoria_perfil", "google_meu_negocio"]);
  expect(data!.length).toBe(2);
  await page.goto("/configuracoes/notificacoes");
  await expect(page.getByText("Cliente sem retorno em aprovação")).toBeVisible();
});

test.afterAll(async () => {
  if (!configured || !clientId) return;
  await admin.from("clients").delete().eq("id", clientId);
});
