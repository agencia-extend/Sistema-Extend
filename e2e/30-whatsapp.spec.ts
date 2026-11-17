import { createDecipheriv, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * WhatsApp (WAHA): o admin salva o servidor (o WAHA local em Docker, infra/waha), inicia a conexão e o QR Code
 * aparece; o aviso assinado de "conectado" muda a situação; grupos ligados a clientes, um de alertas internos,
 * e o envio de teste registrado (falha visível quando o número não está de fato no aparelho); webhook com
 * assinatura errada é recusado; quem não é admin não abre. Só roda local e se ainda não houver conexão real.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const local = /localhost|127\.0\.0\.1/.test(base);
let wahaKey = "";
try {
  wahaKey = readFileSync("infra/waha/.env", "utf8").match(/^WAHA_API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
} catch {
  wahaKey = "";
}
const configured = Boolean(url && secret && local && wahaKey && process.env.E2E_ADMIN_EMAIL && process.env.TOKEN_ENCRYPTION_KEY);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Só local, com o WAHA da infra/waha ligado e as variáveis E2E_*.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
let orgId = "";
let connId = "";
let skipReal = false;
let editor = { id: "", email: "" };
let clientId = "";

const key = () => Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!.trim(), "base64");
const decrypt = (payload: string) => {
  const [iv, tag, data] = payload.split(".");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
};

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  orgId = org!.id;
  const { count } = await admin.from("whatsapp_connections").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  skipReal = Boolean(count);
  const { data: r } = await admin.from("roles").select("id").eq("key", "editor_video").single();
  const email = `edi.wa.${stamp}@extend.test`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `Edi ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  editor = { id: u.user.id, email };
  const { data: c } = await admin.from("clients").insert({ organization_id: orgId, name: `Clínica WhatsApp ${stamp}`, status: "ativo" }).select("id").single();
  clientId = c!.id;
});

test.afterAll(async () => {
  if (!configured) return;
  if (connId) {
    await fetch("http://127.0.0.1:3032/api/sessions/extend", { method: "DELETE", headers: { "X-Api-Key": wahaKey } }).catch(() => null);
    await admin.from("whatsapp_connections").delete().eq("id", connId);
  }
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  if (editor.id) await admin.auth.admin.deleteUser(editor.id);
});

test("1. salvar o servidor, iniciar a conexão e ver o QR Code", async ({ page }) => {
  test.skip(skipReal, "Já existe uma conexão de WhatsApp real: o teste não mexe nela.");
  await login(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await page.goto("/configuracoes/whatsapp");
  await page.getByLabel("Endereço do servidor").fill("http://127.0.0.1:3032");
  await page.getByLabel("Chave da API (WAHA_API_KEY)").fill("chave-errada-com-tamanho-ok");
  await page.getByRole("button", { name: "Testar e salvar" }).click();
  await expect(page.getByText("O servidor do WhatsApp recusou a chave. Confira a chave da API.")).toBeVisible();
  await page.getByLabel("Chave da API (WAHA_API_KEY)").fill(wahaKey);
  await page.getByRole("button", { name: "Testar e salvar" }).click();
  await expect(page.getByText("Servidor do WhatsApp salvo. Agora conecte o número.")).toBeVisible();
  const { data: conn } = await admin.from("whatsapp_connections").select("id, api_key_enc").eq("organization_id", orgId).single();
  connId = conn!.id;
  expect(conn!.api_key_enc).not.toContain(wahaKey); // cifrada

  await page.getByRole("button", { name: "Conectar número" }).click();
  await expect(page.getByRole("img", { name: "QR Code para conectar o WhatsApp" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Esperando a leitura do QR Code")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("2. webhook assinado marca como conectado; assinatura errada é recusada", async ({ page, request }) => {
  test.skip(skipReal || !connId, "Sem conexão de teste.");
  const { data: conn } = await admin.from("whatsapp_connections").select("webhook_secret_enc").eq("id", connId).single();
  const secretKey = decrypt(conn!.webhook_secret_enc);
  const body = JSON.stringify({ event: "session.status", session: "extend", me: { id: "554899990000@c.us", pushName: "Extend Teste" }, payload: { status: "WORKING" } });
  const bad = await request.post(`/api/whatsapp/webhook/${connId}`, { data: body, headers: { "content-type": "application/json", "x-webhook-hmac": "0".repeat(128) } });
  expect(bad.status()).toBe(401);
  const okRes = await request.post(`/api/whatsapp/webhook/${connId}`, { data: body, headers: { "content-type": "application/json", "x-webhook-hmac": createHmac("sha512", secretKey).update(body).digest("hex") } });
  expect(okRes.status()).toBe(200);
  const msg = JSON.stringify({ event: "message.any", session: "extend", payload: { id: `m${stamp}`, from: "222@g.us", fromMe: false, participant: "5548988887777@c.us", body: "Bom dia, equipe!", timestamp: Math.floor(Date.now() / 1000) } });
  const m = await request.post(`/api/whatsapp/webhook/${connId}`, { data: msg, headers: { "content-type": "application/json", "x-webhook-hmac": createHmac("sha512", secretKey).update(msg).digest("hex") } });
  expect(m.status()).toBe(200);
  const { data: saved } = await admin.from("whatsapp_messages").select("body, chat_id").eq("connection_id", connId).single();
  expect(saved).toEqual({ body: "Bom dia, equipe!", chat_id: "222@g.us" });

  await login(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await page.goto("/configuracoes/whatsapp");
  await expect(page.getByRole("status").filter({ hasText: "Conectado" })).toContainText("Extend Teste (554899990000)");
});

test("3. grupos: cliente, alertas internos e envio de teste registrado", async ({ page }) => {
  test.skip(skipReal || !connId, "Sem conexão de teste.");
  await admin.from("whatsapp_groups").insert([
    { connection_id: connId, jid: `1${stamp}@g.us`, name: "Equipe Extend (teste)" },
    { connection_id: connId, jid: `2${stamp}@g.us`, name: "Clínica WhatsApp (teste)" },
  ]);
  await login(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
  await page.goto("/configuracoes/whatsapp");
  await page.getByRole("switch", { name: "Usar Equipe Extend (teste) como grupo de alertas internos" }).click();
  await expect(page.getByText("Grupo salvo.")).toBeVisible();
  await page.getByRole("switch", { name: "Usar Equipe Extend (teste) como grupo de relatórios" }).click();
  await expect(page.getByText("Grupo salvo.").first()).toBeVisible();
  await page.getByLabel("Cliente do grupo Clínica WhatsApp (teste)").click();
  await page.getByRole("option", { name: `Clínica WhatsApp ${stamp}` }).click();
  await expect.poll(async () => (await admin.from("whatsapp_groups").select("name, client_id, is_alerts, is_reports").eq("connection_id", connId).order("name")).data).toEqual([
    { name: "Clínica WhatsApp (teste)", client_id: clientId, is_alerts: false, is_reports: false },
    { name: "Equipe Extend (teste)", client_id: null, is_alerts: true, is_reports: true },
  ]);
  // O número não está de fato no aparelho (o "conectado" veio do teste): o envio falha e a falha aparece.
  await page.getByRole("button", { name: "Enviar teste para Equipe Extend (teste)" }).click();
  await expect(page.getByText("O WhatsApp da Extend não está conectado no servidor. Leia o QR Code em Configurações › WhatsApp.").first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Últimos envios" }).or(page.locator("section").filter({ hasText: "Últimos envios" })).first()).toContainText("Teste · Equipe Extend (teste)");
});

test("4. quem não configura integrações não abre a tela", async ({ page }) => {
  await login(page, editor.email, pw);
  await page.goto("/configuracoes/whatsapp");
  await expect(page).toHaveURL(/sem-acesso/);
});
