import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Roteiro da etapa 03 (prompts/03-PRODUCAO-TAREFAS.md). */
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
  await makeUser("Jacque", "coord_conteudo", "conteudo");
  await makeUser("Gravacao", "gravacao", "gravacao");
  await makeUser("Priscila", "editor_video", "edicao");
  await makeUser("Outro", "editor_video", "edicao");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c } = await admin.from("clients").insert({ organization_id: org!.id, name: `Teste Imobiliária ${stamp}`, status: "ativo" }).select("id").single();
  clientId = c!.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "pacote_videos").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 4 });
  const sec = async (k: string) => (await admin.from("sectors").select("id").eq("key", k).single()).data!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: await sec("conteudo"), profile_id: people.Jacque.id },
    { client_id: clientId, sector_id: await sec("gravacao"), profile_id: people.Gravacao.id },
    { client_id: clientId, sector_id: await sec("edicao"), profile_id: people.Priscila.id },
  ]);
  const { data: t } = await admin.from("tasks").insert({ organization_id: org!.id, client_id: clientId, type: "video", title: `Vídeo 1/4 ${stamp}` }).select("id, assignee_id").single();
  taskId = t!.id;
});

test("1. Jacque move o vídeo até Gravação → responsável muda e a pessoa da gravação é avisada", async ({ page }) => {
  await login(page, people.Jacque.email, pw);
  await page.goto(`/tarefas/${taskId}`);
  await page.getByLabel("Briefing ou descrição da demanda").fill("Roteiro: abertura com a fachada, depoimento do corretor.");
  await page.getByRole("button", { name: "Salvar descrição" }).click();
  await page.getByRole("button", { name: "Aprovação do roteiro" }).click();
  await expect(page.getByText("Movido para Aprovação do roteiro.")).toBeVisible();
  await page.getByRole("button", { name: "Gravação", exact: true }).click();
  await expect(page.getByText("Movido para Gravação.")).toBeVisible();
  const { data } = await admin.from("tasks").select("assignee_id").eq("id", taskId).single();
  expect(data!.assignee_id).toBe(people.Gravacao.id);
  const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Gravacao.id).eq("kind", "stage_changed");
  expect(count).toBeGreaterThan(0);
});

test("2. agendar a gravação → aparece na agenda do setor e do responsável", async ({ page }) => {
  await login(page, people.Jacque.email, pw);
  await page.goto(`/tarefas/${taskId}`);
  await page.getByRole("button", { name: "Agendar gravação" }).click();
  await page.getByLabel(/^Início/).fill(new Date(Date.now() + 2 * 86_400_000 - 3 * 3600_000).toISOString().slice(0, 11) + "10:00");
  await page.getByLabel(/^Fim/).fill(new Date(Date.now() + 2 * 86_400_000 - 3 * 3600_000).toISOString().slice(0, 11) + "12:00");
  await page.getByLabel(people.Gravacao.name).check();
  await page.getByRole("button", { name: "Salvar evento" }).click();
  await expect(page.getByText(/Evento criado/)).toBeVisible();
  await login(page, people.Gravacao.email, pw);
  await page.goto(`/agenda?visao=semana&data=${new Date(Date.now() + 2 * 86_400_000 - 3 * 3600_000).toISOString().slice(0, 10)}`);
  await expect(page.getByText(`Gravação: Vídeo 1/4 ${stamp}`).first()).toBeVisible();
});

test("3-4. Edição → Priscila recebe, cronometra e menciona a Jacque", async ({ page }) => {
  await login(page, people.Jacque.email, pw);
  await page.goto(`/tarefas/${taskId}`);
  await page.getByRole("button", { name: "Edição", exact: true }).click();
  await expect(page.getByText("Movido para Edição.")).toBeVisible();

  await login(page, people.Priscila.email, pw);
  await page.goto("/tarefas?aba=todas");
  await page.getByRole("link", { name: new RegExp(`Vídeo 1/4 ${stamp}`) }).click();
  await page.getByRole("button", { name: "Iniciar trabalho" }).click();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText("Tempo registrado.")).toBeVisible();
  await page.getByRole("button", { name: "Anexar link" }).click();
  await page.getByLabel("Nome do link").fill("Vídeo editado v1");
  await page.getByLabel("Endereço do link").fill("https://drive.google.com/file/d/exemplo/view");
  await page.getByRole("button", { name: "Anexar", exact: true }).click();
  await expect(page.getByText("Link anexado.")).toBeVisible();
  await page.getByLabel("Novo comentário").fill(`@Jacque revisar`);
  await page.getByRole("button", { name: "Comentar" }).click();
  await expect(page.getByText(/1 pessoa\(s\) mencionada/)).toBeVisible();
  const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Jacque.id).eq("kind", "comment");
  expect(count).toBeGreaterThan(0);
});

test("5-6. card vencido fica atrasado e aparece no setor de Edição; filtro por pessoa", async ({ page }) => {
  await admin.from("tasks").update({ due_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", taskId);
  await login(page, adminEmail, adminPassword);
  await page.goto(`/setores/edicao?situacao=atrasadas&pessoa=${people.Priscila.id}`);
  await expect(page.getByRole("link", { name: new RegExp(`Vídeo 1/4 ${stamp}`) })).toBeVisible();
  await expect(page.getByText(/Atrasada/).first()).toBeVisible();
});

test("7. dois usuários no mesmo quadro: mover em um atualiza o outro", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  await login(pa, adminEmail, adminPassword);
  await login(pb, people.Jacque.email, pw);
  await pa.goto(`/clientes/${clientId}/quadros?tipo=video`);
  await pb.goto(`/clientes/${clientId}/quadros?tipo=video`);
  await expect(pb.getByRole("region", { name: "Edição" }).getByText(`Vídeo 1/4 ${stamp}`)).toBeVisible();
  await pa.goto(`/tarefas/${taskId}`);
  await pa.getByRole("button", { name: "Revisão interna" }).click();
  await expect(pa.getByText("Movido para Revisão interna.")).toBeVisible();
  await expect(pb.getByRole("region", { name: "Revisão interna" }).getByText(`Vídeo 1/4 ${stamp}`)).toBeVisible({ timeout: 15_000 });
  await a.close();
  await b.close();
});

test("8. editor que não é do cliente não vê o card (tela e consulta direta)", async ({ page }) => {
  await login(page, people.Outro.email, pw);
  await page.goto(`/tarefas/${taskId}`);
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await anon.auth.signInWithPassword({ email: people.Outro.email, password: pw });
  const { data } = await anon.from("tasks").select("id").eq("id", taskId);
  expect(data ?? []).toHaveLength(0);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
