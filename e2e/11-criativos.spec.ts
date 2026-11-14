import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Etapa 04 — roteiro do prompt: pedido, versões, ajustes, link do cliente, biblioteca, link usado, visibilidade e exportação. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret && process.env.E2E_ADMIN_EMAIL);
// O link usa o endereço configurado do sistema; no teste, abre o mesmo caminho no servidor testado.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const people: Record<string, { id: string; email: string; name: string }> = {};
const clientName = `Teste Imobiliária ${stamp}`;
const angle = `dor do aluguel ${stamp}`;
let clientId = "";
let creativeId = "";
const links: string[] = [];
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.cri.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

const stepOf = async () => {
  const { data } = await admin.from("tasks").select("workflow_steps(name)").eq("id", creativeId).single();
  return (data!.workflow_steps as unknown as { name: string }).name;
};
const notes = async (who: string, kind: string) => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people[who].id).eq("kind", kind)).count ?? 0;

/** O cliente abre o link no celular, sem login. */
async function clientDecides(browser: Browser, link: string, decision: "aprovado" | "ajustes", comment = "") {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  await p.goto(new URL(link).pathname);
  await expect(p.getByRole("heading", { level: 1, name: angle })).toBeVisible();
  await p.getByLabel("Seu nome").fill("Dona Ana");
  if (decision === "ajustes") {
    await p.getByRole("button", { name: "Pedir alteração" }).click();
    await p.getByRole("button", { name: "Enviar pedido de alteração" }).click();
    await expect(p.getByText("Descreva o que precisa mudar.")).toBeVisible();
    await p.getByLabel("O que precisa mudar").fill(comment);
    await p.getByRole("button", { name: "Enviar pedido de alteração" }).click();
    await expect(p.getByText(/pedido de alteração foi enviado/)).toBeVisible();
  } else {
    await p.getByRole("button", { name: "Aprovar" }).click();
    await expect(p.getByText("Obrigado! Aprovação registrada.")).toBeVisible();
  }
  await ctx.close();
}

async function sendVersion(page: Page, kind: "arquivo" | "link") {
  page.on("console", (m) => { if (m.type() === "error") console.log("BROWSER:", m.text()); });
  await login(page, people.Priscila.email);
  await page.goto(`/criativos/${creativeId}`);
  await expect(page.getByRole("button", { name: "Escolher arquivos" })).toBeEnabled();
  if (kind === "arquivo") await page.locator('input[type="file"][aria-label="Arquivos da versão"]').setInputFiles({ name: "criativo.png", mimeType: "image/png", buffer: PNG });
  else await page.getByRole("textbox", { name: "Link 1 da versão" }).fill("https://drive.google.com/file/d/abc123/view");
  await page.getByRole("button", { name: /^Enviar v\d$/ }).click();
  await expect(page.getByText(/Versão v\d enviada/)).toBeVisible();
}

async function approveToClient(page: Page) {
  await login(page, people.Luiz.email);
  await page.goto(`/criativos/${creativeId}`);
  await page.getByRole("button", { name: "Aprovar e enviar ao cliente" }).click();
  await page.getByRole("button", { name: "Gerar link para o cliente" }).click();
  const box = page.getByRole("textbox", { name: "Link para o cliente aprovar" });
  await expect(box).toBeVisible();
  links.push(await box.inputValue());
  await expect(page.getByRole("link", { name: "Enviar no WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Luiz", "gestor_trafego");
  await makeUser("Priscila", "editor_video");
  await makeUser("OutroEditor", "editor_video");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo", contract_start: "2026-01-10" }).select("id").single();
  clientId = c!.id;
  const { data: secs } = await admin.from("sectors").select("id, key").in("key", ["trafego", "edicao"]);
  const sec = (k: string) => secs!.find((s) => s.key === k)!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sec("trafego"), profile_id: people.Luiz.id, is_default: true },
    { client_id: clientId, sector_id: sec("edicao"), profile_id: people.Priscila.id, is_default: true },
  ]);
});

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "O roteiro abre o celular do cliente dentro dele."));

test("1-2. pedido incompleto é bloqueado; completo vai para a mídia em Solicitado", async ({ page }) => {
  await login(page, people.Luiz.email);
  await page.goto(`/criativos/novo?cliente=${clientId}`);
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByText("Preencha os campos obrigatórios para enviar.")).toBeVisible();
  await expect(page.getByText("Informe o ângulo ou a mensagem.")).toBeVisible();
  await expect(page.getByText("Informe o prazo.")).toBeVisible();

  await page.getByLabel("Campanha").fill("Lançamento de novembro");
  await page.getByRole("combobox", { name: "Objetivo" }).click();
  await page.getByRole("option", { name: "Mensagens (WhatsApp/Direct)" }).click();
  await page.getByRole("combobox", { name: "Formato" }).click();
  await page.getByRole("option", { name: "Vídeo" }).click();
  await page.getByLabel("Ângulo / mensagem").fill(angle);
  await page.getByLabel("Público").fill("Inquilinos de 25 a 40 anos");
  await page.getByLabel("CTA (chamada)").fill("Chamar no WhatsApp");
  await page.getByLabel("Copy sugerida").fill("Cansou de pagar aluguel?");
  await page.getByLabel("Prazo").fill("2099-12-31");
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await page.waitForURL(/\/criativos\/[0-9a-f-]{36}$/);
  creativeId = new URL(page.url()).pathname.split("/").pop()!;
  expect(await stepOf()).toBe("Solicitado");
  await expect.poll(() => notes("Priscila", "assigned")).toBeGreaterThanOrEqual(1);
  await page.goto("/criativos");
  await expect(page.getByRole("region", { name: "Solicitado", exact: true })).toContainText(angle);
});

test("3-4. mídia envia v1 → Luiz recebe “pronto”; pede ajuste → mídia manda v2", async ({ page }) => {
  await sendVersion(page, "arquivo");
  expect(await stepOf()).toBe("Em revisão");
  await expect.poll(() => notes("Luiz", "creative_ready")).toBe(1);

  await login(page, people.Luiz.email);
  await page.goto(`/criativos/${creativeId}`);
  await page.getByRole("button", { name: "Pedir ajuste" }).click();
  await page.getByLabel("O que precisa mudar").fill("Trocar a trilha e encurtar o começo");
  await page.getByRole("button", { name: "Enviar ajuste" }).click();
  await expect(page.getByText("Ajustes pedidos. A mídia foi avisada.")).toBeVisible();
  expect(await stepOf()).toBe("Ajustes solicitados");
  await expect.poll(() => notes("Priscila", "stage_changed")).toBeGreaterThanOrEqual(1);
  await sendVersion(page, "link");
});

test("5. link do cliente no celular: pede alteração; v3; novo link → aprova", async ({ page, browser }) => {
  await approveToClient(page);
  await clientDecides(browser, links[0], "ajustes", "A cor do texto está apagada");
  expect(await stepOf()).toBe("Ajustes solicitados");
  await expect.poll(() => notes("Priscila", "client_approval")).toBe(1);
  await sendVersion(page, "arquivo");
  await approveToClient(page);
  await clientDecides(browser, links[1], "aprovado");
});

test("6. aprovado entra na biblioteca com a copy; entregue → no ar", async ({ page }) => {
  expect(await stepOf()).toBe("Aprovado");
  await login(page, people.Luiz.email);
  await page.goto("/criativos/biblioteca");
  const card = page.getByRole("list", { name: "Biblioteca de criativos" }).getByRole("listitem").filter({ hasText: angle });
  await expect(card).toContainText("Cansou de pagar aluguel?");
  await page.goto(`/criativos/${creativeId}`);
  await page.getByRole("button", { name: "Marcar como entregue" }).click();
  await expect(page.getByText("Marcado como entregue.")).toBeVisible();
  await page.getByRole("button", { name: "Marcar como no ar" }).click();
  await expect(page.getByText("Marcado como no ar.")).toBeVisible();
  expect(await stepOf()).toBe("No ar");
});

test("7. link já decidido não aceita nova decisão", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  const p = await ctx.newPage();
  await p.goto(new URL(links[1]).pathname);
  await expect(p.getByRole("status")).toContainText("Aprovado por Dona Ana");
  await expect(p.getByRole("button", { name: "Aprovar" })).toHaveCount(0);
  await p.goto(new URL(links[0]).pathname);
  await expect(p.getByRole("status")).toContainText("Alteração pedida por Dona Ana");
  await ctx.close();
});

test("8. editor de outro cliente não vê o criativo (tela e consulta direta)", async ({ page }) => {
  await login(page, people.OutroEditor.email);
  // Com a tela de carregamento a resposta já começou (200); o que vale é não mostrar nada do criativo.
  await page.goto(`/criativos/${creativeId}`);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(page.getByText(angle)).toHaveCount(0);
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await anon.auth.signInWithPassword({ email: people.OutroEditor.email, password: pw });
  const { data } = await anon.from("creative_requests").select("task_id").eq("task_id", creativeId);
  expect(data).toEqual([]);
});

test("9. exporta a biblioteca do mês em CSV e PDF", async ({ page }) => {
  await login(page, people.Luiz.email);
  const month = new Date().toISOString().slice(0, 7);
  const csv = await page.request.get(`/criativos/biblioteca/exportar?formato=csv&mes=${month}`);
  expect(csv.ok()).toBeTruthy();
  expect(await csv.text()).toContain(angle);
  const pdf = await page.request.get(`/criativos/biblioteca/exportar?formato=pdf&mes=${month}`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test.afterAll(async () => {
  if (!configured) return;
  if (creativeId) {
    const { data: files } = await admin.storage.from("anexos").list(`tarefas/${creativeId}/entregas`);
    if (files?.length) await admin.storage.from("anexos").remove(files.map((f) => `tarefas/${creativeId}/entregas/${f.name}`));
  }
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
