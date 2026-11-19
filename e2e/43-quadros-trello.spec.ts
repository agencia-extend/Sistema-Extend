import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Quadros no estilo Trello:
 * 1. a social media cria um quadro para o cliente dela: ele nasce com as 6 colunas prontas; ela renomeia, reordena e
 *    cria coluna; cria uma demanda no quadro e arrasta o card para "A fazer";
 * 2. em Minhas tarefas › Quadro, o card está em "Fazendo"; ela arrasta para "Concluídas" e ele vai para a coluna de
 *    concluído do quadro do cliente;
 * 3. o administrador vê o quadro de todas as pessoas (e de uma pessoa); quem não distribui não escolhe pessoa.
 * No celular o quadro rola de lado e o card abre ao tocar (arrastar é testado no computador).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const configured = Boolean(url && secret && adminEmail && adminPassword);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_ADMIN_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Clínica Trello ${stamp}`;
const boardName = `Natal ${stamp.slice(-5)}`;
const taskTitle = `Carrossel de Natal ${stamp.slice(-5)}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";

async function login(page: Page, email: string, password = pw) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.trl.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

/** Arrasta de verdade: segura, anda em passos (o quadro só começa depois de 6px) e solta na coluna. */
async function drag(page: Page, card: Locator, column: Locator) {
  await card.scrollIntoViewIfNeeded();
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 4, { steps: 4 });
  // Ponto dentro da tela (o quadro pode ser mais largo que ela).
  const vw = page.viewportSize()!.width;
  await page.mouse.move(Math.min(to.x + to.width / 2, vw - 12), to.y + Math.min(to.height / 2, 90), { steps: 14 });
  await page.waitForTimeout(200);
  await page.mouse.up();
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Sm", "social_media");
  await makeUser("Lu", "leitura");
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "gerenciamento").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Sm.id });
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    await admin.from("tasks").delete().eq("client_id", clientId);
    await admin.from("boards").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. quadro do cliente nasce com colunas, que se editam; o card se arrasta", async ({ page, isMobile }) => {
  await login(page, people.Sm.email);
  await page.goto(`/clientes/${clientId}/quadros`);
  await page.getByRole("button", { name: "Novo quadro" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo quadro" });
  await dialog.getByRole("button", { name: "Criar quadro" }).click();
  await expect(dialog.getByText("Dê um nome ao quadro (2 letras ou mais).")).toBeVisible();
  await dialog.getByLabel("Nome").fill(isMobile ? `${boardName} m` : boardName);
  await dialog.getByRole("button", { name: "Criar quadro" }).click();
  await page.waitForURL(/quadro=/);
  const name = isMobile ? `${boardName} m` : boardName;
  await expect(page.getByRole("navigation", { name: "Quadros do cliente" }).getByRole("link", { name })).toHaveAttribute("aria-current", "page");
  for (const col of ["Ideias e pedidos", "A fazer", "Em produção", "Revisão interna", "Aprovação do cliente", "Concluído"]) {
    await expect(page.getByRole("region", { name: col, exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "Colunas" }).click();
  const cols = page.getByRole("dialog", { name: "Colunas do quadro" });
  await cols.getByLabel("Nome da coluna 1").fill("Pautas");
  await cols.getByLabel("Nome da coluna 1").press("Tab");
  await expect(page.getByText("Coluna salva.")).toBeVisible();
  await cols.getByRole("button", { name: "Levar Revisão interna para a esquerda" }).click();
  await expect(cols.getByLabel("Nome da coluna 3")).toHaveValue("Revisão interna");
  await cols.getByLabel("Nova coluna").fill("Publicado");
  await cols.getByRole("button", { name: "Adicionar" }).click();
  await expect(cols.getByLabel("Nome da coluna 7")).toHaveValue("Publicado");
  await page.keyboard.press("Escape");
  const { data: board } = await admin.from("boards").select("id, board_columns(name, position)").eq("client_id", clientId).eq("name", name).single();
  expect((board!.board_columns as { name: string; position: number }[]).sort((a, b) => a.position - b.position).map((c) => c.name))
    .toEqual(["Pautas", "A fazer", "Revisão interna", "Em produção", "Aprovação do cliente", "Concluído", "Publicado"]);

  await page.getByRole("button", { name: "Nova demanda" }).click();
  const nd = page.getByRole("dialog", { name: "Nova demanda" });
  await nd.getByLabel("Título").fill(isMobile ? `${taskTitle} m` : taskTitle);
  await nd.getByRole("button", { name: "Criar demanda" }).click();
  // Criar abre a demanda; o atalho do cliente volta para o quadro dela.
  await page.waitForURL(/\/tarefas\/[0-9a-f-]{36}/);
  await page.getByRole("navigation", { name: "breadcrumb" }).getByRole("link", { name: clientName }).click();
  await page.waitForURL(/quadro=/);
  const card = page.getByRole("region", { name: "Pautas", exact: true }).getByText(isMobile ? `${taskTitle} m` : taskTitle);
  await expect(card).toBeVisible();
  if (!isMobile) {
    await drag(page, card, page.getByRole("region", { name: "A fazer", exact: true }));
    await expect(page.getByText("Movido para A fazer.")).toBeVisible();
    await expect(page.getByRole("region", { name: "A fazer", exact: true }).getByText(taskTitle)).toBeVisible();
    await expect.poll(async () => (await admin.from("tasks").select("status, board_columns(name)").eq("title", taskTitle).single()).data).toMatchObject({ status: "em_andamento", board_columns: { name: "A fazer" } });
    // Só aparece no quadro dele, não no quadro "Geral" por tipo de demanda.
    await page.goto(`/clientes/${clientId}/quadros?tipo=geral`);
    await expect(page.getByText(taskTitle)).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("2. Minhas tarefas em quadro: arrastar para Concluídas leva à coluna de concluído", async ({ page, isMobile }) => {
  test.skip(isMobile, "Arrastar é testado no computador; no celular o card abre ao tocar.");
  await login(page, people.Sm.email);
  await page.goto("/tarefas");
  await page.getByRole("group", { name: "Ver como" }).getByRole("link", { name: "Quadro" }).click();
  await page.waitForURL(/ver=quadro/);
  // A social media distribui demandas: escolhe de quem ver; abre nas dela.
  await expect(page.getByRole("combobox", { name: "Tarefas de quem" })).toHaveText("Minhas tarefas");
  const card = page.getByRole("region", { name: "Fazendo", exact: true }).getByText(taskTitle);
  await expect(card).toBeVisible();
  await drag(page, card, page.getByRole("region", { name: "Concluídas", exact: true }));
  await expect(page.getByText("Movida para Concluídas.")).toBeVisible();
  await expect.poll(async () => (await admin.from("tasks").select("status, board_columns(name)").eq("title", taskTitle).single()).data)
    .toMatchObject({ status: "concluido", board_columns: { name: "Concluído" } });
  await expect(page.getByRole("region", { name: "Concluídas", exact: true }).getByText(taskTitle)).toBeVisible();
});

test("3. administrador vê o quadro de todas as pessoas e de uma pessoa; leitura não escolhe", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/tarefas?ver=quadro");
  await page.getByRole("combobox", { name: "Tarefas de quem" }).click();
  await page.getByRole("option", { name: `Sm ${stamp}` }).click();
  await page.waitForURL(new RegExp(`pessoa=${people.Sm.id}`));
  await expect(page.getByText(`Tarefas de Sm ${stamp}, com prazo e cliente.`)).toBeVisible();
  await expect(page.getByRole("region", { name: "Concluídas", exact: true }).getByText(taskTitle).or(page.getByRole("region", { name: "A fazer", exact: true }).getByText(`${taskTitle} m`)).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Tarefas de quem" }).click();
  await page.getByRole("option", { name: "Todas as pessoas" }).click();
  await page.waitForURL(/pessoa=todos/);
  await expect(page.getByText("Tarefas de todas as pessoas, com prazo e cliente.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await login(page, people.Lu.email);
  await page.goto(`/tarefas?ver=quadro&pessoa=${people.Sm.id}`);
  await expect(page.getByText("Tudo o que está na sua mão, com prazo e cliente.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Tarefas de quem" })).toHaveCount(0);
});
