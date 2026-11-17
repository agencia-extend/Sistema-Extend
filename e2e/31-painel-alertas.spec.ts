import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Painel de alertas (RF-ALE-03): a gestora do cliente vê os alertas abertos, reconhece um (vai para Reconhecidos com o
 * nome dela), resolve com a nota (vai para Resolvidos com quem e como, e o colega do tráfego recebe o aviso); a aba
 * Anúncios do cliente mostra os alertas em aberto; quem é de fora do cliente não vê. Os alertas entram como a
 * verificação automática grava (as regras e a resolução automática estão em 36_painel_alertas.test.sql).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Ótica Alertas ${stamp}`;
const people: Record<string, { id: string; email: string; name: string }> = {};
let clientId = "";
let accountId = "";
const saldo = `Saldo acabando: ${clientName}`;
const entrega = `Anúncios sem entrega: ${clientName}`;

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.alr.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Lia", "gestor_trafego");
  await makeUser("Rui", "gestor_trafego");
  await makeUser("Teo", "gestor_trafego");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sector!.id, profile_id: people.Lia.id },
    { client_id: clientId, sector_id: sector!.id, profile_id: people.Rui.id },
  ]);
  const { data: acc, error: e2 } = await admin
    .from("ad_accounts")
    .insert({ organization_id: org!.id, provider: "meta", external_id: `act_8${stamp.slice(-9)}`, name: `Conta Alertas ${stamp}`, client_id: clientId, is_enabled: true, is_prepay: true, funds_cents: 3000, account_status_code: 1, synced_at: new Date().toISOString() })
    .select("id")
    .single();
  if (e2) throw e2;
  accountId = acc.id;
  const { error: e3 } = await admin.from("ad_alerts").insert([
    { organization_id: org!.id, client_id: clientId, kind: "saldo", subject: accountId, title: saldo, body: `Conta Alertas ${stamp}: saldo de R$ 30,00, dá para cerca de 1 dia(s) no ritmo atual.`, href: `/clientes/${clientId}/anuncios` },
    { organization_id: org!.id, client_id: clientId, kind: "entrega", subject: accountId, title: entrega, body: "Tem campanha ativa, mas não gastou nada ontem.", href: `/clientes/${clientId}/anuncios` },
  ]);
  if (e3) throw e3;
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

test("1. reconhecer e resolver um alerta, com quem e como", async ({ page }) => {
  await login(page, "Lia");
  await page.goto("/trafego/alertas");
  await expect(page.getByRole("heading", { name: "Alertas", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Abertos/ })).toHaveAttribute("aria-current", "page");
  const list = page.getByRole("list", { name: "Alertas" });
  const row = list.getByRole("listitem").filter({ hasText: saldo });
  await expect(row).toContainText("Saldo acabando");
  await expect(row).toContainText(clientName);
  await expect(list.getByRole("listitem").filter({ hasText: entrega })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await row.getByRole("button", { name: `Reconhecer: ${saldo}` }).click();
  await expect(page.getByText("Alerta reconhecido. Os avisos diários dele param.")).toBeVisible();
  await expect(list.getByRole("listitem").filter({ hasText: saldo })).toHaveCount(0);

  await page.getByRole("link", { name: /^Reconhecidos/ }).click();
  await expect(page).toHaveURL(/situacao=reconhecidos/);
  const acked = page.getByRole("list", { name: "Alertas" }).getByRole("listitem").filter({ hasText: saldo });
  await expect(acked).toContainText(`Reconhecido por ${people.Lia.name}`);
  await acked.getByRole("button", { name: `Resolver: ${saldo}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Resolver" }).click();
  await expect(dialog.getByText("Conte em poucas palavras como foi resolvido.")).toBeVisible();
  await dialog.getByLabel("Como foi resolvido").fill("Cliente recarregou R$ 500 no Pix.");
  await dialog.getByRole("button", { name: "Resolver" }).click();
  await expect(page.getByText("Alerta resolvido.")).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: "Resolvidos" }).click();
  const solved = page.getByRole("list", { name: "Alertas" }).getByRole("listitem").filter({ hasText: saldo });
  await expect(solved).toContainText(`Resolvido por ${people.Lia.name}`);
  await expect(solved).toContainText("Cliente recarregou R$ 500 no Pix.");
  await expect(solved.getByRole("button")).toHaveCount(0);

  const { data: notes } = await admin.from("notifications").select("body").eq("user_id", people.Rui.id).eq("title", `Alerta resolvido: ${saldo}`);
  expect(notes?.[0]?.body).toBe(`${people.Lia.name}: Cliente recarregou R$ 500 no Pix.`);
});

test("2. aba Anúncios mostra os alertas em aberto do cliente", async ({ page }) => {
  await login(page, "Rui");
  await page.goto(`/clientes/${clientId}/anuncios`);
  const section = page.getByRole("region", { name: "Alertas em aberto" });
  await expect(section.getByRole("listitem").filter({ hasText: entrega })).toBeVisible();
  await expect(section.getByText(saldo)).toHaveCount(0);
  await expect(section.getByRole("button", { name: `Reconhecer: ${entrega}` })).toBeVisible();
});

test("3. gestor de fora do cliente não vê os alertas dele", async ({ page }) => {
  await login(page, "Teo");
  await page.goto("/trafego/alertas");
  await expect(page.getByRole("heading", { name: "Alertas", level: 1 })).toBeVisible();
  await expect(page.getByText(clientName)).toHaveCount(0);
  await page.goto("/trafego/alertas?situacao=resolvidos");
  await expect(page.getByText(saldo)).toHaveCount(0);
});
