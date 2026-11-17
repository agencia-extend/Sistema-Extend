import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Facebook do cliente: o gestor do cliente gera o link, o cliente abre sem login e segue para o Facebook;
 * gerar outro cancela o anterior; com a conexão feita, as contas aparecem e o gestor escolhe as que entram;
 * desconectar; gestor de fora do cliente não conecta. Regras no banco: 31_facebook_do_cliente.test.sql.
 * O login real no Facebook do cliente não é automatizado (é a tela da Meta).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const metaReady = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
const configured = Boolean(url && secret && metaReady);
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase e do app da Meta.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Clínica Facebook ${stamp}`;
const accName = `Conta da Dona ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";
let orgId = "";
let firstLink = "";

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.fbc.${stamp}@extend.test`;
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
  orgId = org!.id;
  const { data, error } = await admin.from("clients").insert({ organization_id: orgId, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Gil.id });
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    await admin.from("ad_accounts").delete().eq("client_id", clientId);
    await admin.from("integration_connections").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. gestor gera o link e o cliente abre sem login e segue para o Facebook", async ({ page, browser }) => {
  await login(page, "Gil");
  await page.goto(`/clientes/${clientId}/trafego`);
  const section = page.getByRole("region", { name: "Facebook do cliente" });
  await expect(section.getByText(/só conecta quem estiver cadastrado no app/)).toBeVisible();
  await section.getByRole("button", { name: "Gerar link para o cliente" }).click();
  await expect(page.getByText("Link gerado. Copie e envie ao cliente.")).toBeVisible();
  firstLink = (await section.locator("output").textContent())!.trim();
  expect(firstLink).toMatch(/\/conectar\/[A-Za-z0-9_-]{40,60}$/);
  await expect(section.getByRole("link", { name: "Enviar no WhatsApp" })).toHaveAttribute("href", /wa\.me/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  // O cliente, sem login no sistema.
  const ctx = await browser.newContext({ baseURL: base });
  const visitor = await ctx.newPage();
  await visitor.goto(new URL(firstLink).pathname);
  await expect(visitor.getByRole("heading", { name: "Conectar o seu Facebook à Agência Extend" })).toBeVisible();
  await expect(visitor.getByText(clientName)).toBeVisible();
  const href = await visitor.getByRole("link", { name: "Continuar com o Facebook" }).getAttribute("href");
  const res = await visitor.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const to = new URL(res.headers()["location"]);
  expect(to.hostname).toBe("www.facebook.com");
  expect(to.searchParams.get("redirect_uri")).toMatch(/\/api\/integracoes\/meta\/retorno$/);
  expect(to.searchParams.get("state")).toBeTruthy();
  expect(to.searchParams.get("config_id")).toBeTruthy();
  await ctx.close();
});

test("2. gerar outro link cancela o anterior; link inválido", async ({ page, browser }) => {
  await login(page, "Gil");
  await page.goto(`/clientes/${clientId}/trafego`);
  const section = page.getByRole("region", { name: "Facebook do cliente" });
  await expect(section.getByText(/aguardando o cliente/)).toBeVisible();
  await section.getByRole("button", { name: "Gerar outro" }).click();
  await expect(page.getByText("Link gerado. Copie e envie ao cliente.")).toBeVisible();

  const ctx = await browser.newContext({ baseURL: base });
  const visitor = await ctx.newPage();
  await visitor.goto(new URL(firstLink).pathname);
  await expect(visitor.getByRole("heading", { name: "Link indisponível" })).toBeVisible();
  await visitor.goto("/conectar/nao-existe");
  await expect(visitor.getByRole("heading", { name: "Link não encontrado" })).toBeVisible();
  await ctx.close();
});

test("3. com o Facebook conectado, o gestor escolhe as contas e desconecta", async ({ page }) => {
  // A troca do código pelo token é da Meta; aqui a conexão entra como o servidor gravaria.
  const { data: conn, error } = await admin
    .from("integration_connections")
    .insert({ organization_id: orgId, provider: "meta", purpose: "ads", owner_kind: "client", client_id: clientId, method: "oauth", account_name: "Dona da Clínica", token_enc: "iv.tag.x", expires_at: new Date(Date.now() + 50 * 86_400_000).toISOString(), connected_by: people.Gil.id })
    .select("id")
    .single();
  if (error) throw error;
  await admin.from("ad_accounts").insert({ organization_id: orgId, provider: "meta", external_id: `act_8${stamp.slice(-9)}`, name: accName, status_label: "Ativa", connection_id: conn.id, client_id: clientId });

  await login(page, "Gil");
  await page.goto(`/clientes/${clientId}/trafego`);
  const section = page.getByRole("region", { name: "Facebook do cliente" });
  await expect(section.getByText("Dona da Clínica")).toBeVisible();
  await expect(section.getByText(/pelo Facebook do cliente/)).toBeVisible();
  await section.getByRole("switch", { name: `Incluir a conta ${accName} no sistema` }).click();
  await expect(page.getByText("Conta incluída no sistema.")).toBeVisible();
  await expect.poll(async () => (await admin.from("ad_accounts").select("is_enabled").eq("name", accName).single()).data?.is_enabled).toBe(true);

  await section.getByRole("button", { name: "Desconectar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desconectar" }).click();
  await expect(page.getByText("Conexão desligada.")).toBeVisible();
  await expect(section.getByRole("button", { name: "Gerar link para o cliente" })).toBeVisible();
  // A conta continua com o cliente para quando conectar de novo.
  await expect(section.getByText(accName)).toBeVisible();
});

test("4. gestor de fora do cliente não conecta o Facebook dele", async ({ page }) => {
  await login(page, "Ivo");
  await page.goto(`/api/integracoes/meta/conectar?para=cliente&cliente=${clientId}`);
  await expect(page).toHaveURL(/sem-acesso/);
});
