import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/** Modelos de demanda, repetição e rotinas semanais por serviço. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const dbUrl = process.env.SUPABASE_DB_URL!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && dbUrl && adminEmail && adminPassword);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_*, SUPABASE_DB_URL e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Teste Clínica ${stamp}`;
const routineTitle = `Stories do dia ${stamp}`;
const people: Record<string, { id: string; email: string; name: string }> = {};
let clientId = "";
let taskId = "";

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string, sector: string) {
  const email = `${key.toLowerCase()}.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  const { data: s } = await admin.from("sectors").select("id").eq("key", sector).single();
  await admin.from("profile_sectors").insert({ profile_id: data.user.id, sector_id: s!.id });
  people[key] = { id: data.user.id, email, name };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Joana", "coord_conteudo", "conteudo");
  await makeUser("Madu", "social_media", "gerenciamento");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c!.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "gerenciamento").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 12, starts_on: "2020-01-01" });
  const { data: sec } = await admin.from("sectors").select("id").eq("key", "gerenciamento").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sec!.id, profile_id: people.Madu.id });
});

test("1. coordenação cria demanda a partir de um modelo, repetindo toda semana → a Madu é avisada", async ({ page }) => {
  await login(page, people.Joana.email, pw);
  await page.goto("/tarefas");
  await page.getByRole("button", { name: "Nova demanda" }).click();
  await page.getByRole("combobox", { name: "Começar de um modelo" }).click();
  await page.getByRole("option", { name: "Revisão semanal das campanhas" }).click();
  await expect(page.getByLabel("Título")).toHaveValue("Revisão semanal das campanhas");
  await expect(page.getByRole("combobox", { name: "Repetir" })).toHaveText("Toda semana");
  await page.getByLabel("Título").fill(`Revisão semanal ${stamp}`);
  await page.getByRole("combobox", { name: "Cliente" }).click();
  await page.getByRole("option", { name: clientName }).click();
  await page.getByRole("combobox", { name: "Responsável" }).click();
  await page.getByRole("option", { name: people.Madu.name }).click();
  await page.getByRole("button", { name: "Criar demanda" }).click();
  await page.waitForURL(/\/tarefas\/[0-9a-f-]{36}$/);
  taskId = page.url().split("/").pop()!;
  await expect(page.getByRole("combobox", { name: "Repetir" })).toHaveText("Toda semana");

  const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Madu.id).eq("kind", "assigned");
  expect(count).toBeGreaterThan(0);
});

test("2. a Madu conclui → a próxima da série nasce para ela, 7 dias depois", async ({ page }) => {
  await login(page, people.Madu.email, pw);
  await page.goto(`/tarefas/${taskId}`);
  await page.getByRole("button", { name: "Feito", exact: true }).click();
  await expect(page.getByText("Movido para Feito.")).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Abrir a próxima da série" }).click();
  await page.waitForURL((u) => /\/tarefas\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.includes(taskId));

  const { data: t } = await admin.from("tasks").select("due_at, repeat_next_id").eq("id", taskId).single();
  const { data: next } = await admin.from("tasks").select("assignee_id, due_at, status").eq("id", t!.repeat_next_id!).single();
  expect(next!.assignee_id).toBe(people.Madu.id);
  expect(next!.status).toBe("pendente");
  expect(new Date(next!.due_at!).getTime() - new Date(t!.due_at!).getTime()).toBe(7 * 86_400_000);
});

test("3. admin cria uma rotina semanal pela tela → o cliente com Gerenciamento ganha a demanda", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/configuracoes/rotinas");
  await expect(page.getByText("Legendas da semana")).toBeVisible();
  await page.getByRole("button", { name: "Nova rotina" }).click();
  await page.getByLabel("Nome da demanda").fill(routineTitle);
  await page.getByRole("combobox", { name: "Serviço do cliente" }).click();
  await page.getByRole("option", { name: "Gerenciamento de redes" }).click();
  await page.getByRole("combobox", { name: "Setor responsável" }).click();
  await page.getByRole("option", { name: "Gerenciamento" }).click();
  // Dia de hoje em São Paulo, para a rotina valer já.
  const today = new Date(Date.now() - 3 * 3600_000).getUTCDay();
  await page.getByRole("combobox", { name: "Dia da semana" }).click();
  await page.getByRole("option", { name: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][today] }).click();
  await page.getByRole("button", { name: "Salvar rotina" }).click();
  await expect(page.getByText(/Rotina criada/)).toBeVisible();
  await expect(page.getByText(routineTitle)).toBeVisible();

  const sql = postgres(dbUrl, { ssl: "require", max: 1, onnotice: () => {} });
  try {
    await sql`select private.routines_tick()`;
    await sql`select private.routines_tick()`;
  } finally {
    await sql.end();
  }
  const { data } = await admin.from("tasks").select("assignee_id").eq("client_id", clientId).eq("title", routineTitle);
  expect(data).toHaveLength(1);
  expect(data![0].assignee_id).toBe(people.Madu.id);
});

test("4. social media não vê Rotinas e modelos no menu nem abre a página", async ({ page }) => {
  await login(page, people.Madu.email, pw);
  await page.goto("/configuracoes");
  await expect(page.getByRole("link", { name: /Rotinas e modelos/ })).toHaveCount(0);
  await page.goto("/configuracoes/rotinas").catch(() => undefined); // o redirecionamento pode interromper o carregamento
  await expect(page).toHaveURL(/sem-acesso/);
  await page.goto("/tarefas?aba=todas");
  await expect(page.getByRole("link", { name: new RegExp(routineTitle) }).filter({ visible: true })).toBeVisible();
});

test("5. painel operacional: a coordenação vê e filtra pela Madu; a Madu não vê o painel", async ({ page }) => {
  await login(page, people.Joana.email, pw);
  await expect(page.getByRole("heading", { name: "Operacional" })).toBeVisible();
  await page.getByRole("navigation", { name: "Pessoa" }).getByRole("link", { name: /^Madu/ }).click();
  await expect(page.getByText(`Demandas de ${people.Madu.name}.`)).toBeVisible();
  await page.getByRole("navigation", { name: "Período" }).getByRole("link", { name: "Tudo" }).click();
  await expect(page.getByRole("link", { name: /Concluídas \(tudo\)/ })).toContainText(/[1-9]/);

  await login(page, people.Madu.email, pw);
  await expect(page.getByRole("heading", { name: "Minhas pendências" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operacional" })).toHaveCount(0);
});

test.afterAll(async () => {
  if (!configured) return;
  await admin.from("service_routines").delete().eq("title", routineTitle);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) {
    await admin.from("tasks").delete().is("client_id", null).eq("created_by", p.id);
    await admin.auth.admin.deleteUser(p.id);
  }
});
