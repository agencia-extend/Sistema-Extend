import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Presença "quem está online" (docs/10): duas pessoas da equipe com o sistema aberto se veem no topo;
 * quem fecha some da lista. Regras no banco: 30_presenca_online.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const people: Record<string, { id: string; email: string; name: string }> = {};

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.pres.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

async function open(browser: Browser, who: string): Promise<Page> {
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor } = test.info().project.use;
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
  return page;
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Lia", "social_media");
  await makeUser("Teo", "editor_video");
});

test.afterAll(async () => {
  if (!configured) return;
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("quem está com o sistema aberto aparece para a equipe e some ao sair", async ({ browser }) => {
  const lia = await open(browser, "Lia");
  const teo = await open(browser, "Teo");

  const button = lia.getByRole("button", { name: /^Equipe online:/ });
  await expect(button).toBeVisible({ timeout: 20_000 });
  await button.click();
  const list = lia.getByRole("list", { name: "Pessoas online" });
  await expect(list.getByText(`${people.Lia.name} (você)`)).toBeVisible();
  await expect(list.getByText(people.Teo.name, { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(list.getByText(/Editor de vídeo · desde \d{2}:\d{2}/)).toBeVisible();
  expect(await lia.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await teo.context().close();
  await expect(list.getByText(people.Teo.name, { exact: true })).toBeHidden({ timeout: 30_000 });
  await lia.context().close();
});
