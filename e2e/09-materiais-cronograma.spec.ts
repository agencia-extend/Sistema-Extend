import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Central do cliente (parte B): Materiais, Documentos por pasta, Gravações e Cronograma com grid. */
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
const clientName = `Estúdio Parte B ${stamp}`;
let clientId = "";
let editor = { id: "", email: "", name: "" };
const tasks: string[] = [];
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.getByLabel(/^Senha/).fill(adminPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: r } = await admin.from("roles").select("id").eq("key", "editor_video").single();
  const email = `editora.b.${stamp}@extend.test`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `Editora B ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  editor = { id: u.user.id, email, name: `Editora B ${stamp}` };
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo", contract_start: "2026-01-10" }).select("id").single();
  clientId = c!.id;
  const { data: svcs } = await admin.from("service_catalog").select("id, key").in("key", ["gerenciamento", "pacote_videos"]);
  for (const s of svcs!) await admin.from("client_services").insert({ client_id: clientId, service_id: s.id, monthly_qty: 0, starts_on: "2026-01-10" });
  for (const title of ["Depoimento da paciente", "Bastidores do consultório"]) {
    const { data: t } = await admin.from("tasks").insert({ organization_id: org!.id, client_id: clientId, type: "video", title }).select("id").single();
    tasks.push(t!.id);
    await admin.from("task_content").upsert({ task_id: t!.id, editor_id: editor.id, format: "reels" });
  }
});

test("1. materiais: link do Drive e arquivo, por categoria", async ({ page }) => {
  await login(page);
  await page.goto(`/clientes/${clientId}/materiais`);
  await page.getByRole("button", { name: "Adicionar material" }).click();
  const d = page.getByRole("dialog", { name: "Adicionar material" });
  await d.getByRole("button", { name: "Adicionar material" }).click();
  await expect(d.getByText("Escolha a categoria.")).toBeVisible();
  await d.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Banco de imagens" }).click();
  await d.getByLabel("Nome").fill("Fotos do consultório");
  await d.getByLabel("Link do Drive").fill("https://drive.google.com/drive/folders/fotos");
  await d.getByRole("button", { name: "Adicionar material" }).click();
  await expect(page.getByText("Material adicionado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Banco de imagens" })).toBeVisible();

  await page.getByRole("button", { name: "Adicionar material" }).click();
  const d2 = page.getByRole("dialog", { name: "Adicionar material" });
  await d2.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Identidade visual" }).click();
  await d2.getByLabel("Nome").fill("Manual de marca");
  await d2.locator('input[type="file"]').setInputFiles({ name: "manual.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%x\n") });
  await d2.getByRole("button", { name: "Adicionar material" }).click();
  await expect(page.getByRole("heading", { name: "Identidade visual" })).toBeVisible();
  await expect(page.getByRole("button", { name: "manual.pdf", exact: true })).toBeVisible();

  // O arquivo do material fica em Documentos → Mídias e pode mudar de pasta.
  await page.goto(`/clientes/${clientId}/arquivos?pasta=midias`);
  await expect(page.getByRole("button", { name: "manual.pdf", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Pasta de manual.pdf" }).click();
  await page.getByRole("option", { name: "Tráfego" }).click();
  await expect(page.getByText("Documento movido.")).toBeVisible();
  await page.goto(`/clientes/${clientId}/arquivos?pasta=trafego`);
  await expect(page.getByRole("button", { name: "manual.pdf", exact: true })).toBeVisible();
});

test("2. gravação: registra a diária, preenche os conteúdos e avisa quem edita", async ({ page }) => {
  await login(page);
  await page.goto(`/clientes/${clientId}/gravacoes`);
  await page.getByRole("button", { name: "Registrar gravação" }).click();
  const d = page.getByRole("dialog", { name: "Registrar gravação" });
  await d.getByLabel("Local").fill("Consultório");
  await d.getByLabel("Link dos takes brutos").fill("https://drive.google.com/brutos-e2e");
  await d.getByRole("checkbox", { name: "Depoimento da paciente" }).click();
  await d.getByRole("button", { name: "Salvar gravação" }).click();
  await expect(page.getByText(/Gravação registrada com 1 conteúdo/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Gravações" })).toContainText("Consultório");
  await expect(page.getByRole("link", { name: "Takes brutos" })).toBeVisible();
  const { data: c } = await admin.from("task_content").select("raw_url, recording_on").eq("task_id", tasks[0]).single();
  expect(c!.raw_url).toBe("https://drive.google.com/brutos-e2e");
  await expect
    .poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", editor.id).like("title", "Brutos da gravação%")).count)
    .toBe(1);
});

test("3. cronograma: programa o post com capa e vê no grid", async ({ page }) => {
  await login(page);
  const month = new Date().toISOString().slice(0, 7);
  await page.goto(`/clientes/${clientId}/cronograma?mes=${month}`);
  await expect(page.getByText("Nenhum post neste mês")).toBeVisible();
  // Marca o conteúdo para o cronograma (como no Controle de Mídias) e programa.
  await admin.from("task_content").update({ destination: ["cronograma"] }).eq("task_id", tasks[1]);
  await page.reload();
  await page.getByRole("button", { name: "Programar Bastidores do consultório" }).click();
  const d = page.getByRole("dialog", { name: "Programar post" });
  await d.getByLabel("Data do post").fill(`${month}-15`);
  await d.getByLabel("Legenda").fill("Um dia no consultório ✨");
  await d.locator('input[type="file"]').setInputFiles({ name: "capa.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Capa atualizada.")).toBeVisible();
  await d.getByRole("button", { name: "Salvar post" }).click();
  await expect(page.getByText("Post programado.")).toBeVisible();
  await expect(page.getByText("Programado", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Grid do Instagram" }).click();
  const grid = page.getByRole("list", { name: "Grid do Instagram" });
  await expect(grid.getByRole("img", { name: "Capa de Bastidores do consultório" })).toBeVisible();
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    const { data: files } = await admin.storage.from("anexos").list(`clientes/${clientId}`);
    const { data: covers } = await admin.storage.from("anexos").list(`clientes/${clientId}/capas`);
    const paths = [...(files ?? []).filter((f) => f.id).map((f) => `clientes/${clientId}/${f.name}`), ...(covers ?? []).map((f) => `clientes/${clientId}/capas/${f.name}`)];
    if (paths.length) await admin.storage.from("anexos").remove(paths);
    await admin.from("clients").delete().eq("id", clientId);
  }
  if (editor.id) await admin.auth.admin.deleteUser(editor.id);
});
