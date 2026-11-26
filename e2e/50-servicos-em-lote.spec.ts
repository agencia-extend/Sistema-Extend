import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Serviços em lote: o administrador preenche a quantidade mensal de um cliente ativo vindo do Trello (sem contratado);
 * "a partir do próximo mês" agenda a mudança; "já neste mês" ajusta o mês atual e cria as demandas do mês; quem não
 * gerencia clientes não abre a tela. Regras no banco: 58_servicos_em_lote.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Lote Serviços ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.sel.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Ana", "admin");
  await makeUser("Dora", "designer");
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "conteudo_mensal").single();
  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0, starts_on: today });
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    await admin.from("tasks").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("preenche a quantidade mensal: próximo mês e já neste mês", async ({ page }) => {
  await login(page, "Ana");
  await page.goto("/clientes");
  await page.getByRole("link", { name: "Serviços em lote" }).click();
  await expect(page.getByRole("heading", { name: "Serviços em lote" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar cliente" }).fill(clientName);
  const cell = page.getByLabel(`Conteúdo mensal de ${clientName} por mês`);
  const row = page.getByRole("row", { name: new RegExp(clientName) });
  await expect(row).toContainText("hoje: 0");

  await cell.fill("4");
  await page.getByRole("button", { name: "Salvar 1 alteração" }).click();
  await expect(page.getByText("1 quantidade salva; valem a partir do próximo mês de cada cliente.")).toBeVisible();
  await expect(row).toContainText(/hoje: 0 · \d{2}\/\d{2}: 4/);

  await cell.fill("6");
  await page.getByLabel("Já neste mês (cria as demandas do mês agora)").check();
  await page.getByRole("button", { name: "Salvar 1 alteração" }).click();
  await expect(page.getByText("1 quantidade salva; 6 demandas do mês criadas.")).toBeVisible();
  await expect(row).toContainText("hoje: 6");
  await expect(row).not.toContainText(": 4");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  const { count } = await admin.from("tasks").select("id", { count: "exact", head: true }).eq("client_id", clientId).not("slot_month", "is", null);
  expect(count).toBe(6);
  // O outro aparelho do teste começa do zero.
  await admin.from("tasks").delete().eq("client_id", clientId);
  await admin.from("client_services").update({ monthly_qty: 0 }).eq("client_id", clientId);
});

test("quem não gerencia clientes não abre a tela", async ({ page }) => {
  await login(page, "Dora");
  await page.goto("/clientes/servicos");
  await expect(page.getByRole("heading", { name: "Serviços em lote" })).toHaveCount(0);
});
