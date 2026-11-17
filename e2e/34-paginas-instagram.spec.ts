import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Páginas e Instagram dos clientes (RF-CON-02): a gerente de tráfego liga a página e o Instagram ao cliente em
 * Configurações › Integrações; a social media do cliente vê a aba Redes sociais com seguidores e as últimas
 * publicações, e o motivo quando o Instagram não traz as publicações. Os perfis entram como a sincronização grava
 * (a leitura real da Meta foi conferida com a conta da Extend); as regras estão em 39_paginas_instagram.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Hamburgueria Redes ${stamp}`;
const handle = `burger_${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";
const profileIds: string[] = [];

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.red.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Gal", "gerente_trafego");
  await makeUser("Sol", "social_media");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 0 });
  // A gerente vê os clientes do setor de tráfego: o cliente tem alguém do tráfego (ela) e a social media no conteúdo.
  const { data: sectors } = await admin.from("sectors").select("id, key").in("key", ["conteudo", "trafego"]);
  const sid = (k: string) => sectors!.find((x) => x.key === k)!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sid("conteudo"), profile_id: people.Sol.id },
    { client_id: clientId, sector_id: sid("trafego"), profile_id: people.Gal.id },
  ]);
  const { data: profiles, error: pe } = await admin.from("social_profiles").insert([
    { organization_id: org!.id, platform: "facebook", external_id: `pg${stamp}`, name: clientName, followers: 830 },
    { organization_id: org!.id, platform: "instagram", external_id: `ig${stamp}`, page_external_id: `pg${stamp}`, name: clientName, username: handle, followers: 4516, media_count: 172 },
  ]).select("id, platform");
  if (pe) throw pe;
  profileIds.push(...profiles!.map((p) => p.id));
  const fb = profiles!.find((p) => p.platform === "facebook")!.id;
  const ig = profiles!.find((p) => p.platform === "instagram")!.id;
  await admin.from("social_posts").insert([
    { profile_id: fb, external_id: `p1${stamp}`, caption: "Promoção de terça: combo em dobro", published_at: new Date(Date.now() - 86_400_000).toISOString(), shares: 3, permalink: "https://www.facebook.com/" },
  ]);
  await admin.from("social_profiles").update({ posts_synced_at: new Date().toISOString() }).eq("id", fb);
  await admin.from("social_profiles").update({ sync_error: "A conexão da Meta não tem a permissão do Instagram (instagram_basic). Inclua a permissão na configuração do login do app da Meta e reconecte em Configurações › Integrações." }).eq("id", ig);
});

test.afterAll(async () => {
  if (!configured) return;
  if (profileIds.length) await admin.from("social_profiles").delete().in("id", profileIds);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("1. gerente liga a página e o Instagram ao cliente", async ({ page }) => {
  await login(page, "Gal");
  await page.goto("/configuracoes/integracoes");
  const list = page.getByRole("list", { name: "Páginas e perfis" });
  await expect(list.getByRole("listitem").filter({ hasText: `@${handle}` })).toContainText("4.516");
  for (const [label, kind] of [[`@${handle}`, "Instagram"], [clientName, "Página do Facebook"]] as const) {
    const box = page.getByRole("combobox", { name: `Cliente de ${label} (${kind})` });
    await box.click();
    await page.getByRole("option", { name: clientName }).click();
    await expect(box).toContainText(clientName);
    await expect(page.getByText("Ligado ao cliente. As publicações chegam na próxima atualização.").first()).toBeVisible();
  }
  await expect
    .poll(async () => (await admin.from("social_profiles").select("client_id").in("id", profileIds)).data!.filter((r) => r.client_id === clientId).length)
    .toBe(2);
});

test("2. social media vê a aba Redes sociais com as publicações e o motivo do Instagram", async ({ page }) => {
  await login(page, "Sol");
  await page.goto(`/clientes/${clientId}`);
  await page.getByRole("navigation", { name: "Seções do cliente" }).getByRole("link", { name: "Redes sociais" }).click();
  await page.waitForURL(`**/clientes/${clientId}/redes`);
  const ig = page.getByRole("region", { name: `@${handle}` });
  await expect(ig).toContainText("4.516 seguidores · 172 publicações");
  await expect(ig.getByRole("alert")).toContainText("não tem a permissão do Instagram");
  const fb = page.getByRole("region", { name: clientName });
  await expect(fb).toContainText("830 seguidores");
  const posts = fb.getByRole("list", { name: `Últimas publicações de ${clientName}` });
  await expect(posts).toContainText("Promoção de terça: combo em dobro");
  await expect(posts).toContainText("3 compartilhamentos");
  await expect(page.getByRole("button", { name: "Atualizar agora" })).toBeVisible();
  // Os links entraram em "Contas e acessos" (links rápidos do cliente).
  await expect(page.getByRole("navigation", { name: "Links do cliente" }).getByRole("link", { name: /Instagram/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
