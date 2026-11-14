import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Calendário de marketing (RF-PLA-04/05, prompt 05 item 12 e roteiro item 9): datas nacionais,
 * data do cliente a partir de uma nacional com o pedido de criativo saindo na hora, data futura com
 * o pedido agendado, social media cadastra sem pedido e quem não é da equipe não vê.
 * O job diário (pedido que entra na antecedência, erro e não duplicar) é coberto por 20_calendario_marketing.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && publishable && adminEmail && adminPassword);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Loja Calendário ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";

const spToday = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() - 3 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.mkt.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

async function pick(page: Page, label: string, option: string) {
  await page.getByRole("dialog").getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  await makeUser("Sami", "social_media");
  await makeUser("Edi", "editor_video");
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "gerenciamento").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Sami.id });
});

test("1. datas nacionais e data do cliente criada a partir de uma nacional, com o pedido saindo na hora", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  // Período que contém uma data nacional próxima: Natal deste ano.
  const year = spToday().slice(0, 4);
  await page.goto(`/calendario-marketing?de=${year}-12`);
  await expect(page.getByRole("heading", { name: `Dezembro de ${year}` })).toBeVisible();
  const natal = page.getByRole("listitem").filter({ hasText: "Natal" });
  await expect(natal.getByText("Data nacional")).toBeVisible();

  await natal.getByRole("button", { name: "Usar Natal para um cliente" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Nome da data")).toHaveValue("Natal");
  await pick(page, "Cliente", clientName);
  await dialog.getByLabel("Pedir o criativo sozinho antes da data").check();
  // Natal está a mais de 15 dias? Se não, o pedido sai ao salvar; ajusta a antecedência para cair hoje.
  await dialog.getByLabel("Quantos dias antes pedir").fill("90");
  await expect(dialog.getByText("O pedido sai assim que você salvar.")).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar data" }).click();
  await expect(dialog.getByText("Revise os campos destacados.")).toBeVisible();
  await expect(dialog.getByText("Escolha o formato.")).toBeVisible();
  await pick(page, "Formato", "Imagem");
  await pick(page, "Objetivo", "Vendas");
  await dialog.getByLabel("Ângulo ou mensagem").fill("Presente de Natal com frete grátis");
  await dialog.getByLabel("Público").fill("Clientes da loja");
  await dialog.getByLabel("Chamada (CTA)").fill("Compre agora");
  await dialog.getByRole("button", { name: "Salvar data" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("O pedido de criativo já foi para a fila de Criativos.")).toBeVisible();

  const row = page.getByRole("listitem").filter({ hasText: clientName });
  await expect(row.getByRole("link", { name: "Criativo pedido" })).toBeVisible();
  const { data: d } = await admin.from("marketing_dates").select("request_task_id").eq("client_id", clientId).single();
  const { data: req } = await admin.from("creative_requests").select("campaign, angle, format").eq("task_id", d!.request_task_id!).single();
  expect(req).toEqual({ campaign: "Natal", angle: "Presente de Natal com frete grátis", format: "imagem" });
  await row.getByRole("link", { name: "Criativo pedido" }).click();
  await expect(page).toHaveURL(new RegExp(`/criativos/${d!.request_task_id}`));
});

test("2. data futura fica com o pedido agendado", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  const on = plusDays(60);
  await page.goto(`/calendario-marketing?de=${on.slice(0, 7)}&cliente=${clientId}`);
  await page.getByRole("button", { name: "Nova data" }).click();
  const dialog = page.getByRole("dialog");
  await pick(page, "Cliente", clientName);
  await dialog.getByLabel("Nome da data").fill(`Aniversário da loja ${stamp}`);
  await dialog.getByLabel(/^Data/).fill(on);
  await pick(page, "Tipo", "Evento");
  await dialog.getByLabel("Pedir o criativo sozinho antes da data").check();
  await expect(dialog.getByText(`O pedido sai em ${br(plusDays(45))}.`)).toBeVisible();
  await pick(page, "Formato", "Reels");
  await pick(page, "Objetivo", "Engajamento");
  await dialog.getByLabel("Ângulo ou mensagem").fill("10 anos de loja");
  await dialog.getByLabel("Público").fill("Seguidores");
  await dialog.getByLabel("Chamada (CTA)").fill("Comemore com a gente");
  await dialog.getByRole("button", { name: "Salvar data" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("listitem").filter({ hasText: `Aniversário da loja ${stamp}` });
  await expect(row.getByText(`Pedido de criativo sai em ${br(plusDays(45))}`)).toBeVisible();
  // Sem cliente no filtro, as nacionais aparecem; com cliente, só as dele.
  await expect(page.getByText("Data nacional")).toHaveCount(0);
});

test("3. social media cadastra data sem pedido; editor fora da equipe não vê (tela e consulta direta)", async ({ page }) => {
  await login(page, people.Sami.email, pw);
  await page.goto(`/calendario-marketing?de=${plusDays(60).slice(0, 7)}`);
  await page.getByRole("button", { name: "Nova data" }).click();
  const dialog = page.getByRole("dialog");
  await pick(page, "Cliente", clientName);
  await expect(dialog.getByText(/Para agendar um pedido de criativo para este cliente/)).toBeVisible();
  await dialog.getByLabel("Nome da data").fill(`Live com influenciadora ${stamp}`);
  await dialog.getByLabel(/^Data/).fill(plusDays(62));
  await pick(page, "Tipo", "Evento");
  await dialog.getByRole("button", { name: "Salvar data" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`Live com influenciadora ${stamp}`)).toBeVisible();

  await login(page, people.Edi.email, pw);
  await page.goto(`/calendario-marketing?de=${plusDays(60).slice(0, 7)}`);
  await expect(page.getByRole("heading", { name: "Calendário de marketing" })).toBeVisible();
  await expect(page.getByText(clientName)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nova data" })).toHaveCount(0);
  const asEdi = createClient(url, publishable, { auth: { persistSession: false } });
  await asEdi.auth.signInWithPassword({ email: people.Edi.email, password: pw });
  const { data } = await asEdi.from("marketing_dates").select("id").eq("client_id", clientId);
  expect(data).toEqual([]);
  const { error } = await asEdi.rpc("save_marketing_date", { p: { client_id: clientId, title: "Invasão", on_date: plusDays(10), kind: "outro" } });
  expect(error?.code).toBe("42501");
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
