import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Checklist diário já preenchido com os números da sincronização (RF-OTI-01): saldo curto, anúncio reprovado em
 * campanha ativa, gasto de ontem x orçamento e campanha ativa sem gasto viram sugestões; a gestora confere e salva.
 * Cliente sem conta ligada abre vazio com o aviso. As regras estão em src/domain/traffic/prefill.test.ts.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Pet Shop Checklist ${stamp}`;
const emptyName = `Padaria Sem Conta ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
const clientIds: string[] = [];
let accountId = "";

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

test.beforeAll(async () => {
  if (!configured) return;
  const email = `ana.ckp.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", "gestor_trafego").single();
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `Ana ${stamp}`, role_id: r!.id } });
  if (ue) throw ue;
  people.Ana = { id: u.user.id, email };
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  for (const name of [clientName, emptyName]) {
    const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name, status: "ativo" }).select("id").single();
    if (error) throw error;
    clientIds.push(c.id);
    await admin.from("client_services").insert({ client_id: c.id, service_id: svc!.id, monthly_qty: 0 });
    await admin.from("client_members").insert({ client_id: c.id, sector_id: sector!.id, profile_id: people.Ana.id });
  }
  // Conta pré-paga com R$ 30 de saldo e R$ 50 por dia: saldo para 0 dia.
  const ext = `act_7${stamp.slice(-9)}`;
  const { data: acc, error: ae } = await admin
    .from("ad_accounts")
    .insert({ organization_id: org!.id, provider: "meta", external_id: ext, name: `Conta Pet ${stamp}`, client_id: clientIds[0], is_enabled: true, is_prepay: true, funds_cents: 3000, account_status_code: 1, synced_at: new Date().toISOString() })
    .select("id")
    .single();
  if (ae) throw ae;
  accountId = acc.id;
  const old = new Date(Date.now() - 20 * 86_400_000).toISOString();
  const { data: camps, error: ce } = await admin.from("ad_campaigns").insert([
    { ad_account_id: accountId, external_id: `c1${stamp}`, name: "Leads banho e tosa", effective_status: "ACTIVE", daily_budget_cents: 6000, starts_at: old },
    { ad_account_id: accountId, external_id: `c2${stamp}`, name: "Mensagens ração", effective_status: "ACTIVE", daily_budget_cents: 4000, starts_at: old },
  ]).select("id, external_id");
  if (ce) throw ce;
  await admin.from("ads").insert({ ad_account_id: accountId, campaign_id: camps!.find((c) => c.external_id === `c1${stamp}`)!.id, external_id: `ad1${stamp}`, name: "Vídeo tosa antes e depois", effective_status: "DISAPPROVED" });
  const ins = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ ad_account_id: accountId, level: "account", object_external_id: ext, date: day(d), spend_cents: 5000 }));
  ins.push({ ad_account_id: accountId, level: "campaign", object_external_id: `c1${stamp}`, date: day(1), spend_cents: 5000 });
  const { error: ie } = await admin.from("ad_insights_daily").insert(ins);
  if (ie) throw ie;
});

test.afterAll(async () => {
  if (!configured) return;
  if (accountId) await admin.from("ad_accounts").delete().eq("id", accountId);
  for (const id of clientIds) {
    await admin.from("traffic_checks").delete().eq("client_id", id);
    await admin.from("clients").delete().eq("id", id);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. checklist do dia chega preenchido com os números e a gestora salva", async ({ page }) => {
  await login(page, "Ana");
  await page.goto("/trafego");
  const row = page.getByRole("row").filter({ hasText: clientName });
  await row.getByRole("button", { name: `Fazer o checklist de hoje: ${clientName}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status")).toContainText("Sugestões com os números da sincronização");

  const group = (name: string) => dialog.getByRole("group", { name });
  await expect(group("Saldo e cobrança").getByRole("radio", { name: "Problema" })).toBeChecked();
  await expect(group("Saldo e cobrança").getByRole("textbox")).toHaveValue(`Conta Pet ${stamp}: saldo de R$ 30,00 (cerca de 0 dias)`);
  await expect(group("Anúncios reprovados").getByRole("radio", { name: "Problema" })).toBeChecked();
  await expect(group("Anúncios reprovados").getByRole("textbox")).toHaveValue("1 anúncio reprovado em campanha ativa: Vídeo tosa antes e depois");
  await expect(group("Gasto x orçamento").getByRole("radio", { name: "Ok" })).toBeChecked();
  await expect(group("Gasto x orçamento")).toContainText("Ontem: R$ 50,00 de R$ 100,00 de orçamento diário das campanhas ativas (50%).");
  await expect(group("Entrega").getByRole("radio", { name: "Problema" })).toBeChecked();
  await expect(group("Entrega").getByRole("textbox")).toHaveValue("Sem gasto ontem: Mensagens ração");

  // A gestora confere: a campanha de mensagens foi pausada de propósito.
  await group("Entrega").locator("label").filter({ hasText: /^Ok$/ }).click();
  await dialog.getByRole("button", { name: "Salvar checklist" }).click();
  await expect(page.getByText(/salvo com 2 problemas no histórico do cliente/)).toBeVisible();
  await expect(row.getByText("2 problemas")).toBeVisible();
});

test("2. cliente sem conta ligada abre vazio com o aviso", async ({ page }) => {
  await login(page, "Ana");
  await page.goto("/trafego");
  const row = page.getByRole("row").filter({ hasText: emptyName });
  await row.getByRole("button", { name: `Fazer o checklist de hoje: ${emptyName}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status")).toContainText("Sem conta da Meta ligada e sincronizada");
  await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
