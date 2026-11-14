import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Roteiro da etapa 08 (prompts/08-COMERCIAL-FUNIL-PROSPECTADOR.md), itens 1, 2, 5 e 6.
 * Cadências (WhatsApp) e prospectador (Google Places) esperam as contas da Extend.
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
const phone = (i: number) => `(51) 9${r4}-${String(i).padStart(4, "0")}`;
const digits = (i: number) => `55519${r4}${String(i).padStart(4, "0")}`;
let org = "";
let pipeline = "";
let firstStage = "";
let clientId = "";

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.crm.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Carla", "comercial");
  await makeUser("Ana", "atendimento");
  await makeUser("Madu", "social_media");
  await makeUser("Jacque", "coord_conteudo"); // recebe o aviso de cliente novo em onboarding
  const { data: o } = await admin.from("organizations").select("id").limit(1).single();
  org = o!.id;
  const { data: p } = await admin.from("pipelines").select("id, pipeline_stages(id, position, kind)").eq("is_default", true).single();
  pipeline = p!.id;
  firstStage = [...p!.pipeline_stages].sort((a, b) => a.position - b.position)[0].id;
  // Dois contatos da planilha já estão no comercial: a importação precisa pular os dois.
  await admin.from("leads").insert([1, 2].map((i) => ({ organization_id: org, pipeline_id: pipeline, stage_id: firstStage, name: `${tag} já existe ${i}`, phone: digits(i) })));
});

test("1. importar 30 linhas (5 repetidas) → 25 entram; desfazer → somem", async ({ page }) => {
  const lines = ["Nome,WhatsApp,E-mail,Origem"];
  for (let i = 1; i <= 27; i++) lines.push(`${tag} Lead ${i},${phone(i)},lead${i}.${stamp}@exemplo.com.br,${i % 2 ? "Facebook Ads" : "Indicação"}`);
  for (const i of [5, 6, 7]) lines.push(`${tag} Repetido ${i},${phone(i)},,Site`); // repetidos dentro da planilha
  await login(page, people.Carla.email);
  await page.goto("/comercial/importar");
  const input = page.getByLabel("Planilha de leads");
  await expect(input).toBeEnabled();
  await input.setInputFiles({ name: `leads-${stamp}.csv`, mimeType: "text/csv", buffer: Buffer.from(lines.join("\n"), "utf8") });
  await expect(page.getByRole("heading", { name: "Prévia: 27 lead(s)" })).toBeVisible();
  await expect(page.getByText(/3 linha\(s\) ficam de fora/)).toBeVisible();
  await page.getByRole("button", { name: "Importar 27 lead(s)" }).click();
  await expect(page.getByText("25 lead(s) importado(s); 2 já existiam e foram pulados.")).toBeVisible();
  expect((await admin.from("leads").select("id", { count: "exact", head: true }).like("name", `${tag} Lead %`)).count).toBe(25);

  const row = page.getByRole("listitem").filter({ hasText: `leads-${stamp}.csv` });
  await row.getByRole("button", { name: "Desfazer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desfazer importação" }).click();
  await expect(row.getByText("Desfeita")).toBeVisible();
  expect((await admin.from("leads").select("id", { count: "exact", head: true }).like("name", `${tag} Lead %`)).count).toBe(0);
});

test("2. criar lead, não duplicar, agendar próxima ação, mover e perder só com motivo", async ({ page }) => {
  await login(page, people.Carla.email);
  await page.goto("/comercial");
  await page.getByRole("button", { name: "Novo lead" }).click();
  let d = page.getByRole("dialog", { name: "Novo lead" });
  await d.getByLabel(/^Nome do contato/).fill(`${tag} Padaria`);
  await d.getByLabel(/^WhatsApp/).fill(phone(50));
  await d.getByRole("button", { name: "Cadastrar lead" }).click();
  await page.waitForURL(/\/comercial\/leads\/[0-9a-f-]{36}$/);
  const leadUrl = new URL(page.url()).pathname;

  // Mesmo telefone em outro lead: o sistema aponta o que já existe.
  await page.goto("/comercial");
  await page.getByRole("button", { name: "Novo lead" }).click();
  d = page.getByRole("dialog", { name: "Novo lead" });
  await d.getByLabel(/^Nome do contato/).fill(`${tag} Outra padaria`);
  await d.getByLabel(/^WhatsApp/).fill(`51 9${r4} 0050`);
  await d.getByRole("button", { name: "Cadastrar lead" }).click();
  await expect(d.getByRole("alert").first()).toContainText(`Já existe o lead “${tag} Padaria”`);
  await page.keyboard.press("Escape");

  // O lead aparece no quadro, na primeira etapa.
  const card = page.getByRole("region", { name: "Lead de anúncio / início de conversa" }).getByRole("link", { name: `${tag} Padaria` });
  await expect(card).toBeVisible();

  // No computador, arrastar o card para a próxima coluna troca a etapa.
  if (test.info().project.name === "desktop") {
    const from = (await card.boundingBox())!;
    const to = (await page.getByRole("region", { name: "Qualificação" }).boundingBox())!;
    await page.mouse.move(from.x + 40, from.y + 30);
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y + 40, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByText("Movido para Qualificação.")).toBeVisible();
    await expect.poll(async () => (await admin.from("leads").select("pipeline_stages(name)").eq("name", `${tag} Padaria`).single()).data?.pipeline_stages).toEqual({ name: "Qualificação" });
  }

  await page.goto(leadUrl);
  await page.getByLabel(/^O que aconteceu ou o que fazer/).fill("Ligar para marcar a reunião");
  await page.getByLabel(/^Lembrar em/).fill("2026-12-01T10:00");
  await page.getByRole("button", { name: "Agendar próxima ação" }).click();
  await expect(page.getByRole("region", { name: "Próximas ações" })).toContainText("Ligar para marcar a reunião");

  await page.getByRole("combobox", { name: "Etapa do funil" }).click();
  await page.getByRole("option", { name: "Reunião marcada" }).click();
  await expect(page.getByRole("region", { name: "Histórico" })).toContainText("para “Reunião marcada”");

  await page.getByRole("combobox", { name: "Etapa do funil" }).click();
  await page.getByRole("option", { name: "Perdido" }).click();
  const lose = page.getByRole("dialog", { name: `Por que perdemos ${tag} Padaria?` });
  await lose.getByRole("button", { name: "Marcar como perdido" }).click();
  await expect(lose.getByText("Informe o motivo da perda.")).toBeVisible();
  await lose.getByRole("button", { name: "Parou de responder" }).click();
  await lose.getByRole("button", { name: "Marcar como perdido" }).click();
  await expect(lose).toBeHidden();
  await expect(page.getByText("Motivo: Parou de responder")).toBeVisible();
  const { data: l } = await admin.from("leads").select("lost_reason, lost_at").eq("name", `${tag} Padaria`).single();
  expect(l!.lost_reason).toBe("Parou de responder");
});

test("5. Ganho → fechamento pré-preenchido → cliente em onboarding ligado ao lead", async ({ page }) => {
  const { data: lead } = await admin
    .from("leads")
    .insert({ organization_id: org, pipeline_id: pipeline, stage_id: firstStage, name: `${tag} Marcos`, company: `${tag} Clínica Sorriso`, phone: digits(60), value_cents: 250000, owner_id: people.Carla.id, created_by: people.Carla.id })
    .select("id")
    .single();
  await login(page, people.Carla.email);
  await page.goto(`/comercial/leads/${lead!.id}`);
  await page.getByRole("combobox", { name: "Etapa do funil" }).click();
  await page.getByRole("option", { name: "Ganho" }).click();
  await page.waitForURL(new RegExp(`/clientes/novo\\?lead=${lead!.id}`));
  await expect(page.getByLabel(/^Nome do cliente/)).toHaveValue(`${tag} Clínica Sorriso`);
  await expect(page.getByLabel(/^WhatsApp/)).toHaveValue(`(51) 9${r4}-0060`);
  await expect(page.getByLabel(/^Mensalidade/)).toHaveValue("2.500,00");
  await page.getByLabel("Facebook/Instagram Ads").check();
  await page.getByRole("button", { name: "Registrar fechamento" }).click();
  await page.waitForURL(/\/clientes\/[0-9a-f-]{36}$/);
  clientId = page.url().split("/").pop()!;

  const { data: c } = await admin.from("clients").select("status").eq("id", clientId).single();
  expect(c!.status).toBe("onboarding");
  const { data: after } = await admin.from("leads").select("won_client_id, pipeline_stages(kind)").eq("id", lead!.id).single();
  expect(after!.won_client_id).toBe(clientId);
  expect((after!.pipeline_stages as unknown as { kind: string }).kind).toBe("ganho");
  // A equipe de onboarding é avisada (mesma regra do fechamento direto).
  await expect.poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("kind", "client_onboarding").eq("user_id", people.Jacque.id).like("title", `%${tag} Clínica Sorriso%`)).count).toBeGreaterThanOrEqual(1);

  await page.goto(`/comercial/leads/${lead!.id}`);
  await expect(page.getByRole("link", { name: "Ver o cliente em onboarding" })).toHaveAttribute("href", `/clientes/${clientId}`);
});

test("6. atendimento só vê os próprios leads; social media não vê o comercial", async ({ page }) => {
  await login(page, people.Ana.email);
  await page.goto(`/comercial/leads?q=${tag}`);
  await expect(page.getByText(`${tag} Marcos`)).toHaveCount(0);

  await login(page, people.Madu.email);
  await expect(page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Comercial" })).toHaveCount(0);
  await page.goto("/comercial").catch(() => undefined);
  await expect(page).toHaveURL(/sem-acesso/);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  await admin.from("leads").delete().like("name", `${tag}%`);
  await admin.from("lead_imports").delete().eq("file_name", `leads-${stamp}.csv`);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
