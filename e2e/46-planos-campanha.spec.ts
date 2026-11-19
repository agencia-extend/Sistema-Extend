import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Plano de campanha (RF-PLA-01/02):
 * 1. a gestora do cliente cria o plano com o nome da campanha que já está na conta: ele se liga sozinho e mostra o gasto;
 *    registra a aprovação do cliente (a campanha está ativa, então vai para "no ar"), solta e liga a campanha à mão;
 * 2. um plano com campanha que ainda não existe se liga quando a sincronização traz a campanha com o mesmo nome;
 * 3. quem é de fora do cliente não vê os planos.
 * Regras no banco: 51_planos_campanha.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Clínica Plano ${stamp}`;
const campName = `CLP_MENSAGENS_FRIO_${stamp.slice(-6)}`;
const laterName = `CLP_LEADS_QUENTE_${stamp.slice(-6)}`;
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
  const email = `${key.toLowerCase()}.pla.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Gil", "gestor_trafego");
  await makeUser("Ivo", "gestor_trafego");
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Gil.id });
  const ext = `act_8${stamp.slice(-9)}`;
  const { data: acc, error: e2 } = await admin
    .from("ad_accounts")
    .insert({ organization_id: org!.id, provider: "meta", external_id: ext, name: `Conta Plano ${stamp}`, client_id: clientId, is_enabled: true, account_status_code: 1, synced_at: new Date().toISOString() })
    .select("id")
    .single();
  if (e2) throw e2;
  accountId = acc.id;
  await admin.from("ad_campaigns").insert({ ad_account_id: accountId, external_id: "pc1", name: campName, objective: "OUTCOME_ENGAGEMENT", effective_status: "ACTIVE", daily_budget_cents: 2000 });
  // 7 dias de R$ 20,00 com 4 conversas por dia; hoje sem gasto.
  const rows = [];
  for (let i = 1; i <= 7; i++) rows.push({ ad_account_id: accountId, level: "campaign", object_external_id: "pc1", date: day(i), spend_cents: 2000, impressions: 1000, clicks: 30, link_clicks: 20, messages: 4 });
  const { error: e3 } = await admin.from("ad_insights_daily").insert(rows);
  if (e3) throw e3;
});

test.afterAll(async () => {
  if (!configured) return;
  if (accountId) await admin.from("ad_accounts").delete().eq("id", accountId);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. cria o plano, liga pelo nome, aprova e vai ao ar; solta e liga à mão", async ({ page }) => {
  await login(page, "Gil");
  await page.goto(`/clientes/${clientId}/trafego`);
  const section = page.getByRole("region", { name: "Planos de campanha" });
  await expect(section.getByText("Nenhum plano de campanha")).toBeVisible();
  await section.getByRole("button", { name: "Novo plano" }).click();
  const d = page.getByRole("dialog", { name: "Novo plano de campanha" });
  await expect(d.getByText(/Nenhum criativo na biblioteca/)).toBeVisible();
  await d.getByRole("button", { name: "Criar plano" }).click();
  await expect(d.getByText("Escolha o objetivo.")).toBeVisible();
  await d.getByLabel("Objetivo").click();
  await page.getByRole("option", { name: "Mensagens" }).click();
  await d.getByLabel("Nome da campanha").fill(campName.toLowerCase());
  await expect(d.getByText(`Já existe na conta: o plano vai se ligar a “${campName}”.`)).toBeVisible();
  await d.getByLabel("Valor por dia (R$)").fill("20,00");
  await d.getByLabel("Início").fill(day(7));
  await d.getByLabel("Público").fill("Mulheres de 25 a 45 anos em Florianópolis");
  await d.getByRole("button", { name: "Criar plano" }).click();
  await expect(page.getByText("Plano criado. A equipe de tráfego do cliente foi avisada. Já está ligado à campanha com este nome.")).toBeVisible();

  const plan = section.getByRole("listitem").filter({ hasText: campName.toLowerCase() });
  await expect(plan).toContainText("Rascunho");
  await expect(plan).toContainText("Campanha ligada pelo nome");
  await expect(plan).toContainText(/R\$\s20,00\/dia/);
  await expect(plan).toContainText(/R\$\s140,00/);
  await expect(plan).toContainText("28 conversas");

  // Aprovação do cliente: a campanha já está ativa, então o plano vai ao ar.
  await plan.getByRole("button", { name: /Mudar a situação/ }).click();
  const st = page.getByRole("dialog", { name: "Situação do plano" });
  await st.getByRole("button", { name: "Salvar situação" }).click();
  await expect(st.getByText("Quem aprovou no cliente?")).toBeVisible();
  await st.getByLabel("Quem aprovou no cliente").fill("Marcos (sócio)");
  await st.getByRole("button", { name: "Salvar situação" }).click();
  await expect(page.getByText("Aprovação registrada. A campanha ligada já está ativa: o plano está no ar.")).toBeVisible();
  await expect(plan).toContainText("No ar");
  await expect(plan).toContainText("Aprovado por Marcos (sócio)");
  await expect(plan).toContainText(/No ritmo do previsto/); // R$ 140 de R$ 160 esperados em 8 dias
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  // Solta e liga de novo, à mão.
  await plan.getByRole("button", { name: /Campanha do plano/ }).click();
  const ln = page.getByRole("dialog", { name: "Campanha do plano" });
  await ln.getByRole("button", { name: "Soltar campanha" }).click();
  await expect(page.getByText("Campanha solta do plano.")).toBeVisible();
  await expect(plan).toContainText("Aguardando a campanha com este nome");
  await plan.getByRole("button", { name: /Campanha do plano/ }).click();
  await ln.getByLabel("Campanha").click();
  await page.getByRole("option", { name: new RegExp(campName) }).click();
  await ln.getByRole("button", { name: "Ligar campanha" }).click();
  await expect(page.getByText("Campanha ligada ao plano.")).toBeVisible();
  await expect(plan).toContainText("Campanha ligada à mão");

  // No módulo Anúncios, a aba Planos mostra o plano com o cliente; o filtro de situação vale.
  await page.goto("/anuncios/planos");
  await expect(page.getByRole("list", { name: "Planos de campanha" }).getByRole("listitem").filter({ hasText: campName.toLowerCase() })).toContainText(clientName);
  await page.getByRole("navigation", { name: "Situação dos planos" }).getByRole("link", { name: "Rascunho" }).click();
  await expect(page).toHaveURL(/situacao=rascunho/);
  await expect(page.getByText(campName.toLowerCase())).toHaveCount(0);
});

test("2. a sincronização traz a campanha com o mesmo nome e o plano se liga", async ({ page }) => {
  await login(page, "Gil");
  await page.goto(`/anuncios/planos?cliente=${clientId}`);
  await page.getByRole("button", { name: "Novo plano" }).click();
  const d = page.getByRole("dialog", { name: "Novo plano de campanha" });
  await d.getByLabel("Objetivo").click();
  await page.getByRole("option", { name: "Leads (cadastros)" }).click();
  await d.getByLabel("Nome da campanha").fill(laterName);
  await d.getByLabel("Tipo de orçamento").click();
  await page.getByRole("option", { name: "Total do período" }).click();
  await d.getByLabel("Valor total (R$)").fill("900,00");
  await d.getByLabel("Público").fill("Quem visitou o site");
  await d.getByRole("button", { name: "Criar plano" }).click();
  await expect(d.getByText("Com orçamento total, informe o fim.")).toBeVisible();
  await d.getByLabel("Fim").fill(day(-30));
  await d.getByRole("button", { name: "Criar plano" }).click();
  await expect(page.getByText("Plano criado. A equipe de tráfego do cliente foi avisada.", { exact: true })).toBeVisible();
  const plan = page.getByRole("list", { name: "Planos de campanha" }).getByRole("listitem").filter({ hasText: laterName });
  await expect(plan).toContainText("Aguardando a campanha com este nome");
  await expect(plan).toContainText(/R\$\s900,00 no total/);

  // A sincronização grava a campanha nova (pela chave secreta, como o job).
  await admin.from("ad_campaigns").insert({ ad_account_id: accountId, external_id: `pc2${stamp}`, name: laterName, objective: "OUTCOME_LEADS", effective_status: "PAUSED" });
  await page.reload();
  await expect(page.getByRole("list", { name: "Planos de campanha" }).getByRole("listitem").filter({ hasText: laterName })).toContainText("Campanha ligada pelo nome");
  await admin.from("campaign_plans").delete().eq("client_id", clientId); // o outro aparelho do teste começa do zero
});

test("3. gestor de fora do cliente não vê os planos", async ({ page }) => {
  await login(page, "Ivo");
  await page.goto("/anuncios/planos");
  await expect(page.getByText(clientName)).toHaveCount(0);
  await page.goto(`/clientes/${clientId}/trafego`);
  await expect(page.getByRole("button", { name: "Novo plano" })).toHaveCount(0);
});
