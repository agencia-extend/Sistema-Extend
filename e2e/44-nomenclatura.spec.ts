import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Nomenclatura padrão (RF-PLA-03):
 * 1. a gerente de tráfego muda o padrão em Configurações › Nomenclatura (peça desconhecida não salva; o exemplo
 *    acompanha) e põe o código do criativo no anúncio;
 * 2. a gestora vê, na aba Nomenclatura do módulo Anúncios, o que está fora do padrão nas contas do cliente dela, com o
 *    motivo, e gera um nome no padrão e copia;
 * 3. quem não conecta as contas não muda o padrão. O padrão da agência volta ao que era no fim.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Imobiliária Nomes ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let orgId = "";
let clientId = "";
let accountId = "";
let before: { campaign: string; adset: string; ad: string } | null = null;

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.nom.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Ger", "gerente_trafego");
  await makeUser("Ana", "gestor_trafego");
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  orgId = org!.id;
  const { data: nc } = await admin.from("naming_conventions").select("campaign, adset, ad").eq("organization_id", orgId).maybeSingle();
  before = nc;
  const { data: c } = await admin.from("clients").insert({ organization_id: orgId, name: clientName, status: "ativo" }).select("id").single();
  clientId = c!.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Ana.id });
  const { data: acc, error } = await admin.from("ad_accounts")
    .insert({ organization_id: orgId, provider: "meta", external_id: `act_5${stamp.slice(-9)}`, name: `Conta Nomes ${stamp}`, client_id: clientId, is_enabled: true, account_status_code: 1, synced_at: new Date().toISOString() })
    .select("id").single();
  if (error) throw error;
  accountId = acc.id;
  const { data: camps } = await admin.from("ad_campaigns").insert([
    { ad_account_id: accountId, external_id: "c1", name: "IMB_LEADS_FRIO_2026-11", effective_status: "ACTIVE" },
    { ad_account_id: accountId, external_id: "c2", name: `[IMOB] Campanha nova ${stamp}`, effective_status: "ACTIVE" },
  ]).select("id, external_id");
  const c1 = camps!.find((x) => x.external_id === "c1")!.id;
  await admin.from("ad_sets").insert({ ad_account_id: accountId, campaign_id: c1, external_id: "s1", name: "FRIO_FEED-STORIES_25-55", effective_status: "ACTIVE" });
  await admin.from("ads").insert([
    { ad_account_id: accountId, campaign_id: c1, external_id: "a1", name: "VIDEO_DOR-ALUGUEL_V2", effective_status: "ACTIVE" },
    { ad_account_id: accountId, campaign_id: c1, external_id: "a2", name: `Criativo solto ${stamp}`, effective_status: "ACTIVE" },
  ]);
});

test.afterAll(async () => {
  if (!configured) return;
  if (before) await admin.from("naming_conventions").update(before).eq("organization_id", orgId);
  else await admin.from("naming_conventions").delete().eq("organization_id", orgId);
  if (accountId) await admin.from("ad_accounts").delete().eq("id", accountId);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. a gerente muda o padrão; peça desconhecida não salva", async ({ page }) => {
  await login(page, "Ger");
  await page.goto("/configuracoes/nomenclatura");
  const ad = page.getByLabel("Anúncio");
  await ad.fill("{FORMATO}_{PRODUTO}");
  await expect(page.getByText("Peça desconhecida: {PRODUTO}. Use as peças dos botões.")).toBeVisible();
  await page.getByRole("button", { name: "Salvar nomenclatura" }).click();
  await expect(page.getByText("Revise os padrões destacados.")).toBeVisible();
  await ad.fill("{FORMATO}_{ANGULO}_");
  await ad.press("End");
  await page.getByRole("button", { name: "Inserir Versão" }).click();
  await expect(ad).toHaveValue("{FORMATO}_{ANGULO}_{V#}");
  await expect(page.getByText("VIDEO_DOR-ALUGUEL_V2")).toBeVisible();
  await page.getByLabel("Campanha").fill("{CLIENTE}_{OBJETIVO}_{PUBLICO}_{AAAA-MM}");
  await page.getByLabel("Conjunto").fill("{PUBLICO}_{POSICIONAMENTO}_{IDADE}");
  await page.getByRole("button", { name: "Salvar nomenclatura" }).click();
  await expect(page.getByText("Nomenclatura salva. O verificador já usa o padrão novo.")).toBeVisible();
  const { data } = await admin.from("naming_conventions").select("campaign, adset, ad").eq("organization_id", orgId).single();
  expect(data).toEqual({ campaign: "{CLIENTE}_{OBJETIVO}_{PUBLICO}_{AAAA-MM}", adset: "{PUBLICO}_{POSICIONAMENTO}_{IDADE}", ad: "{FORMATO}_{ANGULO}_{V#}" });
});

test("2. a gestora vê o que está fora do padrão e gera um nome", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, "Ana");
  await page.goto("/anuncios");
  await page.getByRole("navigation", { name: "Seções de anúncios" }).getByRole("link", { name: "Nomenclatura" }).click();
  await page.waitForURL(/\/anuncios\/nomenclatura/);
  const summary = page.getByRole("list", { name: "Resumo da nomenclatura" });
  await expect(summary.getByRole("listitem").filter({ hasText: "campanhas" })).toContainText("1 de 2");
  await expect(summary.getByRole("listitem").filter({ hasText: "conjuntos" })).toContainText("1 de 1");
  await expect(summary.getByRole("listitem").filter({ hasText: "anúncios" })).toContainText("1 de 2");
  const table = page.getByRole("table", { name: "Fora do padrão" });
  await expect(table.getByRole("row", { name: new RegExp(`Campanha nova ${stamp}`) })).toContainText("cliente (sigla) fora do padrão");
  await expect(table.getByRole("row", { name: new RegExp(`Criativo solto ${stamp}`) })).toContainText("formato fora do padrão");
  await expect(table.getByRole("row", { name: /^IMB_LEADS_FRIO_2026-11/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.getByRole("button", { name: "Gerar nome" }).click();
  const dialog = page.getByRole("dialog", { name: "Gerar nome no padrão" });
  await dialog.getByLabel("Cliente (sigla)").fill("imb");
  await dialog.getByLabel("Objetivo").click();
  await page.getByRole("option", { name: "MENSAGENS" }).click();
  await expect(dialog.getByText("Falta: público.")).toBeVisible();
  await dialog.getByLabel("Público").fill("interesse imóveis");
  await expect(dialog.getByRole("status")).toContainText(/^IMB_MENSAGENS_INTERESSE-IMOVEIS_\d{4}-\d{2}$/);
  await dialog.getByRole("button", { name: "Copiar nome" }).click();
  await expect(page.getByText("Nome copiado. Cole no Gerenciador de Anúncios.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^IMB_MENSAGENS_INTERESSE-IMOVEIS_\d{4}-\d{2}$/);
});

test("3. a gestora não muda o padrão", async ({ page }) => {
  await login(page, "Ana");
  await page.goto("/configuracoes/nomenclatura");
  await expect(page).toHaveURL(/\/sem-acesso/);
});
