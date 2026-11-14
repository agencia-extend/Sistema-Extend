import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Onboarding do Miro: passos por marco, orientação, prazo em dias úteis, marco concluído e aviso ao trocar o responsável. */
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
const clientName = `E2E Onboarding ${stamp}`;
const people: Record<string, { id: string; email: string; name: string }> = {};
let clientId = "";

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.onb.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Comercial", "comercial");
  await makeUser("Joana", "coord_conteudo");
  // O comercial registra o fechamento (mesma função da tela "Registrar fechamento").
  const asSales = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await asSales.auth.signInWithPassword({ email: people.Comercial.email, password: pw });
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").limit(1).single();
  const { data, error } = await asSales.rpc("create_handoff", { p: { name: clientName, services: [{ service_id: svc!.id, monthly_qty: 0 }] } });
  if (error) throw error;
  clientId = data as string;
});

test("1. a ficha mostra os passos do Miro por marco, com orientação e prazo em dias úteis", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto(`/clientes/${clientId}/ficha`);
  const marcos = page.getByRole("list", { name: "Marcos do onboarding" });
  await expect(marcos.getByRole("heading", { name: "Abertura" })).toBeVisible();
  await expect(marcos.getByRole("heading", { name: "Briefing" })).toBeVisible();
  await expect(marcos.getByRole("heading", { name: "Combinados com o cliente" })).toBeVisible();
  await expect(page.getByText("Passos do onboarding (0/7)")).toBeVisible();
  await expect(page.getByText(/Agendar o mais rápido possível, pelo Google Agenda, em até 2 dias úteis/)).toBeVisible();
  await expect(page.getByText(/no mínimo 5 criativos por mês/)).toBeVisible();
  // A ficha ganhou a seção de obrigações do cliente.
  await expect(page.getByText("Porta-voz do projeto (quem decide e aprova)")).toBeVisible();
  // Briefing por seções: o cliente só tem Meta Ads → Geral e Tráfego aparecem; Vídeos, Design e Site não.
  await expect(page.getByText("A. Geral", { exact: true })).toBeVisible();
  await expect(page.getByText("B. Tráfego pago", { exact: true })).toBeVisible();
  await expect(page.getByText("E. Site / Landing page", { exact: true })).toHaveCount(0);
  await expect(page.getByText("C. Produção de vídeos", { exact: true })).toHaveCount(0);

  // Concluir os dois passos de abertura fecha o marco.
  await page.getByLabel("Repasse da data de início e dos serviços vendidos para a coordenação", { exact: true }).click();
  await expect(page.getByText("Passos do onboarding (1/7)")).toBeVisible();
  await page.getByLabel("Grupo de WhatsApp criado (cliente + equipe)", { exact: true }).click();
  await expect(page.getByText("Passos do onboarding (2/7)")).toBeVisible();
  await expect(marcos.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Abertura" }) }).first()).toContainText("Concluído");
  await expect.poll(async () => (await admin.from("client_timeline").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("title", "Marco concluído: Abertura")).count).toBe(1);

  // Passar um passo para a Joana avisa a Joana.
  await page.getByRole("combobox", { name: "Responsável por Reunião de briefing agendada" }).click();
  await page.getByRole("option", { name: people.Joana.name }).click();
  await expect
    .poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Joana.id).like("title", "Passo de onboarding para você:%")).count)
    .toBe(1);
});

test("2. Configurações → Onboarding mostra os passos com marco, setor e dias úteis", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/configuracoes/onboarding");
  await expect(page.getByRole("heading", { name: "Passos do onboarding" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Reunião de briefing agendada.*Briefing.*2 dia\(s\) útil\(eis\)/ })).toBeVisible();
  await page.getByRole("button", { name: /Reunião de briefing agendada/ }).click();
  await expect(page.getByRole("combobox", { name: "Contar em" })).toContainText("Dias úteis");
  await expect(page.getByLabel("Orientação")).toHaveValue(/Google Agenda/);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
