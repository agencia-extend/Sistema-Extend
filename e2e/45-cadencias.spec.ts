import { createCipheriv, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Cadências de follow-up (RF-CRM-06):
 * 1. a pessoa do Comercial cria uma cadência em Configurações › Cadências (mensagem que sai sozinha + ligação);
 * 2. no lead, inicia a cadência: os passos entram nas próximas ações; pausa (os prazos ficam guardados) e retoma;
 * 3. o job manda a mensagem automática pelo WhatsApp (servidor de teste no formato do WAHA, só local) e ela aparece
 *    como enviada; "não quer mais contato" encerra a cadência e bloqueia outra.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const encKey = process.env.TOKEN_ENCRYPTION_KEY ?? "";
const jobsToken = process.env.JOBS_TOKEN ?? "";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const configured = Boolean(url && secret);
const local = Boolean(encKey && jobsToken && /localhost|127\.0\.0\.1/.test(base));

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const cadName = `Retomada ${stamp.slice(-6)}`;
const leadName = `Carla Mendes ${stamp}`;
const phone = `5511${stamp.slice(-9)}`;
const people: Record<string, { id: string; email: string }> = {};
const sent: { chatId: string; text: string }[] = [];
let leadId = "";
let connId = "";
let stub: Server | null = null;
const stubKey = randomBytes(24).toString("hex");

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(encKey.trim(), "base64"), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: r } = await admin.from("roles").select("id").eq("key", "comercial").single();
  const email = `co.cad.${stamp}@extend.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `Co ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people.Co = { id: data.user.id, email };
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  const { data: pipe } = await admin.from("pipelines").select("id, pipeline_stages(id, position)").eq("organization_id", org!.id).order("is_default", { ascending: false }).limit(1).single();
  const stage = (pipe!.pipeline_stages as { id: string; position: number }[]).sort((a, b) => a.position - b.position)[0];
  const { data: lead, error: le } = await admin.from("leads").insert({ organization_id: org!.id, pipeline_id: pipe!.id, stage_id: stage.id, name: leadName, company: "Clínica Sorriso", phone, source: "site", owner_id: people.Co.id, created_by: people.Co.id }).select("id").single();
  if (le) throw le;
  leadId = lead.id;

  const { count } = await admin.from("whatsapp_connections").select("id", { count: "exact", head: true }).eq("organization_id", org!.id);
  if (local && !count) {
    stub = createServer((req, res) => {
      const reply = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
      if (req.headers["x-api-key"] !== stubKey) return reply(401, {});
      if (req.url === "/api/sessions/extend") return reply(200, { status: "WORKING", me: { id: "554899990000@c.us" } });
      if (req.method === "POST" && req.url === "/api/sendText") {
        let raw = "";
        req.on("data", (x) => (raw += x));
        req.on("end", () => { const b = JSON.parse(raw) as { chatId: string; text: string }; sent.push({ chatId: b.chatId, text: b.text }); reply(201, { id: `3EB0${stamp}` }); });
        return;
      }
      reply(404, {});
    });
    await new Promise<void>((ok) => stub!.listen(0, "127.0.0.1", ok));
    const { data: c } = await admin.from("whatsapp_connections").insert({
      organization_id: org!.id, base_url: `http://127.0.0.1:${(stub.address() as AddressInfo).port}`, api_key_enc: encrypt(stubKey), session: "extend", webhook_secret_enc: encrypt("x"), status: "WORKING",
    }).select("id").single();
    connId = c!.id;
  }
});

test.afterAll(async () => {
  if (!configured) return;
  if (connId) await admin.from("whatsapp_connections").delete().eq("id", connId);
  stub?.close();
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
  await admin.from("cadence_templates").delete().eq("name", cadName);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. cria a cadência com mensagem automática e ligação", async ({ page }) => {
  await login(page, "Co");
  await page.goto("/configuracoes/cadencias");
  await expect(page.getByRole("list", { name: "Cadências" })).toContainText("Follow-up de proposta");
  await page.getByRole("button", { name: "Nova cadência" }).click();
  const d = page.getByRole("dialog", { name: "Nova cadência" });
  await d.getByLabel("Nome").fill(cadName);
  await d.getByLabel("O que fazer").fill("Mensagem de retomada");
  await d.getByLabel("Mensagem").fill("Oi, {nome}! Ainda faz sentido falarmos sobre a {empresa}?");
  await d.getByLabel("Enviar sozinha pelo WhatsApp da Extend no horário").check();
  await d.getByRole("button", { name: "Adicionar passo" }).click();
  const steps = d.getByRole("list", { name: "Passos" }).getByRole("listitem");
  await steps.nth(1).getByLabel("Tipo").click();
  await page.getByRole("option", { name: "Ligação" }).click();
  await d.getByRole("button", { name: "Criar cadência" }).click();
  await expect(d.getByText("Passo 2: Dê um título ao passo.")).toBeVisible();
  await steps.nth(1).getByLabel("O que fazer").fill("Ligar para combinar");
  await d.getByRole("button", { name: "Criar cadência" }).click();
  await expect(page.getByText("Cadência criada.")).toBeVisible();
  const item = page.getByRole("list", { name: "Cadências" }).getByRole("listitem").filter({ hasText: cadName });
  await expect(item).toContainText("sai sozinha");
  await expect(item).toContainText("D+2");
});

test("2. inicia no lead, pausa e retoma", async ({ page }) => {
  await login(page, "Co");
  await page.goto(`/comercial/leads/${leadId}`);
  const card = page.getByRole("region", { name: "Cadência" });
  await card.getByRole("combobox", { name: "Cadência" }).click();
  await page.getByRole("option", { name: cadName }).click();
  await expect(card.getByRole("list", { name: "Passos da cadência" })).toContainText("Ligação: Ligar para combinar");
  await card.getByRole("button", { name: "Iniciar cadência" }).click();
  await expect(page.getByText("Cadência iniciada. Os passos entraram nas próximas ações.")).toBeVisible();
  const next = page.getByRole("region", { name: "Próximas ações" });
  await expect(next).toContainText(`Sai sozinha pelo WhatsApp: Oi, Carla! Ainda faz sentido falarmos sobre a Clínica Sorriso?`);
  await expect(next).toContainText("Ligação da cadência");
  await expect(card).toContainText("0 de 2 passos feitos");
  await card.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText("Cadência pausada.")).toBeVisible();
  await expect(next.getByText(/Cadência pausada: era para/).first()).toBeVisible();
  await card.getByRole("button", { name: "Retomar" }).click();
  await expect(page.getByText(/Cadência retomada/)).toBeVisible();
  await expect(next.getByText(/Cadência pausada: era para/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("3. a mensagem sai sozinha; não quer mais contato encerra", async ({ page, isMobile }) => {
  if (connId && !isMobile) {
    // A mensagem venceu: o job (de 15 em 15 minutos) manda pelo WhatsApp.
    await admin.from("lead_activities").update({ due_at: new Date(Date.now() - 60_000).toISOString() }).eq("lead_id", leadId).not("auto_message", "is", null);
    const res = await page.request.post("/api/jobs/cadence-send", { headers: { authorization: `Bearer ${jobsToken}` } });
    expect(await res.json()).toMatchObject({ ok: true, result: { sent: 1, failed: 0 } });
    expect(sent.at(-1)).toEqual({ chatId: `${phone}@c.us`, text: "Oi, Carla! Ainda faz sentido falarmos sobre a Clínica Sorriso?" });
    await login(page, "Co");
    await page.goto(`/comercial/leads/${leadId}`);
    await expect(page.getByText(/Enviada sozinha pelo WhatsApp em/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Cadência" })).toContainText("1 de 2 passos feitos");
  } else {
    await login(page, "Co");
    await page.goto(`/comercial/leads/${leadId}`);
  }
  const card = page.getByRole("region", { name: "Cadência" });
  await card.getByText("Não quer mais contato?").click();
  await card.getByLabel("Motivo (opcional)").fill("Pediu para parar");
  await card.getByRole("button", { name: "Marcar: não quer mais contato" }).click();
  await expect(page.getByText("Anotado: não recebe mais contato. A cadência foi encerrada.")).toBeVisible();
  await expect(card).toContainText("Pediu para parar");
  await expect(page.getByRole("region", { name: "Próximas ações" })).not.toContainText("da cadência");
  const { data } = await admin.from("cadence_enrollments").select("status").eq("lead_id", leadId).single();
  expect(data!.status).toBe("cancelada");
  // Desfaz para o outro aparelho do teste começar do zero.
  await card.getByRole("button", { name: "Voltou a aceitar contato" }).click();
  await expect(page.getByText("O lead volta a aceitar contato.")).toBeVisible();
  await admin.from("cadence_enrollments").delete().eq("lead_id", leadId);
  await admin.from("lead_activities").delete().eq("lead_id", leadId);
});
