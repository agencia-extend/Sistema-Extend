import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Mídia no Atendimento (como no HubSystem):
 * 1. foto recebida pelo webhook assinado é guardada no sistema e aparece na conversa (prévia "[foto]"); quem não vê a
 *    conversa não abre o arquivo;
 * 2. a pessoa anexa um PDF com legenda e envia: o servidor do WhatsApp recebe o link temporário e consegue baixar o arquivo;
 * 3. grava um áudio (microfone de teste do navegador) e ele sai como mensagem de voz.
 * O servidor do WhatsApp aqui é um servidor de teste com o formato de resposta do WAHA. Só local, sem WhatsApp real conectado.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const encKey = process.env.TOKEN_ENCRYPTION_KEY ?? "";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const configured = Boolean(url && secret && encKey && /localhost|127\.0\.0\.1/.test(base));

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Só local, com TOKEN_ENCRYPTION_KEY.");
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const phone = `5511${stamp.slice(-9)}`;
const contact = `Lara ${stamp}`;
const hookSecret = randomBytes(24).toString("hex");
const stubKey = randomBytes(24).toString("hex");
// PNG 1x1 de verdade.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const people: Record<string, { id: string; email: string }> = {};
const sent: { path: string; downloaded: number; bytes: number; mimetype: string; filename: string; caption: string | null }[] = [];
let orgId = "";
let connId = "";
let convId = "";
let skipReal = false;
let stub: Server | null = null;

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(encKey.trim(), "base64"), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

/** Escolhe o arquivo pelo clipe, como a pessoa faz (repete até a tela terminar de carregar). */
async function attach(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, shown: () => Promise<void>) {
  await expect(async () => {
    const chooser = page.waitForEvent("filechooser", { timeout: 2000 });
    await page.getByRole("button", { name: "Anexar foto, vídeo ou documento" }).click();
    await (await chooser).setFiles(file);
    await shown();
  }).toPass({ timeout: 20_000 });
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
  const email = `${key.toLowerCase()}.mid.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  orgId = org!.id;
  const { count } = await admin.from("whatsapp_connections").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  skipReal = Boolean(count);
  if (skipReal) return;
  await makeUser("Ana", "comercial");
  await makeUser("Edi", "editor_video");

  let n = 0;
  stub = createServer((req, res) => {
    const send = (code: number, body: unknown, type = "application/json") => {
      res.writeHead(code, { "content-type": type });
      res.end(type === "application/json" ? JSON.stringify(body) : (body as Buffer));
    };
    if (req.headers["x-api-key"] !== stubKey) return send(401, { error: "chave" });
    const u = new URL(req.url ?? "/", "http://stub");
    if (u.pathname === "/api/sessions/extend") return send(200, { status: "WORKING", me: { id: "554899990000@c.us" } });
    if (u.pathname === `/api/files/extend/foto${stamp}.png`) return send(200, PNG, "image/png");
    if (req.method === "POST" && ["/api/sendFile", "/api/sendImage", "/api/sendVoice", "/api/sendVideo"].includes(u.pathname)) {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", async () => {
        const body = JSON.parse(raw) as { chatId: string; file: { url: string; mimetype: string; filename: string }; caption?: string };
        // Como o WAHA: baixa o arquivo pelo link recebido.
        const file = await fetch(body.file.url);
        sent.push({ path: u.pathname, downloaded: file.status, bytes: (await file.arrayBuffer()).byteLength, mimetype: body.file.mimetype, filename: body.file.filename, caption: body.caption ?? null });
        send(201, { id: { _serialized: `true_${body.chatId}_S${stamp}${++n}` } });
      });
      return;
    }
    send(404, { error: "não existe" });
  });
  await new Promise<void>((ok) => stub!.listen(0, "127.0.0.1", ok));
  const stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
  const { data: c, error } = await admin.from("whatsapp_connections").insert({
    organization_id: orgId, base_url: stubUrl, api_key_enc: encrypt(stubKey), session: "extend", webhook_secret_enc: encrypt(hookSecret), status: "WORKING", me_id: "554899990000@c.us",
  }).select("id").single();
  if (error) throw error;
  connId = c.id;
  const { data: conv, error: ce } = await admin.from("wa_conversations").insert({ organization_id: orgId, connection_id: connId, chat_id: `${phone}@c.us`, phone, contact_name: contact, assignee_id: people.Ana.id }).select("id").single();
  if (ce) throw ce;
  convId = conv.id;
});

test.afterAll(async () => {
  if (!configured || skipReal) return;
  const { data: files } = await admin.from("whatsapp_messages").select("media_path").eq("connection_id", connId).not("media_path", "is", null);
  const paths = (files ?? []).map((f) => f.media_path as string);
  if (paths.length) await admin.storage.from("whatsapp-midia").remove(paths);
  if (connId) await admin.from("whatsapp_connections").delete().eq("id", connId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
  stub?.close();
});

test("1. foto recebida aparece na conversa; quem não atende não abre o arquivo", async ({ page, request }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado: o teste não mexe nele.");
  const msg = JSON.stringify({
    event: "message.any", session: "extend",
    payload: { id: `false_${phone}@c.us_F${stamp}`, from: `${phone}@c.us`, fromMe: false, hasMedia: true, body: "", timestamp: Math.floor(Date.now() / 1000),
      media: { url: `http://localhost:3000/api/files/extend/foto${stamp}.png`, mimetype: "image/png", filename: null }, _data: { notifyName: contact } },
  });
  const res = await request.post(`/api/whatsapp/webhook/${connId}`, { data: msg, headers: { "content-type": "application/json", "x-webhook-hmac": createHmac("sha512", hookSecret).update(msg).digest("hex") } });
  expect(res.status()).toBe(200);
  const { data: saved } = await admin.from("whatsapp_messages").select("id, media_path, media_mime").eq("connection_id", connId).eq("wamid", `F${stamp}`).single();
  expect(saved!.media_mime).toBe("image/png");
  expect(saved!.media_path).toContain(orgId);

  await login(page, "Ana");
  await page.goto("/atendimento");
  await expect(page.getByRole("list", { name: "Conversas" }).getByRole("link").filter({ hasText: contact })).toContainText("[foto]");
  await page.goto(`/atendimento?conversa=${convId}`);
  const img = page.getByRole("list", { name: "Mensagens" }).getByRole("img", { name: "Foto enviada na conversa" });
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1);

  await login(page, "Edi");
  const blocked = await page.request.get(`/api/whatsapp/midia/${saved!.id}`);
  expect(blocked.status()).toBe(403);
});

test("2. anexa um PDF com legenda e envia", async ({ page }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado.");
  await login(page, "Ana");
  await page.goto(`/atendimento?conversa=${convId}`);
  await attach(page, { name: "proposta-extend.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% teste\n%%EOF\n") },
    () => expect(page.getByText("proposta-extend.pdf")).toBeVisible({ timeout: 1000 }));
  await page.getByLabel("Legenda do arquivo").fill("Segue a proposta 😊");
  await page.getByRole("button", { name: "Enviar arquivo" }).click();
  const doc = page.getByRole("list", { name: "Mensagens" }).getByRole("link", { name: /proposta-extend\.pdf/ });
  await expect(doc).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("list", { name: "Mensagens" })).toContainText("Segue a proposta 😊");
  expect(sent.find((s) => s.path === "/api/sendFile")).toMatchObject({ downloaded: 200, bytes: 23, mimetype: "application/pdf", filename: "proposta-extend.pdf", caption: "Segue a proposta 😊" });
  // Tipo não aceito: avisa e não envia.
  await attach(page, { name: "programa.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") },
    () => expect(page.getByRole("alert").filter({ hasText: "Este tipo de arquivo não pode ser enviado pelo WhatsApp." })).toBeVisible({ timeout: 1000 }));
});

test("3. grava um áudio e envia como mensagem de voz", async ({ page }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado.");
  await login(page, "Ana");
  await page.goto(`/atendimento?conversa=${convId}`);
  await page.getByRole("button", { name: "Gravar áudio" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Gravando" })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Parar e enviar áudio" }).click();
  await expect(page.getByRole("list", { name: "Mensagens" }).getByLabel("Áudio da conversa")).toBeVisible({ timeout: 20_000 });
  const voice = sent.find((s) => s.path === "/api/sendVoice");
  expect(voice?.downloaded).toBe(200);
  expect(voice!.bytes).toBeGreaterThan(100);
  expect(voice!.mimetype).toMatch(/^audio\//);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
