import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * RF-PER-10: desativar alguém com trabalho em aberto exige escolher quem assume; tudo passa para essa
 * pessoa (demanda, equipe do cliente, responsável pela comunicação, lead), ela recebe um aviso com o
 * resumo e quem saiu não entra mais. As travas no banco estão em 21_desativar_com_repasse.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && adminEmail && adminPassword);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Loja Repasse ${stamp}`;
const taskTitle = `Relatório do mês ${stamp}`;
const people: Record<string, { id: string; email: string; name: string }> = {};
let clientId = "";

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

function must(r: { error: unknown }) {
  if (r.error) throw r.error;
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.rep.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Leo", "comercial");
  await makeUser("Cris", "comercial");
  await makeUser("Sami", "social_media");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo", owner_id: people.Leo.id }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "gerenciamento").single();
  must(await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Leo.id }));
  must(await admin.from("tasks").insert({ organization_id: org!.id, client_id: clientId, type: "geral", title: taskTitle, assignee_id: people.Leo.id }));
  const { data: pipe } = await admin.from("pipelines").select("id").eq("is_default", true).limit(1).single();
  const { data: stage } = await admin.from("pipeline_stages").select("id").eq("pipeline_id", pipe!.id).order("position").limit(1).single();
  must(await admin.from("leads").insert({ organization_id: org!.id, pipeline_id: pipe!.id, stage_id: stage!.id, name: `Lead ${stamp}`, phone: `5551${stamp.slice(-9)}`, source: "indicacao", owner_id: people.Leo.id, created_by: people.Leo.id }));
});

test("1. desativar com trabalho em aberto: escolhe quem assume e tudo passa para essa pessoa", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.waitForURL("**/inicio**");
  await page.goto(`/configuracoes/usuarios/${people.Leo.id}`);
  await page.getByRole("button", { name: "Desativar acesso" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("1 demanda aberta (responsável, edição ou gravação)")).toBeVisible();
  await expect(dialog.getByText("equipe de 1 cliente")).toBeVisible();
  await expect(dialog.getByText("responsável pela comunicação com 1 cliente")).toBeVisible();
  await expect(dialog.getByText("1 lead aberto")).toBeVisible();

  await dialog.getByRole("button", { name: "Repassar e desativar" }).click();
  await expect(dialog.getByText("Escolha quem assume o trabalho em aberto.")).toBeVisible();

  // Com leads abertos, só quem tem acesso ao Comercial aparece.
  await dialog.getByLabel("Quem assume", { exact: true }).click();
  await expect(page.getByRole("option", { name: people.Sami.name })).toHaveCount(0);
  await page.getByRole("option", { name: people.Cris.name, exact: true }).click();
  await dialog.getByRole("button", { name: "Repassar e desativar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Acesso desativado e trabalho repassado/)).toBeVisible();
  await expect(page.getByText("Acesso desativado", { exact: true })).toBeVisible();

  const { data: task } = await admin.from("tasks").select("assignee_id").eq("title", taskTitle).single();
  expect(task?.assignee_id, "responsável da demanda").toBe(people.Cris.id);
  const { data: client } = await admin.from("clients").select("owner_id").eq("id", clientId).single();
  expect(client!.owner_id).toBe(people.Cris.id);
  const { data: members } = await admin.from("client_members").select("profile_id").eq("client_id", clientId);
  expect(members!.map((m) => m.profile_id)).toEqual([people.Cris.id]);
  const { data: lead } = await admin.from("leads").select("owner_id").eq("name", `Lead ${stamp}`).single();
  expect(lead!.owner_id).toBe(people.Cris.id);
  const { data: notes } = await admin.from("notifications").select("title, body").eq("user_id", people.Cris.id);
  expect(notes).toEqual([{ title: `Você assumiu o trabalho de ${people.Leo.name}`, body: "1 demanda aberta, equipe de 1 cliente, comunicação com 1 cliente, 1 lead." }]);
});

test("2. quem assumiu abre o aviso e vê o lead; quem saiu não entra", async ({ page }) => {
  await login(page, people.Cris.email, pw);
  await page.waitForURL("**/inicio**");
  const { data: n } = await admin.from("notifications").select("href").eq("user_id", people.Cris.id).single();
  expect(n!.href).toBe("/comercial");
  await page.goto("/comercial");
  await expect(page.getByText(`Lead ${stamp}`).first()).toBeVisible();

  await login(page, people.Leo.email, pw);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test.afterAll(async () => {
  if (!configured) return;
  await admin.from("leads").delete().eq("name", `Lead ${stamp}`);
  if (clientId) {
    await admin.from("tasks").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
