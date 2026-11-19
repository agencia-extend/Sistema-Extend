import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Conectar e compilar como no HubSystem:
 * 1. o túnel anuncia o endereço do servidor (assinado com a chave do WAHA; assinatura errada é recusada) e a pessoa do
 *    Comercial, no Atendimento, só clica em "Conectar WhatsApp": o QR Code de verdade do WAHA local aparece.
 * 2. com o número conectado (aqui, um servidor de teste que responde como o WAHA com um histórico conhecido), "Compilar
 *    conversas" traz a conversa e o grupo, mostra o andamento, e as duas aparecem no Atendimento (grupo com quem escreveu).
 * Só local, com o WAHA da infra/waha ligado e sem WhatsApp real conectado. Regras no banco: 43_whatsapp_compilar.test.sql.
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
const contact = `Rita ${stamp}`;
const groupJid = `1203630${stamp.slice(-11)}@g.us`;
const groupName = `Clínica Sorriso ${stamp}`;
const stubKey = randomBytes(24).toString("hex");
let orgId = "";
let skipReal = false;
let ana = { id: "", email: "" };
let stub: Server | null = null;
let stubUrl = "";

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(encKey.trim(), "base64"), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

const now = Math.floor(Date.now() / 1000);
// Histórico do "aparelho" (como o WAHA devolve: do mais recente para o mais antigo).
const HISTORY: Record<string, unknown[]> = {
  [`${phone}@c.us`]: [
    { id: `false_${phone}@c.us_B${stamp}`, timestamp: now - 600, fromMe: false, body: "Vocês fazem gestão de Instagram?", _data: { pushName: contact } },
    { id: `true_${phone}@c.us_A${stamp}`, timestamp: now - 900, fromMe: true, body: "Oi, Rita! Tudo bem?" },
  ],
  [groupJid]: [
    { id: `false_${groupJid}_G${stamp}`, timestamp: now - 3600, fromMe: false, participant: "5548988887777@c.us", body: "Post aprovado, pode publicar.", _data: { pushName: "Dra. Paula" } },
  ],
};

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  orgId = org!.id;
  const { count } = await admin.from("whatsapp_connections").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  skipReal = Boolean(count);
  if (skipReal) return;
  const { data: r } = await admin.from("roles").select("id").eq("key", "comercial").single();
  const email = `ana.wc.${stamp}@extend.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `Ana ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  ana = { id: data.user.id, email };

  // Servidor de teste com o mesmo formato de resposta do WAHA, para o histórico ser conhecido.
  stub = createServer((req, res) => {
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers["x-api-key"] !== stubKey) return send(401, { error: "chave" });
    const u = new URL(req.url ?? "/", "http://stub");
    if (u.pathname === "/api/sessions/extend") return send(200, { status: "WORKING", me: { id: "554899990000@c.us", pushName: "Extend" }, config: { noweb: { store: { enabled: true } } } });
    if (u.pathname === "/api/extend/chats/overview") {
      return send(200, u.searchParams.get("offset") === "0" ? [{ id: `${phone}@c.us`, name: null }, { id: groupJid, name: groupName }, { id: "status@broadcast", name: null }] : []);
    }
    const m = /^\/api\/extend\/chats\/([^/]+)\/messages$/.exec(u.pathname);
    if (m) return send(200, u.searchParams.get("offset") === "0" ? (HISTORY[decodeURIComponent(m[1])] ?? []) : []);
    return send(404, { error: "não existe" });
  });
  await new Promise<void>((ok) => stub!.listen(0, "127.0.0.1", ok));
  stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  if (!configured || skipReal) return;
  await fetch("http://127.0.0.1:3032/api/sessions/extend", { method: "DELETE", headers: { "X-Api-Key": wahaKey } }).catch(() => null);
  await admin.from("whatsapp_connections").delete().eq("organization_id", orgId);
  if (ana.id) await admin.auth.admin.deleteUser(ana.id);
  stub?.close();
});

const announce = (body: string, key: string) =>
  ({ data: body, headers: { "content-type": "application/json", "x-extend-signature": createHmac("sha256", key).update(body).digest("hex") } });

test("1. o túnel anuncia o servidor e a pessoa só clica para ver o QR Code", async ({ page, request }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado: o teste não mexe nele.");
  const body = JSON.stringify({ url: "http://127.0.0.1:3032", at: Date.now() });
  expect((await request.post("/api/whatsapp/servidor", announce(body, "chave-errada"))).status()).toBe(401);
  const old = JSON.stringify({ url: "http://127.0.0.1:3032", at: Date.now() - 3_600_000 });
  expect((await request.post("/api/whatsapp/servidor", announce(old, wahaKey))).status()).toBe(401);
  const res = await request.post("/api/whatsapp/servidor", announce(body, wahaKey));
  expect(await res.json()).toEqual({ ok: true, changed: true });
  const { data: conn } = await admin.from("whatsapp_connections").select("base_url, api_key_enc").eq("organization_id", orgId).single();
  expect(conn!.base_url).toBe("http://127.0.0.1:3032");
  expect(conn!.api_key_enc).not.toContain(wahaKey);

  await login(page, ana.email);
  await page.goto("/atendimento");
  await expect(page.getByRole("status").filter({ hasText: "está desconectado" })).toBeVisible();
  await page.getByRole("button", { name: "Conectar WhatsApp" }).click();
  const dialog = page.getByRole("dialog", { name: "Conectar o WhatsApp da Extend" });
  await expect(dialog.getByRole("img", { name: "QR Code para conectar o WhatsApp" })).toBeVisible({ timeout: 60_000 });
  await dialog.getByRole("button", { name: /Conectar com código/ }).click();
  await expect(dialog.getByLabel("Número deste WhatsApp")).toBeVisible();
  await dialog.getByRole("button", { name: "Usar o QR Code" }).click();
  await expect(dialog.getByRole("img", { name: "QR Code para conectar o WhatsApp" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("2. compilar conversas traz a conversa e o grupo para o Atendimento", async ({ page }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado.");
  // O número "conectou": daqui em diante o servidor é o de teste, com o histórico conhecido.
  await fetch("http://127.0.0.1:3032/api/sessions/extend", { method: "DELETE", headers: { "X-Api-Key": wahaKey } }).catch(() => null);
  await admin.from("whatsapp_connections").update({ base_url: stubUrl, api_key_enc: encrypt(stubKey), status: "WORKING", me_id: "554899990000@c.us", me_name: "Extend" }).eq("organization_id", orgId);

  await login(page, ana.email);
  await page.goto("/atendimento");
  const banner = page.getByRole("region", { name: "Trazer conversas antigas" });
  await banner.getByRole("button", { name: "Trazer conversas e grupos" }).click();
  const dialog = page.getByRole("dialog", { name: "Compilar conversas" });
  await expect(dialog.getByRole("checkbox", { name: "Grupos" })).toBeChecked();
  await dialog.getByRole("button", { name: "Compilar conversas" }).click();
  // Primeira passada pronta: espera o aparelho mandar o resto (ou interrompe).
  await expect(dialog.getByText("Esperando o aparelho enviar o resto do histórico…")).toBeVisible({ timeout: 60_000 });
  const stats = dialog.locator("dl");
  await expect(stats).toContainText("Conversas1");
  await expect(stats).toContainText("Grupos1");
  await expect(stats).toContainText("Mensagens3");
  await dialog.getByRole("button", { name: "Interromper" }).click();
  await expect(page.getByText("Compilação interrompida. O que já entrou continua no Atendimento.")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/atendimento");
  const item = page.getByRole("list", { name: "Conversas" }).getByRole("link").filter({ hasText: contact });
  await expect(item).toContainText("Vocês fazem gestão de Instagram?");
  await expect(item).toContainText("Espera há");
  await expect(page.getByRole("region", { name: "Trazer conversas antigas" })).toHaveCount(0);

  await page.getByRole("link", { name: /^Grupos/ }).click();
  const g = page.getByRole("list", { name: "Conversas" }).getByRole("link").filter({ hasText: groupName });
  await expect(g).toContainText("Dra. Paula: Post aprovado, pode publicar.");
  await g.click();
  await expect(page.getByRole("heading", { name: groupName, level: 2 })).toBeVisible();
  await expect(page.getByRole("list", { name: "Mensagens" })).toContainText("Dra. Paula");
  const open = page.getByRole("button", { name: "Detalhes da conversa" });
  const side = (await open.isVisible()) ? (await open.click(), page.getByRole("dialog")) : page.getByRole("complementary", { name: "Detalhes da conversa" });
  await expect(side).toContainText("Grupo sem cliente.");
  await expect(side.getByRole("button", { name: "Criar lead no funil" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
