import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Atendimento (RF-WPP-03): mensagem de um contato chega pelo webhook assinado do WAHA e aparece na caixa de entrada com
 * "não lida" e "aguardando"; a pessoa do Comercial abre a conversa (fica lida), tenta responder (o servidor do WhatsApp
 * local responde que a sessão de teste não está conectada e a tela mostra o motivo), cria o lead no funil a partir da
 * conversa e encerra. Quem não atende não vê o Atendimento. Só local, com o WAHA da infra/waha ligado (como o spec 30).
 * Regras no banco: 42_atendimento.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const encKey = process.env.TOKEN_ENCRYPTION_KEY ?? "";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const local = /localhost|127\.0\.0\.1/.test(base);
let wahaKey = "";
try {
  wahaKey = readFileSync("infra/waha/.env", "utf8").match(/^WAHA_API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
} catch {
  wahaKey = "";
}
const configured = Boolean(url && secret && encKey && local && wahaKey);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Só local, com o WAHA da infra/waha ligado e TOKEN_ENCRYPTION_KEY.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const phone = `5511${stamp.slice(-9)}`;
const contact = `Marina ${stamp}`;
const hookSecret = randomBytes(24).toString("hex");
const people: Record<string, { id: string; email: string }> = {};
let orgId = "";
let connId = "";
let convId = "";
let skipReal = false;

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

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.atd.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  orgId = org!.id;
  // Uma conexão por organização: com o número real conectado, o teste não mexe nele.
  const { count } = await admin.from("whatsapp_connections").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  skipReal = Boolean(count);
  if (skipReal) return;
  await makeUser("Ana", "comercial");
  await makeUser("Sol", "social_media");
  const { data: c, error } = await admin.from("whatsapp_connections").insert({
    organization_id: orgId, base_url: "http://127.0.0.1:3032", api_key_enc: encrypt(wahaKey), session: `e2e${stamp}`,
    webhook_secret_enc: encrypt(hookSecret), status: "WORKING", me_id: "554899990000@c.us", me_name: "Extend Teste",
  }).select("id").single();
  if (error) throw error;
  connId = c.id;
  // A conversa já é da Ana (assim o aviso vai só para ela, e não para a equipe real).
  const { data: conv, error: ce } = await admin.from("wa_conversations").insert({ organization_id: orgId, connection_id: connId, chat_id: `${phone}@c.us`, phone, assignee_id: people.Ana.id }).select("id").single();
  if (ce) throw ce;
  convId = conv.id;
});

test.afterAll(async () => {
  if (!configured || skipReal) return;
  await admin.from("leads").delete().eq("phone", phone);
  if (connId) await admin.from("whatsapp_connections").delete().eq("id", connId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. mensagem chega, a pessoa abre, tenta responder, cria o lead e encerra", async ({ page, request }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado: o teste não mexe nele.");
  const msg = JSON.stringify({ event: "message.any", session: `e2e${stamp}`, payload: { id: `in${stamp}`, from: `${phone}@c.us`, fromMe: false, body: "Oi! Quero saber dos planos de tráfego.", timestamp: Math.floor(Date.now() / 1000), _data: { notifyName: contact } } });
  const res = await request.post(`/api/whatsapp/webhook/${connId}`, { data: msg, headers: { "content-type": "application/json", "x-webhook-hmac": createHmac("sha512", hookSecret).update(msg).digest("hex") } });
  expect(res.status()).toBe(200);

  await login(page, "Ana");
  await page.goto("/atendimento");
  const item = page.getByRole("list", { name: "Conversas" }).getByRole("link").filter({ hasText: contact });
  await expect(item).toContainText("Oi! Quero saber dos planos de tráfego.");
  await expect(item).toContainText("Aguardando");
  await expect(item.getByLabel("1 não lidas")).toBeVisible();
  await page.getByRole("link", { name: /^Minhas/ }).click();
  await expect(page.getByRole("list", { name: "Conversas" }).getByRole("link").filter({ hasText: contact })).toBeVisible();

  await item.click();
  await page.waitForURL(`**/atendimento/${convId}`);
  await expect(page.getByRole("heading", { name: contact, level: 1 })).toBeVisible();
  await expect(page.getByRole("list", { name: "Mensagens" })).toContainText("Oi! Quero saber dos planos de tráfego.");
  await expect.poll(async () => (await admin.from("wa_conversations").select("unread_count").eq("id", convId).single()).data!.unread_count).toBe(0);

  // Responder: o WAHA local diz que a sessão de teste não existe → motivo na tela.
  await page.getByLabel("Mensagem").fill("Olá! Te mando os planos já.");
  await page.getByLabel("Mensagem").press("Enter");
  await expect(page.getByText("O WhatsApp da Extend não está conectado no servidor. Conecte pelo QR Code no Atendimento.")).toBeVisible({ timeout: 20_000 });

  // Lead no funil a partir da conversa.
  await expect(page.getByLabel("Nome do lead")).toHaveValue(contact);
  await page.getByRole("button", { name: "Criar lead no funil" }).click();
  await expect(page.getByText("Lead criado no Comercial, no início do funil.")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Detalhes da conversa" }).getByRole("link", { name: contact })).toBeVisible();
  const { data: lead } = await admin.from("leads").select("source, owner_id").eq("phone", phone).single();
  expect(lead).toEqual({ source: "whatsapp", owner_id: people.Ana.id });

  await page.getByRole("button", { name: "Encerrar conversa" }).click();
  await expect(page.getByText("Conversa encerrada.")).toBeVisible();
  await page.goto("/atendimento?aba=encerradas");
  await expect(page.getByRole("list", { name: "Conversas" }).getByRole("link").filter({ hasText: contact })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("2. quem não atende não vê o Atendimento", async ({ page }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado.");
  await login(page, "Sol");
  await expect(page.getByRole("link", { name: "Atendimento" })).toHaveCount(0);
  await page.goto("/atendimento");
  await expect(page).toHaveURL(/\/sem-acesso/);
});
