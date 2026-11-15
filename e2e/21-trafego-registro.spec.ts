import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Aba Tráfego do cliente: verba aprovada pelo cliente (RF-T2-03) com comprovante e aviso à equipe, e registro
 * de alterações (RF-OTI-03) com correção, histórico do cliente e exclusão. Quem não é do tráfego não vê a aba.
 * As regras no banco estão em 24_registro_trafego.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Loja Tráfego ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";

const spDay = (plus = 0) => new Date(Date.now() - 3 * 3600_000 + plus * 86400_000).toISOString().slice(0, 10);
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.trf.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  await makeUser("Ana", "gestor_trafego");
  await makeUser("Bia", "gestor_trafego");
  await makeUser("Sol", "social_media");
  const { data: sectors } = await admin.from("sectors").select("id, key").in("key", ["trafego", "gerenciamento"]);
  const sid = (k: string) => sectors!.find((s) => s.key === k)!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sid("trafego"), profile_id: people.Ana.id },
    { client_id: clientId, sector_id: sid("trafego"), profile_id: people.Bia.id },
    { client_id: clientId, sector_id: sid("gerenciamento"), profile_id: people.Sol.id },
  ]);
});

test("1. gestora registra a verba aprovada com comprovante; a outra gestora é avisada", async ({ page }) => {
  await login(page, "Ana");
  await page.goto(`/clientes/${clientId}`);
  await page.getByRole("navigation", { name: "Seções do cliente" }).getByRole("link", { name: "Tráfego" }).click();
  await expect(page.getByText("Nenhuma verba registrada")).toBeVisible();

  await page.getByRole("button", { name: "Registrar verba" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Registrar verba" }).click();
  await expect(dialog.getByText("Revise os campos destacados.")).toBeVisible();
  await dialog.getByLabel(/^Valor/).fill("3.100,00");
  await dialog.getByLabel("Plataforma", { exact: true }).click();
  await page.getByRole("option", { name: "Meta", exact: true }).click();
  await dialog.getByLabel(/^Início do período/).fill(spDay(0));
  await dialog.getByLabel(/^Fim do período/).fill(spDay(30));
  await dialog.getByLabel(/^Quem aprovou no cliente/).fill("Marcos (sócio)");
  await dialog.getByLabel("Por onde aprovou", { exact: true }).click();
  await page.getByRole("option", { name: "WhatsApp" }).click();
  await dialog.getByLabel("Comprovante da aprovação").setInputFiles({ name: "print-aprovacao.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await dialog.getByRole("button", { name: "Registrar verba" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Verba registrada. A equipe de tráfego do cliente foi avisada.")).toBeVisible();

  const row = page.getByRole("listitem").filter({ hasText: "Marcos (sócio)" });
  await expect(row.getByText("R$ 3.100,00")).toBeVisible();
  await expect(row.getByText("Vigente")).toBeVisible();
  await expect(row.getByText(`${br(spDay(0))} a ${br(spDay(30))}`)).toBeVisible();
  await expect(row.getByRole("button", { name: "Comprovante" })).toBeVisible();

  const { data: b } = await admin.from("budget_approvals").select("amount_cents, created_by, client_files(folder)").eq("client_id", clientId).single();
  expect(b).toMatchObject({ amount_cents: 310000, created_by: people.Ana.id, client_files: { folder: "trafego" } });
  const { data: n } = await admin.from("notifications").select("user_id").eq("title", `Verba aprovada: ${clientName}`);
  expect(n!.map((x) => x.user_id)).toEqual([people.Bia.id]);
});

test("2. registro de alterações: registrar, corrigir, aparecer no histórico e apagar", async ({ page }) => {
  await login(page, "Ana");
  await page.goto(`/clientes/${clientId}/trafego`);
  await page.getByRole("button", { name: "Registrar alteração" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tipo", { exact: true }).click();
  await page.getByRole("option", { name: "Orçamento" }).click();
  await dialog.getByLabel("Plataforma", { exact: true }).click();
  await page.getByRole("option", { name: "Meta", exact: true }).click();
  await dialog.getByLabel(/^O que mudou/).fill(`Orçamento Leads de R$ 50 para R$ 80 por dia ${stamp}`);
  await dialog.getByLabel(/^Por quê/).fill("CPL abaixo da meta há 5 dias");
  await dialog.getByRole("button", { name: "Registrar alteração" }).click();
  await expect(dialog).toBeHidden();
  const item = page.getByRole("listitem").filter({ hasText: `Orçamento Leads de R$ 50 para R$ 80 por dia ${stamp}` });
  await expect(item.getByText("CPL abaixo da meta há 5 dias")).toBeVisible();

  await item.getByRole("button", { name: /^Corrigir:/ }).click();
  await page.getByRole("dialog").getByLabel(/^Por quê/).fill("CPL abaixo da meta há 5 dias; escalar 60%");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar correção" }).click();
  await expect(item.getByText("CPL abaixo da meta há 5 dias; escalar 60%")).toBeVisible();

  await page.goto(`/clientes/${clientId}/historico`);
  await expect(page.getByText(`Alteração no tráfego: Orçamento Leads de R$ 50 para R$ 80 por dia ${stamp}`)).toBeVisible();

  // A outra gestora vê, mas não corrige o registro da Ana.
  await login(page, "Bia");
  await page.goto(`/clientes/${clientId}/trafego`);
  await expect(page.getByText("CPL abaixo da meta há 5 dias; escalar 60%")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Corrigir:/ })).toHaveCount(0);

  await login(page, "Ana");
  await page.goto(`/clientes/${clientId}/trafego`);
  await page.getByRole("button", { name: /^Apagar: Orçamento Leads/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("Nenhuma alteração registrada")).toBeVisible();
});

test("3. social media do cliente não vê a aba nem abre pela URL", async ({ page }) => {
  await login(page, "Sol");
  await page.goto(`/clientes/${clientId}`);
  await expect(page.getByRole("navigation", { name: "Seções do cliente" }).getByRole("link", { name: "Tráfego" })).toHaveCount(0);
  await page.goto(`/clientes/${clientId}/trafego`);
  await expect(page).toHaveURL(/sem-acesso/);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    const { data: files } = await admin.from("client_files").select("storage_path").eq("client_id", clientId);
    if (files?.length) await admin.storage.from("anexos").remove(files.map((f) => f.storage_path));
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
