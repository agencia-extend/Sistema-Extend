import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Configurações › Integrações (RF-ADS-01/02): o que falta configurar e o endereço de retorno; contas
 * encontradas ligadas a clientes (com sugestão pelo cadastro do cliente); quem não conecta não entra.
 * O OAuth real precisa das chaves da Meta e do Google (docs/11); sem elas, conectar volta com o aviso.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && adminEmail && adminPassword);
const metaReady = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const digits = stamp.slice(-9);
const pw = `Senha${stamp}x9`;
const clientName = `Loja Integra ${stamp}`;
const accA = `Conta Loja ${stamp}`;
const accB = `Conta Outra ${stamp}`;
let clientId = "";
let gestor = { id: "", email: "" };

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
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  // O cliente já tem a conta A em "Contas e acessos": a tela sugere o vínculo.
  await admin.from("client_accounts").insert({ client_id: clientId, kind: "ad_account_meta", value: `1${digits}` });
  const { error: e2 } = await admin.from("ad_accounts").insert([
    { organization_id: org!.id, provider: "meta", external_id: `act_1${digits}`, name: accA, status_label: "Ativa" },
    { organization_id: org!.id, provider: "google", external_id: `2${digits}`, name: accB, status_label: "Ativa" },
  ]);
  if (e2) throw e2;
  const { data: r } = await admin.from("roles").select("id").eq("key", "gestor_trafego").single();
  const email = `gestor.int.${stamp}@extend.test`;
  const { data: u, error: e3 } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `Gestor ${stamp}`, role_id: r!.id } });
  if (e3) throw e3;
  gestor = { id: u.user.id, email };
});

test("1. situação da configuração e endereço de retorno", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/configuracoes/integracoes");
  await expect(page.getByRole("heading", { name: "Integrações", level: 1 })).toBeVisible();
  const meta = page.getByRole("region", { name: "Meta (Facebook e Instagram)" });
  if (metaReady) await expect(meta.getByText("Configuração completa no servidor.")).toBeVisible();
  else {
    await expect(meta.getByText("Ainda não dá para conectar.")).toBeVisible();
    await expect(meta.getByText("META_APP_ID", { exact: true })).toBeVisible();
    // Conectar sem configuração volta com o aviso, sem ir para a Meta.
    await page.goto("/api/integracoes/meta/conectar?para=agencia");
    await expect(page).toHaveURL(/\/configuracoes\/integracoes\?erro=configuracao/);
    await expect(page.getByText("A conexão ainda não está configurada no servidor.")).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Meta (Facebook e Instagram)" }).getByText(/\/api\/integracoes\/meta\/retorno$/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Google Ads (MCC)" }).getByText(/\/api\/integracoes\/google\/retorno$/)).toBeVisible();
});

test("2. contas encontradas: sugestão do cliente, incluir e escolher cliente", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/configuracoes/integracoes");
  const rowA = page.getByRole("listitem").filter({ hasText: accA });
  // Sem cliente, não dá para incluir.
  await expect(rowA.getByRole("switch", { name: `Incluir ${accA} no sistema` })).toBeDisabled();
  await rowA.getByRole("button", { name: `Usar ${clientName} (já tem esta conta cadastrada)` }).click();
  await expect(page.getByText("Cliente salvo.")).toBeVisible();
  await rowA.getByRole("switch", { name: `Incluir ${accA} no sistema` }).click();
  await expect(page.getByText("Conta incluída.")).toBeVisible();
  await expect(rowA.getByRole("switch", { name: `Incluir ${accA} no sistema` })).toBeChecked();

  const rowB = page.getByRole("listitem").filter({ hasText: accB });
  await rowB.getByLabel(`Cliente da conta ${accB}`).click();
  await page.getByRole("option", { name: clientName, exact: true }).click();
  await expect
    .poll(async () => (await admin.from("ad_accounts").select("name, client_id, is_enabled").in("name", [accA, accB]).order("name")).data)
    .toEqual([
    { name: accA, client_id: clientId, is_enabled: true },
    { name: accB, client_id: clientId, is_enabled: false },
    ]);
  // A conta do Google entra em "Contas e acessos" do cliente; a da Meta já estava (não duplica).
  const { data: links } = await admin.from("client_accounts").select("kind").eq("client_id", clientId).order("kind");
  expect(links).toEqual([{ kind: "ad_account_google" }, { kind: "ad_account_meta" }]);
});

test("3. gestor de tráfego não abre Integrações nem liga contas", async ({ page }) => {
  await login(page, gestor.email, pw);
  await page.goto("/configuracoes/perfil");
  await expect(page.getByRole("link", { name: "Integrações" })).toHaveCount(0);
  await page.goto("/configuracoes/integracoes");
  await expect(page).toHaveURL(/sem-acesso/);
  await page.goto("/api/integracoes/google/conectar?para=agencia");
  await expect(page).toHaveURL(/sem-acesso/);
});

test.afterAll(async () => {
  if (!configured) return;
  await admin.from("ad_accounts").delete().in("name", [accA, accB]);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  if (gestor.id) await admin.auth.admin.deleteUser(gestor.id);
});
