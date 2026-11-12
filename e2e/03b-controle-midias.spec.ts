import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { cycleOf, periodLabel, todayKey } from "../src/domain/media";

/** Roteiro da etapa 03B (docs/09): critérios de aceite do briefing de mídias, contra o Supabase de desenvolvimento. */
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
const theme = `Tour pelo decorado ${stamp}`;
const people: Record<string, { id: string; email: string; name: string }> = {};
let clientId = "";
let taskId = "";
let start = "";

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

const step = async (page: Page, name: string) => {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByText(`Movido para ${name}.`)).toBeVisible();
};

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Jackeline", "coord_conteudo", "conteudo");
  await makeUser("Juliana", "editor_video", "edicao");
  await makeUser("OutraEditora", "editor_video", "edicao");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  // Contrato iniciado no dia 14 de dois meses atrás: o mês do cliente vira todo dia 14.
  const now = new Date(Date.now() - 3 * 3600_000);
  start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 14)).toISOString().slice(0, 10);
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: `Teste Imobiliária ${stamp}`, status: "ativo", contract_start: start }).select("id").single();
  if (error) throw error;
  clientId = c!.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "pacote_videos").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 2, starts_on: start });
  const { data: sec } = await admin.from("sectors").select("id").eq("key", "conteudo").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sec!.id, profile_id: people.Jackeline.id });
  // O job diário abre o mês do cliente e cria um conteúdo por item contratado.
  const sql = postgres(dbUrl, { ssl: "require", max: 1, onnotice: () => {} });
  try {
    await sql`select private.monthly_slots_tick()`;
  } finally {
    await sql.end();
  }
});

test("1. contrato iniciado no dia 14 → mês do cliente de 14 a 14, com um conteúdo por item contratado", async ({ page }) => {
  await login(page, people.Jackeline.email, pw);
  await page.goto(`/clientes/${clientId}`);
  await expect(page.getByRole("link", { name: "Controle de Mídias" })).toHaveAttribute("href", `/clientes/${clientId}/midias`);
  await page.goto(`/clientes/${clientId}/midias`);
  // Antes do dia 14 ainda é o mês 2 do cliente; do dia 14 em diante, o mês 3.
  const cycle = cycleOf(start, todayKey())!;
  expect([2, 3]).toContain(cycle.number);
  await expect(page.getByRole("heading", { name: new RegExp(`^Mês ${cycle.number}`) })).toBeVisible();
  await expect(page.getByText(periodLabel(cycle.startsOn, cycle.endsOn), { exact: true })).toBeVisible();
  expect(periodLabel(cycle.startsOn, cycle.endsOn)).toMatch(/^14\/\d{2} a 14\/\d{2}$/);
  await expect(page.getByRole("link", { name: /^Vídeo \d\/2/ }).filter({ visible: true })).toHaveCount(2);
  const { data } = await admin.from("client_months").select("number, starts_on").eq("client_id", clientId);
  expect(data).toHaveLength(1);
  expect(data![0].starts_on.slice(8)).toBe("14");
});

test("2. definir quem edita → o conteúdo aparece no quadro de Edição dessa pessoa, que é avisada", async ({ page }) => {
  await login(page, people.Jackeline.email, pw);
  await page.goto(`/clientes/${clientId}/midias`);
  await page.getByRole("button", { name: /^(Editar conteúdo 1|Editar$)/ }).filter({ visible: true }).first().click();
  await page.getByLabel("Tema").fill(theme);
  await page.getByLabel(/^Objetivo/).fill("Autoridade");
  await page.getByRole("combobox", { name: "Quem edita" }).click();
  await page.getByRole("option", { name: people.Juliana.name }).click();
  await page.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(page.getByText("Conteúdo salvo.")).toBeVisible();
  await expect(page.getByRole("link", { name: theme }).filter({ visible: true })).toBeVisible();

  const { data: t } = await admin.from("tasks").select("id").eq("client_id", clientId).eq("title", theme).single();
  taskId = t!.id;
  const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Juliana.id).eq("kind", "assigned");
  expect(count).toBeGreaterThan(0);

  await login(page, people.Juliana.email, pw);
  await page.goto("/setores");
  await page.waitForURL("**/setores/edicao");
  await expect(page.getByRole("region", { name: "Não iniciado" }).getByText(theme)).toBeVisible();
});

test("3. a editora pega o card (arrastando no desktop, pelo card no celular) e entrega o link do vídeo pronto", async ({ page }, info) => {
  await login(page, people.Juliana.email, pw);
  await page.goto("/setores/edicao");
  const card = page.getByRole("region", { name: "Não iniciado" }).locator('[aria-roledescription="card arrastável"]').filter({ hasText: theme });
  if (info.project.name === "celular") {
    // No celular o caminho natural é abrir o card e tocar na etapa.
    await card.getByRole("link").click();
    await page.waitForURL(`**/tarefas/${taskId}`);
    await step(page, "Edição");
    await page.goto("/setores/edicao");
  } else {
  const target = page.getByRole("region", { name: "Em andamento" });
  await target.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  // Arrasta de verdade: segura, anda em passos (o quadro só inicia o arraste depois de 6px) e solta.
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 4, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(to.height / 2, 90), { steps: 14 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect(page.getByText("Movido para Edição.")).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Em andamento" }).getByText(theme)).toBeVisible();
  const { data } = await admin.from("tasks").select("assignee_id, workflow_steps(name)").eq("id", taskId).single();
  expect(data!.assignee_id).toBe(people.Juliana.id);

  await page.goto(`/tarefas/${taskId}`);
  await page.getByRole("button", { name: "Editar conteúdo" }).click();
  await page.getByLabel(/^Link do conteúdo final/).fill("https://drive.google.com/file/d/exemplo/view");
  await page.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(page.getByText("Conteúdo salvo.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Conteúdo final/ })).toBeVisible();
});

test("4. aprovação interna pede alteração (retrabalho) e depois leva até Finalizado → Controle de Mídias atualiza", async ({ page }) => {
  await login(page, people.Jackeline.email, pw);
  await page.goto(`/tarefas/${taskId}`);
  await step(page, "Revisão interna");
  await step(page, "Ajustes");
  await step(page, "Revisão interna");
  await step(page, "Aprovação do cliente");
  await step(page, "Programado");
  await step(page, "Publicado");

  await page.goto(`/clientes/${clientId}/midias`);
  await expect(page.getByRole("link", { name: "Publicado" }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/1 alteração/).filter({ visible: true })).toBeVisible();
  await expect(page.locator("dl").filter({ hasText: "Entregue" }).first()).toContainText("Entregue 1");

  await page.goto("/setores/edicao");
  await expect(page.getByRole("region", { name: "Finalizado" }).getByText(theme)).toBeVisible();
});

test("5. relatório: quantos vídeos cada editora finalizou no período (tela e CSV)", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/producao");
  const row = page.getByRole("row", { name: new RegExp(people.Juliana.name) });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell").nth(0)).toHaveText("1"); // finalizados
  await expect(row.getByRole("cell").nth(5)).toHaveText("1"); // alterações
  await expect(page.getByRole("link", { name: new RegExp(`Teste Imobiliária ${stamp}`) })).toContainText("1 de 2");

  const csv = await page.request.get("/producao/exportar");
  expect(csv.ok()).toBeTruthy();
  expect(await csv.text()).toContain(`"${people.Juliana.name}";"1";"1";"0"`);
});

test("6. outra editora não vê o card nem o conteúdo; editora não abre o Controle geral", async ({ page }) => {
  await login(page, people.OutraEditora.email, pw);
  await page.goto("/setores/edicao");
  await expect(page.getByText("Nenhum conteúdo no quadro ainda")).toBeVisible();
  await page.goto("/producao");
  await expect(page).toHaveURL(/sem-acesso/);

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await anon.auth.signInWithPassword({ email: people.OutraEditora.email, password: pw });
  const content = await anon.from("task_content").select("task_id").eq("task_id", taskId);
  expect(content.data ?? []).toHaveLength(0);
  const save = await anon.rpc("save_content", { p_task: taskId, p: { caption: "x" } });
  expect(save.error).not.toBeNull();
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
