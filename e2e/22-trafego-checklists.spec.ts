import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Checklists do tráfego (RF-OTI-01/02) e painel de pendências (RF-OTI-04): a gestora faz o do dia pela
 * Rotina do tráfego (com problema de saldo, que avisa o atendimento), o da semana com decisão pela aba do
 * cliente, revisa o do dia; social media não abre a rotina. Regras no banco: 25_checklists_trafego.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Loja Checklist ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.ck.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

const mark = (dialog: Locator, item: string, status: "Ok" | "Problema" | "Não se aplica") =>
  dialog.getByRole("group", { name: item }).locator("label").filter({ hasText: new RegExp(`^${status}$`) }).click();

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Ana", "gestor_trafego");
  await makeUser("Sol", "social_media");
  await makeUser("Caio", "social_media");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo", owner_id: people.Caio.id }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  const { data: sectors } = await admin.from("sectors").select("id, key").in("key", ["trafego", "gerenciamento"]);
  const sid = (k: string) => sectors!.find((s) => s.key === k)!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sid("trafego"), profile_id: people.Ana.id },
    { client_id: clientId, sector_id: sid("gerenciamento"), profile_id: people.Sol.id },
  ]);
});

test("1. gestora faz o checklist do dia pela Rotina do tráfego; saldo com problema avisa o atendimento", async ({ page }) => {
  await login(page, "Ana");
  await page.goto("/trafego");
  await expect(page).toHaveURL(/\/trafego$/);
  const row = page.getByRole("row").filter({ hasText: clientName });
  await expect(row.getByText("Em aberto").first()).toBeVisible();

  await row.getByRole("button", { name: `Fazer o checklist de hoje: ${clientName}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Salvar checklist" }).click();
  await expect(dialog.getByText("Revise os itens destacados.")).toBeVisible();

  await mark(dialog, "Saldo e cobrança", "Problema");
  await mark(dialog, "Anúncios reprovados", "Ok");
  await mark(dialog, "Gasto x orçamento", "Ok");
  await mark(dialog, "Entrega", "Não se aplica");
  await dialog.getByRole("button", { name: "Salvar checklist" }).click();
  await expect(dialog.getByText("Conte qual é o problema.")).toBeVisible();
  await dialog.getByLabel(/^O que aconteceu em saldo e cobrança/).fill("Cartão recusado, saldo para 1 dia");
  await dialog.getByRole("button", { name: "Salvar checklist" }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByText("1 problema")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}-rotina-${test.info().project.name}.png`, fullPage: true });

  await expect.poll(async () => (await admin.from("traffic_checks").select("problems, done_by").eq("client_id", clientId).eq("kind", "diario").single()).data)
    .toEqual({ problems: 1, done_by: people.Ana.id });
  const { data: n } = await admin.from("notifications").select("user_id").eq("title", `Saldo ou cobrança: ${clientName}`);
  expect(n!.map((x) => x.user_id)).toEqual([people.Caio.id]);
});

test("2. checklist da semana com decisão pela aba do cliente; revisar o do dia", async ({ page }) => {
  await login(page, "Ana");
  await page.goto(`/clientes/${clientId}/trafego`);
  await page.getByRole("button", { name: "Fazer o da semana" }).click();
  const dialog = page.getByRole("dialog");
  await mark(dialog, "Criativos", "Ok");
  await mark(dialog, "Públicos", "Ok");
  await mark(dialog, "Custos", "Ok");
  await dialog.getByRole("button", { name: "Adicionar decisão" }).click();
  await dialog.getByLabel("Nome da campanha, conjunto ou anúncio da decisão 1").fill("[LEAD] Black Friday");
  await dialog.getByLabel("Decisão 1", { exact: true }).click();
  await page.getByRole("option", { name: "Escalar" }).click();
  await dialog.getByLabel("Motivo da decisão 1").fill("CPL 30% abaixo da meta há 7 dias");
  await dialog.getByRole("button", { name: "Salvar checklist" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await admin.from("traffic_checks").select("decisions").eq("client_id", clientId).eq("kind", "semanal").maybeSingle()).data?.decisions)
    .toEqual([{ level: "campanha", target: "[LEAD] Black Friday", decision: "escalar", why: "CPL 30% abaixo da meta há 7 dias" }]);
  await expect(page.getByText("Tudo ok")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}-aba-${test.info().project.name}.png`, fullPage: true });

  // O do dia abre com o que foi marcado; o saldo foi resolvido.
  await page.getByRole("button", { name: "Revisar" }).first().click();
  const again = page.getByRole("dialog");
  await expect(again.getByLabel(/^O que aconteceu em saldo e cobrança/)).toHaveValue("Cartão recusado, saldo para 1 dia");
  await mark(again, "Saldo e cobrança", "Ok");
  await again.getByRole("button", { name: "Salvar checklist" }).click();
  await expect(again).toBeHidden();
  await expect.poll(async () => (await admin.from("traffic_checks").select("problems").eq("client_id", clientId).eq("kind", "diario").single()).data?.problems).toBe(0);

  await page.goto(`/clientes/${clientId}/historico`);
  await expect(page.getByText(/Checklist diário de .*: problema em saldo e cobrança/)).toBeVisible();
});

test("3. social media não vê a Rotina do tráfego", async ({ page }) => {
  await login(page, "Sol");
  await expect(page.getByRole("link", { name: "Rotina do tráfego" })).toHaveCount(0);
  await page.goto("/trafego");
  await expect(page).toHaveURL(/sem-acesso/);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
