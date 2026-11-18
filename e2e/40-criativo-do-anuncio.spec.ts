import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Pedir novo criativo a partir de um anúncio (RF-CRI-08): o anúncio com fadiga aberta tem "Pedir novo criativo" no
 * painel de alertas, na aba Anúncios do cliente e no criativo ligado. O pedido abre com cliente, campanha, objetivo,
 * formato, ângulo, referência (link do anúncio no Gerenciador) e prioridade alta; a gestora completa público, CTA e
 * prazo e envia. O pedido guarda o anúncio de origem e mostra o nome dele.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Ótica Cansada ${stamp}`;
const angle = `Lente grátis ${stamp}`;
const campaignName = `Lentes novembro ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";
let accountId = "";
let adId = "";
let adName = "";
let ref = 0;
let libTask = "";
const accExt = `act_8${stamp.slice(-9)}`;
const adExt = `9${stamp.slice(-12)}`;

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.cda.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Ana", "gestor_trafego");
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Ana.id });
  // Criativo aprovado na biblioteca (reels), ligado ao anúncio pelo código.
  const { data: t, error: te } = await admin.from("tasks").insert({ organization_id: org!.id, client_id: clientId, type: "criativo", title: angle }).select("id").single();
  if (te) throw te;
  libTask = t.id;
  await admin.from("creative_requests").insert({ task_id: t.id, client_id: clientId, requested_by: people.Ana.id, campaign: "Lentes", objective: "leads", format: "reels", angle, audience: "Adultos", cta: "Agendar" });
  const { data: lib, error: le } = await admin.from("creative_library").insert({ task_id: t.id, client_id: clientId, campaign: "Lentes", format: "reels", angle }).select("ref_number").single();
  if (le) throw le;
  ref = Number(lib.ref_number);
  const { data: acc, error: ae } = await admin
    .from("ad_accounts")
    .insert({ organization_id: org!.id, provider: "meta", external_id: accExt, name: `Conta Ótica ${stamp}`, client_id: clientId, is_enabled: true, account_status_code: 1, synced_at: new Date().toISOString() })
    .select("id")
    .single();
  if (ae) throw ae;
  accountId = acc.id;
  const { data: camp, error: ce } = await admin.from("ad_campaigns").insert({ ad_account_id: accountId, external_id: `c${stamp}`, name: campaignName, objective: "OUTCOME_LEADS", effective_status: "ACTIVE" }).select("id").single();
  if (ce) throw ce;
  adName = `REELS_LENTE_CR-${ref}_V1`;
  const { data: ad, error: de } = await admin.from("ads").insert({ ad_account_id: accountId, campaign_id: camp.id, external_id: adExt, name: adName, effective_status: "ACTIVE", frequency_7d: 3.6 }).select("id").single();
  if (de) throw de;
  adId = ad.id;
  const { error: se } = await admin.rpc("sync_link_creatives", { p_account: accountId });
  if (se) throw se;
  // Alerta de fadiga em aberto, como a verificação depois da sincronização abre.
  const { error: al } = await admin.from("ad_alerts").insert({
    organization_id: org!.id, client_id: clientId, kind: "fadiga", subject: adId, title: `Criativo cansado: ${adName}`,
    body: "Frequência 3,6 em 7 dias e CTR 30% menor.", href: `/clientes/${clientId}/anuncios`,
  });
  if (al) throw al;
});

test.afterAll(async () => {
  if (!configured) return;
  if (accountId) await admin.from("ad_accounts").delete().eq("id", accountId);
  if (clientId) {
    await admin.from("ad_alerts").delete().eq("client_id", clientId);
    await admin.from("tasks").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. do alerta de criativo cansado ao pedido preenchido e enviado", async ({ page }) => {
  await login(page, "Ana");
  await page.goto("/trafego/alertas");
  const row = page.getByRole("list", { name: "Alertas" }).getByRole("listitem").filter({ hasText: adName });
  await row.getByRole("link", { name: /Pedir novo criativo/ }).click();
  await page.waitForURL(`**/criativos/novo?anuncio=${adId}`);

  await expect(page.getByText(`A partir do anúncio “${adName}” (criativo cansado)`)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Cliente" })).toContainText(clientName);
  await expect(page.getByLabel("Campanha")).toHaveValue(campaignName);
  await expect(page.getByRole("combobox", { name: "Objetivo" })).toContainText("Cadastros (leads)");
  await expect(page.getByRole("combobox", { name: "Formato" })).toContainText("Reels");
  await expect(page.getByLabel("Ângulo / mensagem")).toHaveValue(`Nova versão: ${angle}`);
  await expect(page.getByLabel("Referência 1")).toHaveValue(`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${accExt.slice(4)}&selected_ad_ids=${adExt}`);
  await expect(page.getByRole("combobox", { name: "Prioridade" })).toContainText("Alta");
  await expect(page.getByLabel("Observações")).toHaveValue(new RegExp(`Criativo CR-${ref} .*frequência 3,6 em 7 dias`));
  // O resumo do cliente aparece ao lado, como no pedido normal.
  await expect(page.getByRole("complementary", { name: "Sobre o cliente" })).toContainText(`Sobre ${clientName}`);

  // Sem público, CTA e prazo não envia.
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByText("Preencha os campos obrigatórios para enviar.")).toBeVisible();
  await page.getByLabel("Público").fill("Adultos com miopia, 25 a 50 anos");
  await page.getByLabel("CTA (chamada)").fill("Agendar exame");
  const due = new Date(Date.now() + 5 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  await page.getByLabel("Prazo").fill(due);
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await page.waitForURL(/\/criativos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("region", { name: "Pedido" })).toContainText(`Pedido a partir do anúncio ${adName}`);

  const { data: reqs } = await admin.from("creative_requests").select("source_ad_ref, campaign, format, objective, tasks!inner(priority)").eq("client_id", clientId).not("source_ad_ref", "is", null);
  expect(reqs).toHaveLength(1);
  expect(reqs![0]).toMatchObject({ source_ad_ref: `meta:${adExt}`, campaign: campaignName, format: "reels", objective: "leads", tasks: { priority: "alta" } });
});

test("2. botão na aba Anúncios e no criativo; anúncio inválido abre em branco", async ({ page }) => {
  await login(page, "Ana");
  await page.goto(`/clientes/${clientId}/anuncios`);
  const card = page.getByRole("region", { name: "Anúncios" }).getByRole("listitem").filter({ hasText: adName });
  await expect(card.getByRole("link", { name: `Pedir novo criativo a partir de ${adName}` })).toHaveAttribute("href", `/criativos/novo?anuncio=${adId}`);
  // O alerta em aberto do cliente também tem o botão.
  await expect(page.getByRole("list", { name: "Alertas" }).getByRole("link", { name: /Pedir novo criativo/ })).toBeVisible();

  // No criativo, o anúncio ligado e cansado também tem o botão.
  await page.goto(`/criativos/${libTask}`);
  await expect(page.getByRole("list", { name: "Anúncios ligados" }).getByRole("link", { name: `Pedir novo criativo a partir de ${adName}` })).toBeVisible();

  await page.goto("/criativos/novo?anuncio=00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("status").filter({ hasText: "Não foi possível abrir o anúncio de origem" })).toBeVisible();
  await expect(page.getByLabel("Campanha")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
