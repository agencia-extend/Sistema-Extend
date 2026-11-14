import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Roteiro da etapa 09 (prompts/09-PROPOSTAS.md), itens 1 a 6.
 * O envio usa o WhatsApp de quem envia (wa.me) até o número da Extend estar ligado (etapa 07).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret && process.env.E2E_ADMIN_EMAIL);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const people: Record<string, { id: string; email: string; name: string }> = {};
const tag = `E2E${stamp}`;
const r4 = String(1000 + Math.floor(Math.random() * 9000));
let templateCopy = "";
let leadId = "";
let proposalId = "";
let token = "";

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.prop.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

async function pdfText(buf: Buffer): Promise<string> {
  const pdf = await getDocument({ data: new Uint8Array(buf) }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    text += c.items.map((x) => ("str" in x ? x.str : "")).join(" ") + " ";
  }
  return text.replace(/ /g, " ").replace(/\s+/g, " ");
}

const validUntil = () => {
  const d = new Date(Date.now() - 3 * 3600_000 + 12 * 86_400_000);
  return { iso: d.toISOString().slice(0, 10), br: d.toISOString().slice(0, 10).split("-").reverse().join("/") };
};

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Carla", "comercial");
  await makeUser("Ana", "atendimento");
  await makeUser("Beto", "comercial");
  await admin.from("user_permission_overrides").insert({ user_id: people.Beto.id, permission_key: "proposals.templates.manage", effect: "deny" });
  const { data: o } = await admin.from("organizations").select("id").limit(1).single();
  const { data: p } = await admin.from("pipelines").select("id, pipeline_stages(id, position)").eq("is_default", true).single();
  const first = [...p!.pipeline_stages].sort((a, b) => a.position - b.position)[0].id;
  const { data: lead } = await admin
    .from("leads")
    .insert({ organization_id: o!.id, pipeline_id: p!.id, stage_id: first, name: `${tag} Marcos`, company: `${tag} Clínica Ação`, phone: `55519${r4}7777`, owner_id: people.Carla.id, created_by: people.Carla.id })
    .select("id")
    .single();
  leadId = lead!.id;
});

test("1. editar o modelo (texto e ordem dos blocos) gera nova versão", async ({ page }) => {
  await login(page, people.Carla.email);
  await page.goto("/configuracoes/propostas");
  // Trabalha numa cópia do modelo padrão para não mexer no modelo real da Extend.
  await page.getByRole("link", { name: "Editar Proposta padrão", exact: true }).click();
  await page.waitForURL(/\/configuracoes\/propostas\/[0-9a-f-]{36}$/);
  const original = page.url().split("/").pop()!;
  await page.getByRole("button", { name: "Duplicar" }).click();
  await page.waitForURL((u) => /\/configuracoes\/propostas\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(original));
  templateCopy = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1 })).toContainText("(cópia");
  await expect(page.getByText(/^Versão 1\b/).first()).toBeVisible();

  await page.getByLabel("Título do bloco Sobre a Extend").fill(`Quem somos ${tag}`);
  await page.getByRole("button", { name: "Subir o bloco Condições" }).click();
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await expect(page.getByText("Modelo salvo (versão 2).")).toBeVisible();

  const { data: t } = await admin.from("proposal_templates").select("version, blocks").eq("id", templateCopy).single();
  const blocks = t!.blocks as { type: string; title: string }[];
  expect(t!.version).toBe(2);
  expect(blocks.find((b) => b.type === "sobre")?.title).toBe(`Quem somos ${tag}`);
  expect(blocks.findIndex((b) => b.type === "condicoes")).toBeLessThan(blocks.findIndex((b) => b.type === "investimento"));
  const { count } = await admin.from("proposal_template_versions").select("version", { count: "exact", head: true }).eq("template_id", templateCopy);
  expect(count).toBe(2);
});

test("2. proposta para o lead com 2 serviços e desconto: prévia e PDF batem", async ({ page }) => {
  const v = validUntil();
  await login(page, people.Carla.email);
  await page.goto(`/comercial/leads/${leadId}`);
  await page.getByRole("link", { name: "Criar proposta" }).click();
  await page.waitForURL(/\/comercial\/propostas\/nova\?lead=/);
  await expect(page.getByLabel(/^Nome do cliente/)).toHaveValue(`${tag} Clínica Ação`);

  await page.getByRole("combobox", { name: "Adicionar serviço do catálogo" }).click();
  await page.getByRole("option", { name: /^Facebook\/Instagram Ads/ }).click();
  await page.getByRole("combobox", { name: "Adicionar serviço do catálogo" }).click();
  await page.getByRole("option", { name: /^Site/ }).click();
  await page.getByLabel("Valor (R$)").nth(0).fill("2.000,00");
  await page.getByLabel("Desconto (R$)").nth(0).fill("200,00");
  await page.getByLabel("Valor (R$)").nth(1).fill("1.500,00");
  await page.getByLabel(/^Forma de pagamento/).fill("Pix mensal");
  await page.getByLabel(/^Válida até/).fill(v.iso);

  if (test.info().project.name !== "desktop") await page.getByRole("button", { name: "Prévia" }).click();
  const preview = page.getByRole("region", { name: "Prévia da proposta" });
  await expect(preview).toContainText(`${tag} Clínica Ação`);
  await expect(preview).toContainText("R$ 1.800,00");
  await expect(preview).toContainText(v.br);
  if (test.info().project.name !== "desktop") await page.getByRole("button", { name: "Editar" }).click();

  await page.getByRole("button", { name: "Criar proposta" }).click();
  await page.waitForURL(/\/comercial\/propostas\/[0-9a-f-]{36}$/);
  proposalId = page.url().split("/").pop()!;

  const res = await page.request.get(`/api/propostas/${proposalId}/pdf`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  const text = await pdfText(await res.body());
  for (const s of [`${tag} Clínica Ação`, "R$ 1.800,00", "R$ 1.500,00", "− R$ 200,00", v.br, "Pix mensal"]) expect(text).toContain(s);
  const { data: p } = await admin.from("proposals").select("monthly_cents, one_time_cents, status").eq("id", proposalId).single();
  expect(p).toEqual({ monthly_cents: 180000, one_time_cents: 150000, status: "rascunho" });
});

test("3. enviar pelo WhatsApp → abrir o link no celular marca visualizada e avisa o vendedor", async ({ page, browser }) => {
  await login(page, people.Carla.email);
  await page.goto(`/comercial/propostas/${proposalId}`);
  await page.getByRole("button", { name: "Enviar proposta" }).click();
  await expect(page.getByText("Proposta enviada: o link mostra esta versão.")).toBeVisible();
  const link = await page.getByLabel("Link da proposta").inputValue();
  token = link.split("/proposta/")[1];
  expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  const wa = await page.getByRole("link", { name: "Abrir no WhatsApp" }).getAttribute("href");
  expect(wa).toContain(`https://wa.me/55519${r4}7777?text=`);
  expect(decodeURIComponent(wa!)).toContain(`/proposta/${token}`);

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const client = await phone.newPage();
  await client.goto(`/proposta/${token}`);
  await expect(client.getByRole("heading", { name: "Proposta comercial" })).toBeVisible();
  await expect(client.getByText(`${tag} Clínica Ação`).first()).toBeVisible();
  await expect.poll(async () => (await admin.from("proposals").select("status, view_count").eq("id", proposalId).single()).data).toEqual({ status: "visualizada", view_count: 1 });
  await expect.poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Carla.id).eq("kind", "proposal")).count).toBeGreaterThanOrEqual(1);
  await phone.close();
});

test("4. aceitar → lead em Ganho e fechamento pré-preenchido", async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const client = await ctx.newPage();
  await client.goto(`/proposta/${token}`);
  await client.getByRole("button", { name: "Aceitar proposta" }).click();
  await expect(client.getByText("Escreva seu nome completo.")).toBeVisible();
  await client.getByLabel(/^Seu nome completo/).fill("Marcos da Silva");
  await client.getByRole("checkbox", { name: /Li a proposta/ }).check();
  await client.getByRole("button", { name: "Aceitar proposta" }).click();
  await expect(client.getByText(/Proposta aceita\. Obrigado!/)).toBeVisible();
  await ctx.close();

  const { data: l } = await admin.from("leads").select("pipeline_stages(kind)").eq("id", leadId).single();
  expect((l!.pipeline_stages as unknown as { kind: string }).kind).toBe("ganho");
  await expect.poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Carla.id).like("title", "Proposta aceita%")).count).toBe(1);

  await login(page, people.Carla.email);
  await page.goto(`/comercial/propostas/${proposalId}`);
  await expect(page.getByText(/Aceita por Marcos da Silva/)).toBeVisible();
  await page.getByRole("link", { name: "Registrar fechamento" }).click();
  await page.waitForURL(/\/clientes\/novo\?lead=.+&proposta=/);
  await expect(page.getByLabel(/^Nome do cliente/)).toHaveValue(`${tag} Clínica Ação`);
  await expect(page.getByLabel(/^Mensalidade/)).toHaveValue("1.800,00");
  await expect(page.getByRole("checkbox", { name: "Facebook/Instagram Ads", exact: true })).toBeChecked();
  await expect(page.getByLabel("Valor de Facebook/Instagram Ads")).toHaveValue("1.800,00");
  await expect(page.getByText(/proposta nº \d{4} aceita/)).toBeVisible();
});

test("5. proposta vencida → expirada e o link mostra que expirou", async ({ page }) => {
  const { data: src } = await admin.from("proposals").select("*").eq("id", proposalId).single();
  const { data: ver } = await admin.from("proposal_versions").select("snapshot").eq("proposal_id", proposalId).eq("version", 1).single();
  const { data: max } = await admin.from("proposals").select("number").eq("organization_id", src!.organization_id).order("number", { ascending: false }).limit(1).single();
  const yesterday = new Date(Date.now() - 3 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
  const { data: p2 } = await admin
    .from("proposals")
    .insert({
      organization_id: src!.organization_id, number: max!.number + 1, lead_id: leadId, template_id: src!.template_id, client_name: `${tag} Vencida`,
      items: src!.items, valid_until: yesterday, monthly_cents: 180000, status: "enviada", version: 1, sent_version: 1, sent_at: new Date().toISOString(), owner_id: people.Carla.id, created_by: people.Carla.id,
    })
    .select("id, public_token")
    .single();
  await admin.from("proposal_versions").insert({ proposal_id: p2!.id, version: 1, snapshot: { ...(ver!.snapshot as object), validUntil: yesterday }, monthly_cents: 180000, one_time_cents: 0 });

  await page.context().clearCookies();
  await page.goto(`/proposta/${p2!.public_token}`);
  await expect(page.getByText(/Esta proposta expirou em/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Aceitar proposta" })).toHaveCount(0);
  await expect.poll(async () => (await admin.from("proposals").select("status").eq("id", p2!.id).single()).data?.status).toBe("expirada");

  await login(page, people.Carla.email);
  await page.goto("/comercial/propostas?status=expirada");
  await expect(page.getByRole("link", { name: `${tag} Vencida` })).toBeVisible();
});

test("6. sem proposals.templates.manage não edita modelos; sem proposals.read não vê propostas", async ({ page }) => {
  await login(page, people.Beto.email);
  await page.goto("/comercial/propostas");
  await expect(page.getByRole("navigation", { name: "Seções do comercial" }).getByRole("link", { name: "Propostas" })).toBeVisible();
  await page.goto(`/configuracoes/propostas/${templateCopy}`).catch(() => undefined);
  await expect(page).toHaveURL(/sem-acesso/);

  await login(page, people.Ana.email);
  await page.goto("/comercial/leads");
  await expect(page.getByRole("navigation", { name: "Seções do comercial" }).getByRole("link", { name: "Propostas" })).toHaveCount(0);
  await page.goto(`/comercial/propostas/${proposalId}`).catch(() => undefined);
  await expect(page).toHaveURL(/sem-acesso/);
});

test.afterAll(async () => {
  if (!configured) return;
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
  // Só apaga a cópia criada pelo teste (nunca o modelo padrão).
  if (templateCopy) await admin.from("proposal_templates").delete().eq("id", templateCopy).eq("is_default", false).like("name", "%(cópia%");
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
