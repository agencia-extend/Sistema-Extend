import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Treinamentos: coordenação monta e atribui; a pessoa faz; o admin tira o acesso. */
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
const title = `Cronograma do mês ${stamp}`;
const people: Record<string, { id: string; email: string; name: string }> = {};
let trainingId = "";

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Joana", "coord_conteudo");
  await makeUser("Madu", "social_media");
});

test("1. coordenação cria o treinamento, monta duas aulas com vídeo e PDF, publica e atribui à Madu", async ({ page }) => {
  await login(page, people.Joana.email, pw);
  await page.goto("/treinamentos");
  await page.getByRole("button", { name: "Novo treinamento" }).click();
  await page.getByLabel("Nome").fill(title);
  await page.getByLabel("Para que serve").fill("Do planejamento aprovado ao cronograma da semana.");
  await page.getByRole("button", { name: "Criar treinamento" }).click();
  await page.waitForURL(/\/treinamentos\/[0-9a-f-]{36}/);
  trainingId = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByText("Rascunho").first()).toBeVisible();

  await page.getByRole("button", { name: "Nova aula" }).click();
  await page.getByLabel("Nome da aula").fill("Onde está o planejamento");
  await page.getByLabel("Link do vídeo").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await expect(page.getByText("Vídeo do YouTube: aparece dentro da aula.")).toBeVisible();
  await page.getByLabel("Duração (min)").fill("8");
  await page.getByLabel("Conteúdo").fill("Abra o cliente e vá em Controle de Mídias.\n\nModelo: https://docs.google.com/exemplo");
  await page.getByRole("button", { name: "Adicionar aula" }).click();
  await expect(page.getByRole("heading", { name: "Onde está o planejamento" })).toBeVisible();
  await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')).toHaveCount(1);
  await expect(page.getByRole("link", { name: "https://docs.google.com/exemplo" })).toBeVisible();

  await page.getByRole("button", { name: "Nova aula" }).click();
  await page.getByLabel("Nome da aula").fill("Montando a semana");
  await page.getByLabel("Conteúdo").fill("Um post por dia útil, com a legenda prevista.");
  await page.getByRole("button", { name: "Adicionar aula" }).click();
  await expect(page.getByRole("heading", { name: "Montando a semana" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "modelo-cronograma.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%teste\n") });
  await expect(page.getByText("Arquivo anexado à aula.")).toBeVisible();
  await expect(page.getByRole("button", { name: "modelo-cronograma.pdf" })).toBeVisible();

  // Reordena: a segunda vira a primeira e volta.
  await page.getByRole("button", { name: "Subir a aula Montando a semana" }).click();
  await expect(page.getByRole("list", { name: "Aulas" }).getByRole("listitem").first()).toContainText("Montando a semana");
  await page.getByRole("button", { name: "Descer a aula Montando a semana" }).click();
  await expect(page.getByRole("list", { name: "Aulas" }).getByRole("listitem").first()).toContainText("Onde está o planejamento");

  // Atribui ainda em rascunho: ninguém é avisado até publicar.
  await page.getByRole("link", { name: /^Equipe/ }).click();
  await page.getByRole("button", { name: "Atribuir a pessoas" }).click();
  await page.getByRole("searchbox", { name: "Buscar pessoa" }).fill(people.Madu.name);
  await page.getByRole("dialog").getByText(people.Madu.name).click();
  await page.getByLabel("Concluir até").fill("2099-12-31");
  await page.getByRole("button", { name: "Atribuir (1)" }).click();
  await expect(page.getByText(/serão avisadas quando você publicar/)).toBeVisible();
  const before = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Madu.id).eq("kind", "training");
  expect(before.count).toBe(0);

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Publicado").click();
  await page.getByRole("button", { name: "Salvar treinamento" }).click();
  await expect(page.getByText("Treinamento salvo.")).toBeVisible();
  await expect(page.getByRole("cell", { name: people.Madu.name, exact: true })).toBeVisible();
  await expect.poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Madu.id).eq("kind", "training")).count).toBe(1);
});

test("2. a Madu recebe, assiste, baixa o PDF e conclui → a Joana é avisada", async ({ page }) => {
  await login(page, people.Madu.email, pw);
  await page.goto("/treinamentos");
  await page.getByRole("region", { name: "Pedidos para você" }).getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByText("0 de 2 aulas concluídas · concluir até 31/12/2099.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nova aula" })).toHaveCount(0);
  await page.getByRole("button", { name: "Concluir e ir para a próxima" }).click();
  await expect(page.getByRole("heading", { name: "Montando a semana" })).toBeVisible();

  // O PDF abre numa aba nova pelo link assinado do Storage.
  const signed = page.context().waitForEvent("request", (r) => r.url().includes("/storage/v1/object/sign/treinamentos/"));
  await page.getByRole("button", { name: "modelo-cronograma.pdf" }).click();
  await signed;

  await page.getByRole("button", { name: "Concluir aula" }).click();
  await expect(page.getByText("Você concluiu este treinamento.")).toBeVisible();
  await expect.poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Joana.id).eq("kind", "training")).count).toBe(1);
});

test("3. a Joana vê a Madu como concluída na equipe", async ({ page }) => {
  await login(page, people.Joana.email, pw);
  await page.goto(`/treinamentos/${trainingId}?aba=equipe`);
  await expect(page.getByText("1 de 1 concluíram.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(people.Madu.name) })).toContainText("Concluído");
});

test("4. o admin bloqueia Treinamentos para a Madu → some do menu e a página fecha", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto(`/configuracoes/usuarios/${people.Madu.id}`);
  await page.getByRole("combobox", { name: "Exceção para Ver treinamentos" }).click();
  await page.getByRole("option", { name: "Bloquear" }).click();
  await expect(page.getByText("Permissão bloqueada.")).toBeVisible();

  await login(page, people.Madu.email, pw);
  await expect(page.getByRole("heading", { name: "Minhas pendências" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Treinamentos" })).toHaveCount(0);
  await page.goto("/treinamentos").catch(() => undefined); // o redirecionamento pode interromper o carregamento
  await expect(page).toHaveURL(/sem-acesso/);
  // E o banco também fecha (não é só o menu): com a sessão dela, a RLS não devolve nada.
  const asMadu = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await asMadu.auth.signInWithPassword({ email: people.Madu.email, password: pw });
  const { data } = await asMadu.from("trainings").select("id").eq("id", trainingId);
  expect(data).toEqual([]);
});

test.afterAll(async () => {
  if (!configured) return;
  if (trainingId) {
    const { data: files } = await admin.storage.from("treinamentos").list(trainingId);
    if (files?.length) await admin.storage.from("treinamentos").remove(files.map((f) => `${trainingId}/${f.name}`));
    await admin.from("trainings").delete().eq("id", trainingId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
