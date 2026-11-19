import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Atendimento como no HubSystem (RF-WPP-03/06/07):
 * 1. quem administra cria etiqueta e resposta rápida e ajusta o radar em Atendimento › Ajustes;
 * 2. chega pelo webhook a mensagem de um anúncio Clique-para-WhatsApp (vira lead com origem anúncio) e a de um
 *    contato com id oculto (@lid, o telefone vem do servidor e liga o lead que já existe); quem atende vê o radar,
 *    busca, abre a conversa (lista e conversa juntas), vê o anúncio, põe etiqueta, responde com "/atalho" e vê ✓✓ azul
 *    quando o WhatsApp confirma a leitura; filtra pela etiqueta;
 * 3. quem administra apaga e restaura; o endereço antigo da conversa abre a tela nova; no celular, voltar mostra a lista.
 * Servidor de teste no formato do WAHA (só local, sem WhatsApp real conectado). Regras no banco: 47_atendimento_completo.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const encKey = process.env.TOKEN_ENCRYPTION_KEY ?? "";
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const configured = Boolean(url && secret && encKey && /localhost|127\.0\.0\.1/.test(base));

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Só local, com as variáveis do Supabase de desenvolvimento e TOKEN_ENCRYPTION_KEY.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const phone = `5511${stamp.slice(-9)}`;
const lidPhone = `5548${stamp.slice(-9)}`;
const lid = `9${stamp.slice(-11)}@lid`;
const contact = `Bruna ${stamp}`;
const tagName = `Orçamento ${stamp.slice(-5)}`;
const shortcut = `preco${stamp.slice(-5)}`;
const hookSecret = randomBytes(24).toString("hex");
const stubKey = randomBytes(24).toString("hex");
const session = `e2e${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
const sent: { chatId: string; text: string }[] = [];
let orgId = "";
let connId = "";
let convId = "";
let skipReal = false;
let radarBefore: number | null = null;
let stub: Server | null = null;

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
  const email = `${key.toLowerCase()}.atc.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

/** Detalhes da conversa: ao lado no computador largo, numa gaveta no celular. */
async function details(page: Page) {
  const open = page.getByRole("button", { name: "Detalhes da conversa" });
  if (await open.isVisible()) {
    await open.click();
    return page.getByRole("dialog");
  }
  return page.getByRole("complementary", { name: "Detalhes da conversa" });
}

async function webhook(page: Page, body: unknown) {
  const raw = JSON.stringify(body);
  const res = await page.request.post(`/api/whatsapp/webhook/${connId}`, { data: raw, headers: { "content-type": "application/json", "x-webhook-hmac": createHmac("sha512", hookSecret).update(raw).digest("hex") } });
  expect(res.status()).toBe(200);
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  orgId = org!.id;
  const { count } = await admin.from("whatsapp_connections").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  skipReal = Boolean(count);
  if (skipReal) return;
  await makeUser("Co", "comercial");
  await makeUser("At", "atendimento");
  const { data: settings } = await admin.from("wa_settings").select("radar_minutes").eq("organization_id", orgId).maybeSingle();
  radarBefore = settings?.radar_minutes ?? null;

  stub = createServer((req, res) => {
    const reply = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    if (req.headers["x-api-key"] !== stubKey) return reply(401, { error: "chave" });
    const path = req.url ?? "";
    if (path === `/api/sessions/${session}`) return reply(200, { status: "WORKING", me: { id: "554899990000@c.us" } });
    if (path.startsWith("/api/contacts/profile-picture")) return reply(200, { profilePictureURL: null });
    if (path.startsWith(`/api/${session}/lids/`)) return reply(200, { lid, pn: `${lidPhone}@s.whatsapp.net` });
    if (req.method === "POST" && path === "/api/sendText") {
      let raw = "";
      req.on("data", (x) => (raw += x));
      req.on("end", () => {
        const b = JSON.parse(raw) as { chatId: string; text: string };
        sent.push({ chatId: b.chatId, text: b.text });
        reply(201, { id: { _serialized: `true_${b.chatId}_3EB0${stamp}${sent.length}` } });
      });
      return;
    }
    reply(404, { error: "não existe" });
  });
  await new Promise<void>((ok) => stub!.listen(0, "127.0.0.1", ok));
  const { data: c, error } = await admin.from("whatsapp_connections").insert({
    organization_id: orgId, base_url: `http://127.0.0.1:${(stub.address() as AddressInfo).port}`, api_key_enc: encrypt(stubKey), session,
    webhook_secret_enc: encrypt(hookSecret), status: "WORKING", me_id: "554899990000@c.us", me_name: "Extend Teste",
  }).select("id").single();
  if (error) throw error;
  connId = c.id;
  // As conversas já são da At (o aviso de conversa nova vai só para ela, não para a equipe real).
  const { data: conv, error: ce } = await admin.from("wa_conversations").insert([
    { organization_id: orgId, connection_id: connId, chat_id: `${phone}@c.us`, phone, assignee_id: people.At.id },
    { organization_id: orgId, connection_id: connId, chat_id: lid, assignee_id: people.At.id },
  ]).select("id, chat_id");
  if (ce) throw ce;
  convId = conv!.find((x) => x.chat_id === `${phone}@c.us`)!.id;
  // Lead que já existe com o telefone do contato de id oculto.
  const { data: pipe } = await admin.from("pipelines").select("id, pipeline_stages(id, position)").eq("organization_id", orgId).order("is_default", { ascending: false }).limit(1).single();
  const stage = (pipe!.pipeline_stages as { id: string; position: number }[]).sort((a, b) => a.position - b.position)[0];
  await admin.from("leads").insert({ organization_id: orgId, pipeline_id: pipe!.id, stage_id: stage.id, name: `Lead Oculto ${stamp}`, phone: lidPhone, source: "whatsapp" });
});

test.afterAll(async () => {
  if (!configured || skipReal) return;
  await admin.from("leads").delete().in("phone", [phone, lidPhone]);
  if (connId) await admin.from("whatsapp_connections").delete().eq("id", connId);
  stub?.close();
  await admin.from("wa_tags").delete().eq("organization_id", orgId).eq("name", tagName);
  await admin.from("wa_quick_replies").delete().eq("organization_id", orgId).eq("shortcut", shortcut);
  if (radarBefore === null) await admin.from("wa_settings").delete().eq("organization_id", orgId);
  else await admin.from("wa_settings").update({ radar_minutes: radarBefore }).eq("organization_id", orgId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. quem administra cria etiqueta, resposta rápida e ajusta o radar", async ({ page }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado: o teste não mexe nele.");
  await login(page, "Co");
  await page.goto("/atendimento");
  await page.getByRole("link", { name: "Ajustes do atendimento" }).click();
  await expect(page.getByRole("heading", { name: "Ajustes do atendimento", level: 1 })).toBeVisible();

  await page.getByLabel("Entra no radar depois de (minutos)").fill("2");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("No mínimo 5 minutos.")).toBeVisible();
  await page.getByLabel("Entra no radar depois de (minutos)").fill("5");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Radar salvo.")).toBeVisible();

  await page.getByRole("button", { name: "Nova resposta rápida" }).click();
  let dialog = page.getByRole("dialog", { name: "Nova resposta rápida" });
  await dialog.getByLabel("Atalho").fill("preço x");
  await dialog.getByLabel("Texto").fill("Oi {nome}! Os planos começam em R$ 1.500 por mês.");
  await dialog.getByRole("button", { name: "Criar resposta" }).click();
  await expect(dialog.getByText(/Atalho de 1 a 30 letras/)).toBeVisible();
  await dialog.getByLabel("Atalho").fill(`/${shortcut}`);
  await dialog.getByRole("button", { name: "Criar resposta" }).click();
  await expect(page.getByText("Resposta rápida criada.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Respostas rápidas" })).toContainText(`/${shortcut}`);

  await page.getByRole("button", { name: "Nova etiqueta" }).click();
  dialog = page.getByRole("dialog", { name: "Nova etiqueta" });
  await dialog.getByLabel("Nome").fill(tagName);
  await dialog.getByRole("button", { name: "Verde" }).click();
  await dialog.getByRole("button", { name: "Criar etiqueta" }).click();
  await expect(page.getByText("Etiqueta criada.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Etiquetas" })).toContainText(tagName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("2. anúncio vira lead; radar, busca, etiqueta, resposta rápida e leitura confirmada", async ({ page }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado: o teste não mexe nele.");
  const tenMinAgo = Math.floor(Date.now() / 1000) - 600;
  await webhook(page, {
    event: "message.any", session, payload: {
      id: `false_${phone}@c.us_3EA0${stamp}`, from: `${phone}@c.us`, fromMe: false, body: "Vi o anúncio, quero saber mais", timestamp: tenMinAgo,
      _data: { notifyName: contact, message: { extendedTextMessage: { text: "Vi o anúncio", contextInfo: { externalAdReply: { sourceId: `9${stamp}`, title: "Tráfego que traz cliente", sourceUrl: "https://fb.me/extend-teste", ctwaClid: "clid" } } } } },
    },
  });
  await webhook(page, { event: "message.any", session, payload: { id: `false_${lid}_3EA1${stamp}`, from: lid, fromMe: false, body: "Oi, sou eu de novo", timestamp: Math.floor(Date.now() / 1000), _data: { notifyName: "Oculto" } } });
  await expect.poll(async () => (await admin.from("leads").select("source, utm_medium").eq("phone", phone).maybeSingle()).data).toEqual({ source: "anuncio", utm_medium: "clique_whatsapp" });
  const { data: hidden } = await admin.from("wa_conversations").select("phone, lead_id").eq("chat_id", lid).single();
  expect(hidden!.phone).toBe(lidPhone);
  expect(hidden!.lead_id).not.toBeNull();

  await login(page, "At");
  await page.goto("/atendimento?aba=radar");
  const list = page.getByRole("list", { name: "Conversas" });
  const item = list.getByRole("link").filter({ hasText: contact });
  await expect(item).toContainText("Espera há 10 min");
  await expect(item).toContainText("Anúncio");
  await page.getByRole("link", { name: /^Abertas/ }).click();
  await page.waitForURL((u) => u.pathname === "/atendimento" && !u.searchParams.has("aba"));
  await page.getByLabel("Buscar conversas").fill(contact);
  await page.waitForURL((u) => u.searchParams.get("q") === contact);
  await expect(list.getByRole("link")).toHaveCount(1);
  await expect(item).toBeVisible();

  // Trocar de conversa não pode piscar a tela inteira com o esqueleto de carregamento.
  await page.evaluate(() => {
    const w = window as unknown as { __flash?: boolean };
    w.__flash = false;
    new MutationObserver(() => { if (document.querySelector("[aria-label=\"Carregando…\"]")) w.__flash = true; }).observe(document.body, { childList: true, subtree: true });
  });
  await item.click();
  await page.waitForURL(`**conversa=${convId}*`);
  await expect(page.getByRole("heading", { name: contact, level: 2 })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __flash?: boolean }).__flash)).toBe(false);
  const panel = await details(page);
  await expect(panel).toContainText("Veio de anúncio");
  await expect(panel).toContainText("Tráfego que traz cliente");
  await panel.getByRole("button", { name: tagName }).click();
  await expect.poll(async () => (await admin.from("wa_conversation_tags").select("tag_id").eq("conversation_id", convId)).data?.length).toBe(1);
  await page.keyboard.press("Escape");

  const box = page.getByLabel("Mensagem");
  await box.fill(`/${shortcut.slice(0, 6)}`);
  const option = page.getByRole("option", { name: new RegExp(`/${shortcut}`) });
  await expect(option).toBeVisible();
  await box.press("Enter");
  await expect(box).toHaveValue("Oi Bruna! Os planos começam em R$ 1.500 por mês.");
  await box.press("Enter");
  await expect(page.getByRole("list", { name: "Mensagens" })).toContainText("Oi Bruna! Os planos começam em R$ 1.500 por mês.");
  expect(sent.at(-1)).toEqual({ chatId: `${phone}@c.us`, text: "Oi Bruna! Os planos começam em R$ 1.500 por mês." });
  await expect(page.getByRole("list", { name: "Mensagens" }).getByLabel("Enviada")).toBeVisible();

  // O WhatsApp confirma a leitura (✓✓ azul) com o id composto; a tela atualiza sozinha.
  await webhook(page, { event: "message.ack", session, payload: { id: `true_${phone}@c.us_3EB0${stamp}${sent.length}`, ack: 3 } });
  await expect(page.getByRole("list", { name: "Mensagens" }).getByLabel("Lida")).toBeVisible({ timeout: 15_000 });

  await page.goto("/atendimento");
  await page.getByLabel("Filtrar por etiqueta").click();
  await page.getByRole("option", { name: tagName }).click();
  await expect(list.getByRole("link")).toHaveCount(1);
  await expect(item).toContainText(tagName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("3. apagar e restaurar; endereço antigo; voltar no celular", async ({ page, isMobile }) => {
  test.skip(skipReal, "Já existe um WhatsApp real conectado: o teste não mexe nele.");
  await login(page, "Co");
  await page.goto(`/atendimento/${convId}`);
  await page.waitForURL(`**/atendimento?conversa=${convId}`);
  const panel = await details(page);
  await panel.getByRole("button", { name: "Apagar conversa" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("Conversa apagada. Ela volta se o contato mandar mensagem.")).toBeVisible();
  await page.goto("/atendimento");
  await expect(page.getByRole("list", { name: "Conversas" }).getByRole("link").filter({ hasText: contact })).toHaveCount(0);
  await page.getByRole("link", { name: /^Apagadas/ }).click();
  const item = page.getByRole("list", { name: "Conversas" }).getByRole("link").filter({ hasText: contact });
  await item.click();
  await expect(page.getByText("Conversa apagada. Restaure para responder.")).toBeVisible();
  const again = await details(page);
  await again.getByRole("button", { name: "Restaurar conversa" }).click();
  await expect(page.getByText("Conversa restaurada.")).toBeVisible();
  await page.keyboard.press("Escape");

  if (isMobile) {
    await page.getByRole("link", { name: "Voltar para as conversas" }).click();
    await expect(page.getByRole("complementary", { name: "Lista de conversas" })).toBeVisible();
    await expect(page.getByText("Nenhuma conversa apagada.")).toBeVisible();
    await expect(page.getByRole("heading", { name: contact, level: 2 })).toHaveCount(0);
  }
  // Quem só atende não vê Ajustes nem a aba Apagadas.
  await login(page, "At");
  await page.goto("/atendimento?aba=apagadas");
  await expect(page.getByRole("link", { name: /^Apagadas/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ajustes do atendimento" })).toHaveCount(0);
  await page.goto("/atendimento/ajustes");
  await expect(page).toHaveURL(/\/sem-acesso/);
});
