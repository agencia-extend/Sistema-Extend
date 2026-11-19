import { createCipheriv, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Programar publicações (RF-CON-03): a social media do cliente programa um Feed no Facebook e no Instagram (com o envio
 * da imagem para o armazenamento), vê a validação do formato, a fila do servidor roda e a Meta recusa de verdade (a
 * conexão de teste tem as permissões de publicar e um token inválido): a publicação fica "Não publicou" com o motivo,
 * quem programou recebe o aviso, e ela reagenda e cancela. Nenhum perfil real é usado.
 * Regras no banco: 41_publicacoes.test.sql. Publicar de verdade depende das permissões na conexão real da Meta.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const encKey = process.env.TOKEN_ENCRYPTION_KEY ?? "";
const jobsToken = process.env.JOBS_TOKEN ?? "";
const configured = Boolean(url && secret && encKey && jobsToken);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento, TOKEN_ENCRYPTION_KEY e JOBS_TOKEN.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Confeitaria Posts ${stamp}`;
const handle = `confeitaria_${stamp}`;
const caption = `Bolo de pote do dia ${stamp} #doces`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";
let connId = "";
// PNG de 1×1 px.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

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
  const email = `${key.toLowerCase()}.pub.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Sol", "social_media");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "conteudo").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Sol.id });
  const { data: conn, error: ce } = await admin.from("integration_connections").insert({
    organization_id: org!.id, provider: "meta", purpose: "ads", owner_kind: "user", profile_id: people.Sol.id, connected_by: people.Sol.id,
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish"],
    token_enc: encrypt(`token-invalido-${stamp}`), account_name: `Sol ${stamp}`,
  }).select("id").single();
  if (ce) throw ce;
  connId = conn.id;
  const { error: pe } = await admin.from("social_profiles").insert([
    { organization_id: org!.id, connection_id: connId, platform: "facebook", external_id: `pg${stamp}`, name: clientName, client_id: clientId },
    { organization_id: org!.id, connection_id: connId, platform: "instagram", external_id: `ig${stamp}`, page_external_id: `pg${stamp}`, name: clientName, username: handle, client_id: clientId },
  ]);
  if (pe) throw pe;
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    const { data: files } = await admin.storage.from("publicacoes").list(`clientes/${clientId}/publicacoes`);
    if (files?.length) await admin.storage.from("publicacoes").remove(files.map((f) => `clientes/${clientId}/publicacoes/${f.name}`));
    await admin.from("social_profiles").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  if (connId) await admin.from("integration_connections").delete().eq("id", connId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. programar um Feed no Facebook e no Instagram, com validação do formato", async ({ page }) => {
  await login(page, "Sol");
  await page.goto(`/clientes/${clientId}/redes`);
  const sec = page.getByRole("region", { name: "Programação" });
  await expect(sec).toContainText("Nada programado para sair.");
  await sec.getByRole("button", { name: "Programar publicação" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox", { name: `Instagram · @${handle}` })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: `Facebook · ${clientName}` })).toBeChecked();

  // Reels sem vídeo: validação antes de enviar.
  await dialog.getByText("Reels", { exact: true }).click();
  await dialog.getByRole("button", { name: "Programar" }).click();
  await expect(dialog.getByText("Reels e Vídeo levam um vídeo, sem imagens.")).toBeVisible();

  await dialog.getByText("Feed", { exact: true }).click();
  await dialog.getByLabel(/^Imagens/).setInputFiles({ name: "bolo.png", mimeType: "image/png", buffer: png });
  await expect(dialog.getByRole("list", { name: "Arquivos escolhidos" })).toContainText("bolo.png");
  await dialog.getByLabel("Legenda").fill(caption);
  await dialog.getByRole("button", { name: "Programar" }).click();
  await expect(page.getByText("Publicação programada em 2 perfis.")).toBeVisible({ timeout: 20_000 });
  await expect(sec.getByRole("list", { name: "Publicações programadas" }).getByRole("listitem")).toHaveCount(2);
  await expect(sec).toContainText("Agendado");
  const { data } = await admin.from("post_schedules").select("images, caption").eq("client_id", clientId);
  expect(data!.every((r) => r.images.length === 1 && r.images[0].startsWith(`clientes/${clientId}/publicacoes/`) && r.caption === caption)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("2. a fila roda, a Meta recusa e o motivo aparece; reagendar e cancelar", async ({ page, request }) => {
  await admin.from("post_schedules").update({ scheduled_at: new Date(Date.now() - 60_000).toISOString() }).eq("client_id", clientId);
  const res = await request.post("/api/jobs/publish-posts", { headers: { Authorization: `Bearer ${jobsToken}` } });
  expect(res.ok()).toBe(true);
  await expect.poll(async () => (await admin.from("post_schedules").select("status").eq("client_id", clientId)).data!.map((r) => r.status).sort().join(","), { timeout: 30_000 }).toBe("erro,erro");

  await login(page, "Sol");
  await page.goto(`/clientes/${clientId}/redes`);
  const sec = page.getByRole("region", { name: "Programação" });
  await sec.getByText(/Publicadas, com erro e canceladas/).click();
  const list = sec.getByRole("list", { name: "Publicações programadas" });
  await expect(list.getByText("Não publicou")).toHaveCount(2);
  await expect(list.getByText("O acesso à Meta expirou. Reconecte em Configurações › Integrações e reagende.").first()).toBeVisible();
  const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Sol.id).eq("kind", "post");
  expect(count).toBe(2);

  // Reagenda uma para amanhã: volta para "Agendado".
  await list.getByRole("button", { name: /^Reagendar a publicação/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Reagendar" }).click();
  await expect(page.getByText("Publicação reagendada.")).toBeVisible();
  await expect(sec.getByRole("list", { name: "Publicações programadas" }).first().getByText("Agendado")).toBeVisible();

  // Cancela a outra.
  await sec.getByRole("button", { name: "Cancelar" }).last().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar publicação" }).click();
  await expect(page.getByText("Publicação cancelada.")).toBeVisible();
  await expect.poll(async () => (await admin.from("post_schedules").select("status").eq("client_id", clientId)).data!.map((r) => r.status).sort().join(",")).toBe("agendado,cancelado");
});

test("3. estúdio: perfil, botões por formato e a programada no planejador do mês", async ({ page }) => {
  await login(page, "Sol");
  await page.goto("/publicacoes");
  await expect(page.getByRole("heading", { name: "Estúdio de publicações", level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "Perfis" }).getByRole("link", { name: new RegExp(`@${handle}`) }).click();
  await page.waitForURL(/perfil=/);
  await expect(page.getByRole("heading", { name: `@${handle}`, level: 2 })).toBeVisible();

  // Reels abre a programação já com o Instagram escolhido (e só ele).
  const create = page.getByRole("group", { name: "Programar" });
  await expect(create.getByRole("button", { name: "Post" })).toBeVisible();
  await create.getByRole("button", { name: "Reels" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox", { name: `Instagram · @${handle}` })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: `Facebook · ${clientName}` })).not.toBeChecked();
  await page.keyboard.press("Escape");

  // A programada aparece no planejador do mês dela; tocar no dia mostra a publicação.
  const { data: row } = await admin.from("post_schedules").select("scheduled_at, profile_id").eq("client_id", clientId).eq("status", "agendado").limit(1).single();
  const day = new Date(new Date(row!.scheduled_at).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  await page.goto(`/publicacoes?${new URLSearchParams({ perfil: row!.profile_id, mes: day.slice(0, 7) })}`);
  const month = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(day.slice(5, 7)) - 1];
  await page.getByRole("link", { name: new RegExp(`^${Number(day.slice(8))} de ${month}: 1 publicação`) }).or(page.getByRole("list", { name: /Dias com publicação/ }).getByRole("link")).first().click();
  await page.waitForURL(new RegExp(`dia=${day}`));
  await expect(page.getByRole("list", { name: "Publicações programadas" }).first()).toContainText("Agendado");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
