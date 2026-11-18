import { createCipheriv, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Gestão das campanhas da Meta pelo sistema: o botão "Ajustar" aparece só para o tráfego do cliente e só em conta cuja
 * conexão tem ads_management; o diálogo leva a alteração até a Meta. Aqui a conexão de teste tem um token inválido:
 * a Meta recusa de verdade e a tela mostra o motivo em português, sem mexer no banco nem no histórico. (A alteração
 * aceita depende da permissão ads_management na conexão real da Extend; regras em 40_gestao_campanhas.test.sql.)
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const encKey = process.env.TOKEN_ENCRYPTION_KEY ?? "";
const configured = Boolean(url && secret && encKey);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento e TOKEN_ENCRYPTION_KEY.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Academia Ajustes ${stamp}`;
const campaign = `Leads matrícula ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";
let accountId = "";
let connId = "";

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(encKey.trim(), "base64"), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.ajc.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Lia", "gestor_trafego");
  await makeUser("Sol", "coord_conteudo");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  const { data: sectors } = await admin.from("sectors").select("id, key").in("key", ["trafego", "gerenciamento"]);
  const sid = (k: string) => sectors!.find((x) => x.key === k)!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sid("trafego"), profile_id: people.Lia.id },
    { client_id: clientId, sector_id: sid("gerenciamento"), profile_id: people.Sol.id },
  ]);
  // Conexão pessoal da gestora com ads_management e um token que a Meta vai recusar.
  const { data: conn, error: ce } = await admin.from("integration_connections").insert({
    organization_id: org!.id, provider: "meta", purpose: "ads", owner_kind: "user", profile_id: people.Lia.id, connected_by: people.Lia.id,
    scopes: ["ads_read", "ads_management"], token_enc: encrypt(`token-invalido-${stamp}`), account_name: `Lia ${stamp}`,
  }).select("id").single();
  if (ce) throw ce;
  connId = conn.id;
  const { data: acc, error: ae } = await admin.from("ad_accounts").insert({
    organization_id: org!.id, provider: "meta", external_id: `act_6${stamp.slice(-9)}`, name: `Conta Ajustes ${stamp}`, client_id: clientId,
    is_enabled: true, connection_id: connId, account_status_code: 1, synced_at: new Date().toISOString(),
  }).select("id").single();
  if (ae) throw ae;
  accountId = acc.id;
  await admin.from("ad_campaigns").insert({ ad_account_id: accountId, external_id: `9${stamp.slice(-12)}`, name: campaign, effective_status: "ACTIVE", status: "ACTIVE", daily_budget_cents: 5000 });
});

test.afterAll(async () => {
  if (!configured) return;
  if (accountId) await admin.from("ad_accounts").delete().eq("id", accountId);
  if (connId) await admin.from("integration_connections").delete().eq("id", connId);
  if (clientId) {
    await admin.from("change_logs").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. gestora abre Ajustar; a recusa da Meta aparece e nada muda", async ({ page }) => {
  await login(page, "Lia");
  await page.goto(`/clientes/${clientId}/anuncios`);
  await page.getByRole("button", { name: `Ajustar a campanha ${campaign}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Ajustar: ${campaign}` })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Situação: Ativo" })).toBeVisible();

  // Orçamento inválido: validação antes de ir à Meta.
  await dialog.getByLabel("Novo orçamento por dia (R$)").fill("abc");
  await dialog.getByRole("button", { name: "Salvar orçamento" }).click();
  await expect(dialog.getByText("Informe o orçamento diário. Ex.: 50,00")).toBeVisible();

  // Pausar: vai à Meta, que recusa o token de teste.
  await dialog.getByLabel("Motivo").fill("CPL acima da meta");
  await dialog.getByRole("button", { name: "Pausar a campanha" }).click();
  await expect(dialog.getByText("A conexão com a Meta expirou ou foi revogada. Reconecte em Configurações › Integrações.")).toBeVisible({ timeout: 30_000 });

  const { data: camp } = await admin.from("ad_campaigns").select("effective_status").eq("ad_account_id", accountId).single();
  expect(camp!.effective_status).toBe("ACTIVE");
  const { count } = await admin.from("change_logs").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  expect(count).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("2. sem ads_management na conexão, o botão não aparece", async ({ page }) => {
  await admin.from("integration_connections").update({ scopes: ["ads_read"] }).eq("id", connId);
  await login(page, "Lia");
  await page.goto(`/clientes/${clientId}/anuncios`);
  await expect(page.getByText(campaign)).toBeVisible();
  await expect(page.getByRole("button", { name: `Ajustar a campanha ${campaign}` })).toHaveCount(0);
  await admin.from("integration_connections").update({ scopes: ["ads_read", "ads_management"] }).eq("id", connId);
});

test("3. coordenação de conteúdo vê a campanha, mas não ajusta", async ({ page }) => {
  await login(page, "Sol");
  await page.goto(`/clientes/${clientId}/anuncios`);
  await expect(page.getByText(campaign)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Ajustar a campanha/ })).toHaveCount(0);
});
