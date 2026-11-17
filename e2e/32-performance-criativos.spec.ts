import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Performance por criativo (RF-BIB-03) e sugestão de "fadigado" (RF-BIB-02): o anúncio com o código do criativo no
 * nome se liga na sincronização; a gestora vê os números na biblioteca e na página do criativo, liga outro anúncio à
 * mão e desliga o do código; com fadiga aberta no anúncio, a biblioteca sugere "fadigado" e ela aceita. A social media
 * do cliente vê os números, mas não liga nem desliga. Regras e permissões no banco: 38_performance_criativos.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Clínica Números ${stamp}`;
const angle = `Sorriso em 7 dias ${stamp}`;
const people: Record<string, { id: string; email: string; name: string }> = {};
let clientId = "";
let accountId = "";
let taskId = "";
let libraryId = "";
let ref = 0;
const manualAd = `Sorriso manual ${stamp}`;

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.prf.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Ana", "gestor_trafego");
  await makeUser("Sol", "social_media");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  const { data: sectors } = await admin.from("sectors").select("id, key").in("key", ["trafego", "conteudo"]);
  const sid = (k: string) => sectors!.find((s) => s.key === k)!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sid("trafego"), profile_id: people.Ana.id },
    { client_id: clientId, sector_id: sid("conteudo"), profile_id: people.Sol.id },
  ]);
  const { data: t, error: te } = await admin.from("tasks").insert({ organization_id: org!.id, client_id: clientId, type: "criativo", title: angle }).select("id").single();
  if (te) throw te;
  taskId = t.id;
  await admin.from("creative_requests").insert({ task_id: taskId, client_id: clientId, requested_by: people.Ana.id, campaign: "Clareamento", objective: "leads", format: "video", angle, audience: "Adultos 25-55", cta: "Agendar avaliação" });
  const { data: lib, error: le } = await admin.from("creative_library").insert({ task_id: taskId, client_id: clientId, campaign: "Clareamento", format: "video", angle }).select("id, ref_number").single();
  if (le) throw le;
  libraryId = lib.id;
  ref = Number(lib.ref_number);
  const ext = `act_9${stamp.slice(-9)}`;
  const { data: acc, error: ae } = await admin
    .from("ad_accounts")
    .insert({ organization_id: org!.id, provider: "meta", external_id: ext, name: `Conta Números ${stamp}`, client_id: clientId, is_enabled: true, account_status_code: 1, synced_at: new Date().toISOString() })
    .select("id")
    .single();
  if (ae) throw ae;
  accountId = acc.id;
  const { error: ade } = await admin.from("ads").insert([
    { ad_account_id: accountId, external_id: `a1${stamp}`, name: `VIDEO_SORRISO_CR-${ref}_V1`, effective_status: "ACTIVE", frequency_7d: 2.1 },
    { ad_account_id: accountId, external_id: `a2${stamp}`, name: manualAd, effective_status: "ACTIVE", frequency_7d: 3.4 },
  ]);
  if (ade) throw ade;
  // a1: 2 dias, R$ 50 cada, 2.000 impressões, 40 cliques no link, 2 leads, 600 visualizações de 3 s; a2: 1 dia, R$ 20.
  const row = (obj: string, d: number, spend: number, imp: number, link: number, leads: number, views: number, thru: number) => ({
    ad_account_id: accountId, level: "ad", object_external_id: obj, date: day(d), spend_cents: spend, impressions: imp, clicks: link, link_clicks: link, leads, video_views: views, thruplays: thru,
  });
  const { error: ie } = await admin.from("ad_insights_daily").insert([
    row(`a1${stamp}`, 3, 5000, 2000, 40, 2, 600, 100), row(`a1${stamp}`, 2, 5000, 2000, 40, 2, 600, 100), row(`a2${stamp}`, 1, 2000, 1000, 10, 1, 0, 0),
  ]);
  if (ie) throw ie;
  // Como na sincronização: liga o anúncio que tem o código no nome.
  const { data: n, error: se } = await admin.rpc("sync_link_creatives", { p_account: accountId });
  if (se) throw se;
  expect(n).toBe(1);
});

test.afterAll(async () => {
  if (!configured) return;
  if (accountId) await admin.from("ad_accounts").delete().eq("id", accountId);
  if (clientId) {
    await admin.from("ad_alerts").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. números na biblioteca e na página; ligar e desligar anúncios", async ({ page }) => {
  await login(page, "Ana");
  await page.goto(`/criativos/biblioteca?cliente=${clientId}`);
  const card = page.getByRole("list", { name: "Biblioteca de criativos" }).getByRole("listitem").filter({ hasText: angle });
  await expect(card).toContainText(`CR-${ref}`);
  await expect(card).toContainText("R$ 100,00 · CTR 2,0% · R$ 25,00 por lead · hook 30,0% · 2 dias no ar");
  await expect(page.getByRole("combobox", { name: "Ordenar" })).toBeVisible();

  await card.getByRole("link", { name: angle }).click();
  await page.waitForURL(`**/criativos/${taskId}`);
  const sec = page.getByRole("region", { name: "Desempenho nos anúncios" });
  await expect(sec).toContainText(`Código CR-${ref}`);
  await expect(sec.getByRole("definition").first()).toHaveText("R$ 100,00");
  await expect(sec).toContainText("Hook rate30,0%");
  await expect(sec).toContainText("Hold rate5,0%");
  await expect(sec.getByRole("list", { name: "Anúncios ligados" })).toContainText("Ligado pelo código no nome");

  await sec.getByRole("combobox", { name: "Anúncio para ligar" }).click();
  await page.getByRole("option", { name: new RegExp(manualAd) }).click();
  await sec.getByRole("button", { name: "Ligar anúncio" }).click();
  await expect(page.getByText("Anúncio ligado ao criativo.")).toBeVisible();
  await expect(sec.getByRole("definition").first()).toHaveText("R$ 120,00");
  await expect(sec).toContainText("Ligado à mão");
  await expect(sec).toContainText("Não há outros anúncios sincronizados nas contas deste cliente.");

  await sec.getByRole("button", { name: `Desligar VIDEO_SORRISO_CR-${ref}_V1` }).click();
  await expect(page.getByText("Anúncio desligado do criativo.")).toBeVisible();
  await expect(sec.getByRole("definition").first()).toHaveText("R$ 20,00");
  // Desligado à mão: a sincronização não religa pelo código.
  const { data: n } = await admin.rpc("sync_link_creatives", { p_account: accountId });
  expect(n).toBe(0);
});

test("2. fadiga no anúncio ligado sugere fadigado na biblioteca", async ({ page }) => {
  const { data: ad } = await admin.from("ads").select("id").eq("ad_account_id", accountId).eq("name", manualAd).single();
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { error } = await admin.from("ad_alerts").insert({ organization_id: org!.id, client_id: clientId, kind: "fadiga", subject: ad!.id, title: `Criativo cansado: ${clientName}` });
  if (error) throw error;
  await login(page, "Ana");
  await page.goto(`/criativos/biblioteca?cliente=${clientId}`);
  const card = page.getByRole("list", { name: "Biblioteca de criativos" }).getByRole("listitem").filter({ hasText: angle });
  await expect(card).toContainText("Sugestão: fadigado");
  await card.getByRole("button", { name: `Marcar ${angle} como fadigado` }).click();
  await expect(page.getByText("Criativo marcado como fadigado.")).toBeVisible();
  await expect(card).toContainText("Fadigado");
  await expect(card).not.toContainText("Sugestão: fadigado");
});

test("3. social media vê os números, mas não liga nem desliga", async ({ page }) => {
  await login(page, "Sol");
  await page.goto(`/criativos/${taskId}`);
  const sec = page.getByRole("region", { name: "Desempenho nos anúncios" });
  await expect(sec.getByRole("definition").first()).toHaveText("R$ 20,00");
  await expect(sec).toContainText(manualAd);
  await expect(sec.getByRole("button", { name: /^Desligar/ })).toHaveCount(0);
  await expect(sec.getByRole("button", { name: "Ligar anúncio" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
