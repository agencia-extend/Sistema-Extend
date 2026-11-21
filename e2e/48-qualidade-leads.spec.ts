import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Qualidade dos leads (RF-T2-01):
 * 1. o gestor do cliente importa a planilha da Central de leads da Meta (a linha sem data fica de fora, com o motivo),
 *    reimportar não duplica, gera o link de avaliação e avalia um lead pelo sistema;
 * 2. o cliente abre o link sem login, precisa dizer o nome e avalia; o painel mostra % de qualificados e o custo por
 *    lead qualificado, e a equipe é avisada;
 * 3. gestor de fora do cliente não importa. Regras no banco: 54_qualidade_leads.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Imobiliária Leads ${stamp}`;
const camp = `IMOB_LEADS_${stamp.slice(-6)}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";
let accountId = "";
let reviewPath = "";
const day = (n: number) => new Date(Date.now() - 3 * 3600_000 - n * 86_400_000).toISOString().slice(0, 10);

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.qld.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

const csv = (sep = ",") =>
  [
    "id,created_time,campaign_name,ad_name,full_name,phone_number,email",
    `${stamp}1,${day(2)}T10:00:00-03:00,${camp},Vídeo 1,Ana Souza,p:+5551999990001,ana@x.com`,
    `${stamp}2,${day(1)}T15:30:00-03:00,${camp},Vídeo 1,Bruno Lima,p:+5551999990002,`,
    `${stamp}3,,${camp},Vídeo 1,Sem Data,,`,
  ].map((l) => l.split(",").join(sep)).join("\n");
// Como a Central de leads da Meta exporta: UTF-16 com BOM, separado por tabulação.
const metaFile = () => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csv("\t"), "utf16le")]);

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Gil", "gestor_trafego");
  await makeUser("Ivo", "gestor_trafego");
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Gil.id });
  const { data: acc, error: e2 } = await admin
    .from("ad_accounts")
    .insert({ organization_id: org!.id, provider: "meta", external_id: `act_7${stamp.slice(-9)}`, name: `Conta Leads ${stamp}`, client_id: clientId, is_enabled: true })
    .select("id")
    .single();
  if (e2) throw e2;
  accountId = acc.id;
  await admin.from("ad_campaigns").insert({ ad_account_id: accountId, external_id: "ql1", name: camp, effective_status: "ACTIVE" });
  // R$ 30,00 por dia nos últimos 3 dias = R$ 90,00 na campanha.
  await admin.from("ad_insights_daily").insert([1, 2, 3].map((i) => ({ ad_account_id: accountId, level: "campaign", object_external_id: "ql1", date: day(i), spend_cents: 3000 })));
});

test.afterAll(async () => {
  if (!configured) return;
  if (accountId) await admin.from("ad_accounts").delete().eq("id", accountId);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. importa a planilha da Meta, não duplica, gera o link e avalia pelo sistema", async ({ page }) => {
  await login(page, "Gil");
  await page.goto(`/clientes/${clientId}/trafego#leads`);
  const section = page.getByRole("region", { name: "Qualidade dos leads" });
  await expect(section.getByText("Nenhum lead importado")).toBeVisible();

  for (const round of [1, 2]) {
    await section.getByRole("button", { name: "Importar leads" }).click();
    const d = page.getByRole("dialog", { name: "Importar leads do cliente" });
    await d.getByLabel("Planilha de leads").setInputFiles({ name: "leads.csv", mimeType: "text/csv", buffer: round === 1 ? Buffer.from(csv()) : metaFile() });
    await expect(d.getByText(/2 leads prontos para importar; 1 linha fica de fora/)).toBeVisible();
    await expect(d.getByText("Linha 4: sem data do lead (use dd/mm/aaaa).")).toBeVisible();
    await d.getByRole("button", { name: "Importar 2 leads" }).click();
    await expect(page.getByText(round === 1 ? "2 leads importados." : "0 leads importados; 2 já estavam no sistema.")).toBeVisible();
  }

  const table = section.getByRole("table", { name: "Qualidade dos leads por campanha" });
  await expect(table.getByRole("row", { name: new RegExp(camp) })).toContainText("2");
  await expect(section.getByRole("list", { name: "Leads do período" })).toContainText("Ana Souza");
  await expect(section.getByRole("list", { name: "Leads do período" })).toContainText("Vídeo 1");

  // Link de avaliação.
  await section.getByRole("button", { name: "Link de avaliação" }).click();
  const ld = page.getByRole("dialog", { name: "Link de avaliação de leads" });
  await ld.getByRole("button", { name: "Gerar link" }).click();
  const link = await ld.getByLabel("Endereço para mandar ao cliente").inputValue();
  expect(link).toMatch(/\/avaliar-leads\/[A-Za-z0-9_-]{43}$/);
  reviewPath = new URL(link).pathname;
  await page.keyboard.press("Escape");

  // A equipe avalia o Bruno (o cliente contou por telefone).
  await section.getByRole("combobox", { name: "Avaliação de Bruno Lima" }).click();
  await page.getByRole("option", { name: "Ruim" }).click();
  await expect(page.getByText("Avaliação salva.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("2. o cliente avalia pelo link e o painel mostra qualificados e custo", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(reviewPath);
  await expect(page.getByRole("heading", { name: "Como foram estes leads?" })).toBeVisible();
  await expect(page.getByText(clientName)).toBeVisible();
  const ana = page.getByRole("listitem").filter({ hasText: "Ana Souza" });
  await ana.getByRole("radio", { name: "Bom" }).click();
  await expect(page.getByText("Diga seu nome antes de avaliar.")).toBeVisible();
  await page.getByLabel("Seu nome").fill("Marcos (sócio)");
  await ana.getByRole("radio", { name: "Bom" }).click();
  await expect(ana.getByText("Salvo.")).toBeVisible();
  await expect(ana.getByRole("radio", { name: "Bom" })).toHaveAttribute("aria-checked", "true");
  await ana.getByLabel("Comentário").fill("Visitou o apartamento");
  await page.getByLabel("Seu nome").click(); // sai do comentário: salva
  await expect(ana.getByText("Salvo.")).toBeVisible();
  await expect(page.getByText("2 de 2 avaliados.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  const { data: lead } = await admin.from("client_leads").select("quality, quality_note, rated_by_name").eq("client_id", clientId).eq("name", "Ana Souza").single();
  expect(lead).toEqual({ quality: "bom", quality_note: "Visitou o apartamento", rated_by_name: "Marcos (sócio)" });

  await login(page, "Gil");
  await page.goto(`/clientes/${clientId}/trafego#leads`);
  const row = page.getByRole("table", { name: "Qualidade dos leads por campanha" }).getByRole("row", { name: new RegExp(camp) });
  await expect(row).toContainText("50%"); // 1 bom de 2 avaliados
  await expect(row).toContainText(/R\$\s90,00/); // R$ 90 gastos ÷ 1 qualificado
  await expect(page.getByRole("list", { name: "Leads do período" })).toContainText("Bom por Marcos (sócio): Visitou o apartamento");
  const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Gil.id).like("dedupe_key", "leadrate:%");
  expect(count).toBe(1);
  await admin.from("client_leads").delete().eq("client_id", clientId); // o outro aparelho do teste começa do zero
  await admin.from("notifications").delete().eq("user_id", people.Gil.id).like("dedupe_key", "leadrate:%");
});

test("3. gestor de fora do cliente não importa leads", async ({ page }) => {
  await login(page, "Ivo");
  await page.goto(`/clientes/${clientId}/trafego`);
  await expect(page.getByRole("button", { name: "Importar leads" })).toHaveCount(0);
});
