import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Painel do tráfego e aba Anúncios (RF-ADS-05/07): a gestora do cliente vê a conta ligada com saldo, previsão,
 * campanhas e custo por resultado, troca o período e abre os anúncios com miniatura e números; a conta sem
 * conexão avisa ao sincronizar; quem é de fora não vê. Os números entram como a sincronização grava
 * (a sincronização real foi conferida contra a Meta: docs/06). Regras no banco: 32_sincronizacao_anuncios.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Clínica Painel ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";
let accountId = "";
const day = (n: number) => new Date(Date.now() - 3 * 3600_000 - n * 86_400_000).toISOString().slice(0, 10); // dia em São Paulo

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.pnl.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Gil", "gestor_trafego");
  await makeUser("Ivo", "gestor_trafego");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Gil.id });

  const { data: acc, error: e2 } = await admin
    .from("ad_accounts")
    .insert({ organization_id: org!.id, provider: "meta", external_id: `act_9${stamp.slice(-9)}`, name: `Conta Painel ${stamp}`, client_id: clientId, is_enabled: true, is_prepay: true, funds_cents: 5000, funding_display: "Saldo disponível (R$50,00 BRL)", account_status_code: 1, synced_at: new Date().toISOString() })
    .select("id")
    .single();
  if (e2) throw e2;
  accountId = acc.id;
  const { data: camp } = await admin.from("ad_campaigns").insert({ ad_account_id: accountId, external_id: "cp1", name: "Mensagens Clareamento", objective: "OUTCOME_ENGAGEMENT", effective_status: "ACTIVE", daily_budget_cents: 3000 }).select("id").single();
  const { data: set } = await admin.from("ad_sets").insert({ ad_account_id: accountId, campaign_id: camp!.id, external_id: "as1", name: "Mulheres 25-45 Floripa", effective_status: "ACTIVE", daily_budget_cents: 2500 }).select("id").single();
  await admin.from("ads").insert({ ad_account_id: accountId, campaign_id: camp!.id, ad_set_id: set!.id, external_id: "ad1", name: "Vídeo antes e depois", effective_status: "ACTIVE" });
  // 7 dias de R$ 20,00 com 4 conversas por dia; hoje sem gasto.
  const rows = [];
  for (let i = 1; i <= 7; i++) {
    for (const [level, obj] of [["account", `act_9${stamp.slice(-9)}`], ["campaign", "cp1"], ["adset", "as1"], ["ad", "ad1"]] as const)
      rows.push({ ad_account_id: accountId, level, object_external_id: obj, date: day(i), spend_cents: 2000, impressions: 1000, clicks: 30, link_clicks: 20, messages: 4 });
  }
  const { error: e3 } = await admin.from("ad_insights_daily").insert(rows);
  if (e3) throw e3;
});

test.afterAll(async () => {
  if (!configured) return;
  if (accountId) await admin.from("ad_accounts").delete().eq("id", accountId);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. módulo Anúncios: clientes, visão geral comparada, campanhas e troca de período", async ({ page }) => {
  await login(page, "Gil");
  // O endereço antigo do painel leva ao módulo novo, mantendo o período.
  await page.goto("/trafego/painel?periodo=30d");
  await page.waitForURL(/\/anuncios\/clientes\?periodo=30d/);
  await expect(page.getByRole("heading", { name: "Anúncios", level: 1 })).toBeVisible();
  const row = page.getByRole("table", { name: "Clientes" }).getByRole("row", { name: new RegExp(clientName) });
  await expect(row).toContainText("R$ 140,00");
  await expect(row).toContainText("R$ 5,00");
  await expect(row).toContainText("R$ 50,00 · ~2 d");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.goto(`/anuncios?periodo=30d&cliente=${clientId}`);
  const kpis = page.getByRole("definition").filter({ hasText: /^R\$\s140,00$/ });
  await expect(kpis.first()).toBeVisible();
  await expect(page.getByText("Sem base no período anterior").first()).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "saldo para cerca de 2 dias" })).toBeVisible();
  await expect(page.getByRole("figure").getByText("Investimento por dia")).toBeVisible();
  const top = page.getByRole("table", { name: "Campanhas com mais investimento" });
  await expect(top.getByRole("row", { name: /Mensagens Clareamento/ })).toContainText("28 conversas");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  // A aba leva os filtros junto.
  await page.getByRole("navigation", { name: "Seções de anúncios" }).getByRole("link", { name: "Campanhas" }).click();
  await page.waitForURL(new RegExp(`/anuncios/campanhas\\?.*cliente=${clientId}`));
  const camp = page.getByRole("table", { name: "Campanhas" }).getByRole("row", { name: /Mensagens Clareamento/ });
  await expect(camp).toContainText("R$ 140,00");
  await expect(camp).toContainText("R$ 30,00");
  await page.getByRole("group", { name: "Período" }).getByRole("button", { name: "Hoje" }).click();
  await expect(page).toHaveURL(/periodo=hoje/);
  await expect(page.getByRole("table", { name: "Campanhas" }).getByRole("row", { name: /Mensagens Clareamento/ })).toContainText("R$ 0,00"); // no ar, sem gasto hoje
  await page.getByRole("navigation", { name: "Seções de anúncios" }).getByRole("link", { name: "Conjuntos" }).click();
  await page.waitForURL(/\/anuncios\/conjuntos/);
  const set = page.getByRole("table", { name: "Conjuntos" }).getByRole("row", { name: /Mulheres 25-45 Floripa/ });
  await expect(set).toContainText("R$ 25,00/dia");
  await expect(set).toContainText("R$ 0,00"); // hoje sem gasto
  await page.getByRole("group", { name: "Período" }).getByRole("button", { name: "30 dias" }).click();
  await expect(page).toHaveURL(/periodo=30d/);
  await expect(page.getByRole("table", { name: "Conjuntos" }).getByRole("row", { name: /Mulheres 25-45 Floripa/ })).toContainText("28 conversas");
  await page.getByRole("navigation", { name: "Seções de anúncios" }).getByRole("link", { name: "Anúncios", exact: true }).click();
  await expect(page.getByRole("table", { name: "Anúncios" }).getByRole("row", { name: /Vídeo antes e depois/ })).toBeVisible();
});

test("2. aba Anúncios do cliente e conta sem conexão ao sincronizar", async ({ page }) => {
  await login(page, "Gil");
  await page.goto(`/clientes/${clientId}/anuncios?periodo=30d`);
  await expect(page.getByRole("main").getByRole("link", { name: "Anúncios", exact: true })).toHaveAttribute("aria-current", "page");
  const card = page.getByRole("listitem").filter({ hasText: "Vídeo antes e depois" });
  await expect(card).toContainText("Ativo");
  await expect(card).toContainText("R$ 140,00 · 28 conversas · R$ 5,00 cada");
  // Meta do mês: 100 conversas e até R$ 4,00 cada. Realizado: 28 conversas a R$ 5,00 → abaixo e acima do limite.
  await page.getByRole("button", { name: "Definir meta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Resultado").click();
  await page.getByRole("option", { name: "Conversas" }).click();
  await dialog.getByLabel("Quantidade no mês").fill("100");
  await dialog.getByLabel("Custo máximo por conversa (R$)").fill("abc");
  await dialog.getByRole("button", { name: "Salvar meta" }).click();
  await expect(dialog.getByText("Valor inválido. Ex.: 1.500,00")).toBeVisible();
  await dialog.getByLabel("Custo máximo por conversa (R$)").fill("4,00");
  await dialog.getByRole("button", { name: "Salvar meta" }).click();
  await expect(page.getByText("Meta do mês salva.")).toBeVisible();
  const goals = page.getByRole("list", { name: "Metas do mês" });
  // Só os dias de teste que caem neste mês entram (no começo do mês, parte fica no anterior).
  const inMonth = [1, 2, 3, 4, 5, 6, 7].filter((i) => day(i) >= `${day(0).slice(0, 7)}-01`).length;
  test.skip(inMonth < 3, "Começo do mês: poucos dias para a meta.");
  await expect(goals.getByRole("listitem").filter({ hasText: "Conversas" })).toContainText(`${inMonth * 4} de 100`);
  await expect(goals.getByRole("listitem").filter({ hasText: "Conversas" })).toContainText("Abaixo da meta");
  await expect(goals.getByRole("listitem").filter({ hasText: "Custo por conversa" })).toContainText("Acima do limite");
  await expect(page.getByRole("button", { name: "Editar meta" })).toBeVisible();

  // Sem WhatsApp configurado (ou sem grupo de relatórios), o envio diz o que falta.
  await page.getByRole("button", { name: "Relatório", exact: true }).click();
  const report = page.getByRole("dialog", { name: "Relatório de anúncios" });
  await report.getByLabel("Período").click();
  await page.getByRole("option", { name: "Últimos 7 dias" }).click();
  await expect(report.getByRole("region", { name: /^Prévia/ })).toContainText("Investimento:");
  await report.getByRole("button", { name: "Enviar no WhatsApp" }).click();
  await expect(page.getByText(/Configurações › WhatsApp/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Sincronizar agora" }).click();
  await expect(page.getByText(/sem conexão ativa com a Meta/)).toBeVisible();
});

test("3. gestor de fora do cliente não vê a conta", async ({ page }) => {
  await login(page, "Ivo");
  await page.goto("/anuncios/clientes");
  await expect(page.getByText(clientName)).toHaveCount(0);
});
