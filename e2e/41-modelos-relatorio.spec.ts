import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Modelos de relatório (RF-REL-02), prévia e envio (RF-REL-03) e PDF (RF-REL-05):
 * 1. a gerente de tráfego cria um modelo com variáveis (inserindo pelos botões) e vê a prévia; variável errada não salva;
 * 2. a gestora abre "Relatório" no cliente: prévia com os números reais da semana passada no modelo padrão; escolhe o
 *    modelo novo (vale para o cliente) e a prévia muda; baixa o PDF; envia para o grupo de relatórios (servidor de teste
 *    no formato do WAHA, só local);
 * 3. a gestora não cria nem edita modelos; quem não vê o cliente ou não entrou não baixa o PDF;
 * 4. a gestora agenda o envio diário (RF-REL-01); o job de hora em hora manda texto e PDF uma vez só; os PDFs
 *    enviados ficam na aba Relatórios do cliente para baixar (RF-REL-06), e quem não vê os anúncios não baixa.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const encKey = process.env.TOKEN_ENCRYPTION_KEY ?? "";
const jobsToken = process.env.JOBS_TOKEN ?? "";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const configured = Boolean(url && secret);
const local = Boolean(encKey && /localhost|127\.0\.0\.1/.test(base));

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Pizzaria Números ${stamp}`;
const templateName = `Semanal curto ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
const texts: string[] = [];
const files: { url: string; filename: string }[] = [];
let orgId = "";
let clientId = "";
let accountId = "";
let connId = "";
let stub: Server | null = null;
const stubKey = randomBytes(24).toString("hex");

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(encKey.trim(), "base64"), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

/** Segunda-feira da semana passada (dia de São Paulo), como o relatório calcula. */
function lastMonday() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7);
  return d;
}
const plus = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.mrl.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Ger", "gerente_trafego");
  await makeUser("Ana", "gestor_trafego");
  await makeUser("Edi", "editor_video");
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  orgId = org!.id;
  const { data: c, error } = await admin.from("clients").insert({ organization_id: orgId, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Ana.id });
  const { data: acc, error: ae } = await admin
    .from("ad_accounts")
    .insert({ organization_id: orgId, provider: "meta", external_id: `act_7${stamp.slice(-9)}`, name: `Conta Pizzaria ${stamp}`, client_id: clientId, is_enabled: true, account_status_code: 1, is_prepay: false, synced_at: new Date().toISOString() })
    .select("id")
    .single();
  if (ae) throw ae;
  accountId = acc.id;
  const campExt = `c${stamp}`;
  const { data: camp } = await admin.from("ad_campaigns").insert({ ad_account_id: accountId, external_id: campExt, name: `Cadastros Rodízio ${stamp}`, objective: "OUTCOME_LEADS", effective_status: "ACTIVE" }).select("id").single();
  await admin.from("ads").insert({ ad_account_id: accountId, campaign_id: camp!.id, external_id: `a${stamp}`, name: `VIDEO_RODIZIO_${stamp}`, effective_status: "ACTIVE" });
  // Semana passada: 2 dias de R$ 150,00, 6 leads por dia (R$ 300,00 e 12 leads: CPL R$ 25,00).
  const mon = lastMonday();
  const rows = [1, 2].flatMap((n) => (["account", "campaign", "ad"] as const).map((level) => ({
    ad_account_id: accountId, level, object_external_id: level === "account" ? "acc" : level === "campaign" ? campExt : `a${stamp}`, date: plus(mon, n),
    spend_cents: 15000, impressions: 5000, clicks: 120, link_clicks: 100, leads: 6,
  })));
  // Ontem: R$ 80,00 e 4 leads (o relatório diário).
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const yesterday = plus(new Date(`${today}T12:00:00Z`), -1);
  for (const level of ["account", "campaign", "ad"] as const) {
    rows.push({ ad_account_id: accountId, level, object_external_id: level === "account" ? "acc" : level === "campaign" ? campExt : `a${stamp}`, date: yesterday, spend_cents: 8000, impressions: 2000, clicks: 50, link_clicks: 40, leads: 4 });
  }
  const { error: ie } = await admin.from("ad_insights_daily").insert(rows);
  if (ie) throw ie;

  // Envio: servidor de teste no formato do WAHA (só local e sem WhatsApp real conectado).
  const { count } = await admin.from("whatsapp_connections").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  if (local && !count) {
    stub = createServer((req, res) => {
      const send = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
      if (req.headers["x-api-key"] !== stubKey) return send(401, { error: "chave" });
      if (req.url === "/api/sessions/extend") return send(200, { status: "WORKING", me: { id: "554899990000@c.us" } });
      if (req.method === "POST" && req.url === "/api/sendText") {
        let raw = "";
        req.on("data", (x) => (raw += x));
        req.on("end", () => { texts.push((JSON.parse(raw) as { text: string }).text); send(201, { id: { _serialized: `true_g_${stamp}` } }); });
        return;
      }
      if (req.method === "POST" && req.url === "/api/sendFile") {
        let raw = "";
        req.on("data", (x) => (raw += x));
        req.on("end", () => { files.push((JSON.parse(raw) as { file: { url: string; filename: string } }).file); send(201, { id: { _serialized: `true_f_${stamp}` } }); });
        return;
      }
      send(404, { error: "não existe" });
    });
    await new Promise<void>((ok) => stub!.listen(0, "127.0.0.1", ok));
    const { data: conn, error: ce } = await admin.from("whatsapp_connections").insert({
      organization_id: orgId, base_url: `http://127.0.0.1:${(stub.address() as AddressInfo).port}`, api_key_enc: encrypt(stubKey), session: "extend", webhook_secret_enc: encrypt("x"), status: "WORKING",
    }).select("id").single();
    if (ce) throw ce;
    connId = conn.id;
    await admin.from("whatsapp_groups").insert({ connection_id: connId, jid: `1203${stamp}@g.us`, name: "Relatórios Extend", is_reports: true });
  }
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    const { data: stored } = await admin.storage.from("relatorios").list(`${orgId}/${clientId}`);
    if (stored?.length) await admin.storage.from("relatorios").remove(stored.map((x) => `${orgId}/${clientId}/${x.name}`));
    await admin.from("whatsapp_outbox").delete().like("dedupe_key", `relatorio:%${clientId}%`);
  }
  if (connId) await admin.from("whatsapp_connections").delete().eq("id", connId);
  stub?.close();
  if (accountId) await admin.from("ad_accounts").delete().eq("id", accountId);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  await admin.from("report_templates").delete().eq("name", templateName);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. gerente cria um modelo com variáveis e vê a prévia", async ({ page }) => {
  await login(page, "Ger");
  await page.goto("/configuracoes/relatorios");
  await expect(page.getByRole("list", { name: "Modelos de relatório" })).toContainText("Padrão da agência");
  await page.getByRole("button", { name: "Novo modelo" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo modelo de relatório" });
  await dialog.getByLabel("Nome do modelo").fill(templateName);
  const body = dialog.getByLabel("Texto do relatório");
  await body.fill("*{cliente}* · {periodo}\nCusto: {custo_lead}");
  await dialog.getByRole("button", { name: "Criar modelo" }).click();
  await expect(dialog.getByText("Variável que o sistema não conhece: {custo_lead}.", { exact: false })).toBeVisible();

  await body.fill("*{cliente}* · {periodo}\nInvestido {investimento} · CPL ");
  await dialog.getByRole("button", { name: "Inserir Custo por lead" }).click();
  await body.press("End");
  await body.pressSequentially("\nSaldo {saldo}\nMelhor: ");
  await dialog.getByRole("button", { name: "Inserir Anúncio com melhor resultado" }).click();
  await expect(body).toHaveValue("*{cliente}* · {periodo}\nInvestido {investimento} · CPL {cpl}\nSaldo {saldo}\nMelhor: {top_criativo}");
  const preview = dialog.getByRole("region", { name: "Prévia com números de exemplo" });
  await expect(preview).toContainText("*Clínica Exemplo* · 09/11 a 15/11");
  await expect(preview).toContainText("CPL R$ 20,00");
  await dialog.getByRole("button", { name: "Criar modelo" }).click();
  await expect(page.getByText("Modelo criado.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Modelos de relatório" }).getByRole("listitem").filter({ hasText: templateName })).toContainText("Nenhum cliente usa ainda");
});

test("2. gestora vê a prévia real, escolhe o modelo do cliente, baixa o PDF e envia", async ({ page }) => {
  await login(page, "Ana");
  await page.goto(`/clientes/${clientId}/anuncios`);
  await page.getByRole("button", { name: "Relatório", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Relatório de anúncios" });
  const preview = dialog.getByRole("region", { name: /^Prévia/ });
  await expect(preview).toContainText(`*Relatório de anúncios — ${clientName}*`);
  await expect(preview).toContainText("Investimento: *R$ 300,00*");
  await expect(preview).toContainText(`▪️ Cadastros Rodízio ${stamp}`);
  await expect(preview).toContainText(`Destaque: VIDEO_RODIZIO_${stamp} (12 leads a R$ 25,00 cada)`);
  await expect(preview).not.toContainText("Saldo");

  await dialog.getByLabel("Modelo do cliente").click();
  await page.getByRole("option", { name: templateName }).click();
  await expect(page.getByText("Modelo do cliente salvo.")).toBeVisible();
  await expect(preview).toContainText(`*${clientName}* ·`);
  await expect(preview).toContainText("Investido R$ 300,00 · CPL R$ 25,00");
  await expect(preview).not.toContainText("Saldo");
  await expect(preview).toContainText(`Melhor: VIDEO_RODIZIO_${stamp}`);
  const { data: setting } = await admin.from("client_report_settings").select("report_templates(name)").eq("client_id", clientId).single();
  expect(setting).toMatchObject({ report_templates: { name: templateName } });

  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("link", { name: "Baixar PDF" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^relatorio-anuncios-pizzaria-numeros-\d+-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(readFileSync((await download.path())!).subarray(0, 5).toString()).toBe("%PDF-");
  // Período sem gasto: não há PDF.
  const empty = await page.request.get(`/clientes/${clientId}/anuncios/relatorio?periodo=hoje`);
  expect(empty.status()).toBe(422);

  if (connId) {
    await dialog.getByRole("button", { name: "Enviar no WhatsApp" }).click();
    await expect(page.getByText("Relatório e PDF enviados para o grupo de relatórios. O PDF ficou na aba Relatórios do cliente.")).toBeVisible();
    expect(texts.at(-1)).toContain("Investido R$ 300,00 · CPL R$ 25,00");
    // O WAHA baixa o PDF pelo link assinado e manda como documento.
    expect(files.at(-1)?.filename).toMatch(/^relatorio-anuncios-pizzaria-numeros-\d+-.+\.pdf$/);
    const pdf = await fetch(files.at(-1)!.url);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  }
});

test("3. gestora não cria nem edita modelos; quem não vê o cliente e quem não entrou não baixam o PDF", async ({ page }) => {
  await login(page, "Ana");
  await page.goto("/configuracoes/relatorios");
  await expect(page.getByText("Só quem configura os relatórios de todos os clientes cria e edita modelos.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo modelo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Editar ${templateName}` })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  // A gerente não faz parte da equipe deste cliente: a RLS não mostra o cliente.
  await login(page, "Ger");
  const other = await page.request.get(`/clientes/${clientId}/anuncios/relatorio?periodo=semana`);
  expect(other.status()).toBe(404);
  await page.context().clearCookies();
  const anon = await page.request.get(`/clientes/${clientId}/anuncios/relatorio?periodo=semana`, { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(anon.status());
});

test("4. agenda diária: o job manda texto e PDF uma vez; os PDFs ficam na aba Relatórios", async ({ page }) => {
  await login(page, "Ana");
  await page.goto(`/clientes/${clientId}/anuncios`);
  await page.getByRole("button", { name: "Relatório", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Relatório de anúncios" });
  const box = dialog.getByRole("group", { name: "Envio automático no grupo de relatórios" });
  await expect(box).toContainText("Toda segunda, com a semana passada, às 9h.");
  await box.getByLabel("Frequência").click();
  await page.getByRole("option", { name: "Todo mês (mês passado)" }).click();
  await box.getByLabel("Dia do mês").click();
  await page.getByRole("option", { name: "Dia 5", exact: true }).click();
  await expect(box).toContainText("Todo dia 5, com o mês passado, às 9h.");
  await box.getByLabel("Frequência").click();
  await page.getByRole("option", { name: "Todo dia (dia anterior)" }).click();
  await expect(box.getByLabel("Dia do mês")).toHaveCount(0);
  await box.getByLabel("Horário").click();
  await page.getByRole("option", { name: "6h", exact: true }).click();
  await box.getByRole("button", { name: "Salvar envio" }).click();
  await expect(page.getByText("Envio automático salvo.")).toBeVisible();
  await expect(box.getByRole("button", { name: "Salvar envio" })).toBeDisabled();
  const { data: sch } = await admin.from("client_report_settings").select("frequency, month_day, send_hour, report_templates(name)").eq("client_id", clientId).single();
  expect(sch).toMatchObject({ frequency: "diario", month_day: 5, send_hour: 6, report_templates: { name: templateName } });
  await page.keyboard.press("Escape");

  // O job de hora em hora (só local, com o servidor de teste e sem outros clientes que receberiam agora).
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }));
  const { data: others } = await admin.from("ad_accounts").select("client_id, clients!inner(status, deleted_at)").eq("is_enabled", true).neq("client_id", clientId).eq("clients.status", "ativo").is("clients.deleted_at", null);
  if (connId && jobsToken && hour >= 6 && !others?.length) {
    const call = () => page.request.post("/api/jobs/whatsapp-reports", { headers: { authorization: `Bearer ${jobsToken}` } });
    const first = await (await call()).json();
    expect(first).toMatchObject({ ok: true, result: { due: 1, sent: 1, errors: [] } });
    expect(texts.at(-1)).toContain("Investido R$ 80,00 · CPL R$ 20,00");
    const again = await (await call()).json();
    expect(again).toMatchObject({ ok: true, result: { due: 1, sent: 0 } });
    expect(texts.filter((t) => t.includes("Investido R$ 80,00")).length).toBe(1);
    const { data: daily } = await admin.from("ads_report_files").select("frequency, sent_by").eq("client_id", clientId).eq("frequency", "diario").single();
    expect(daily).toMatchObject({ frequency: "diario", sent_by: null });
  }

  await page.goto(`/clientes/${clientId}/relatorios`);
  const section = page.getByRole("region", { name: "PDFs dos relatórios de anúncios" });
  if (connId) {
    await expect(section.getByRole("row").filter({ hasText: "Semanal" })).toHaveCount(1);
    const link = section.getByRole("link", { name: /^Baixar o PDF do relatório de / }).first();
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(readFileSync((await download.path())!).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const { data: stored } = await admin.from("ads_report_files").select("id").eq("client_id", clientId).limit(1).single();
    // A gerente configura os relatórios de todos os clientes e baixa; quem não vê anúncios, não.
    await login(page, "Ger");
    expect((await page.request.get(`/clientes/${clientId}/relatorios/pdf/${stored!.id}`)).status()).toBe(200);
    await login(page, "Edi");
    expect((await page.request.get(`/clientes/${clientId}/relatorios/pdf/${stored!.id}`)).status()).toBe(404);
  } else {
    await expect(section).toContainText("Nenhum relatório de anúncios enviado ainda.");
  }
});
