import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Prontos para programar (RF-CON-04): o conteúdo aprovado pelo cliente aparece no Estúdio de publicações com a legenda
 * e a data; "Programar" abre a programação do cliente com o conteúdo; quando o post sai (link do post), deixa a lista;
 * a social media de fora do cliente não vê.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const title = `Arte aprovada ${stamp}`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";
let taskId = "";

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.ppg.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Sol", "social_media");
  await makeUser("Rui", "social_media");
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: `Cliente Prontos ${stamp}`, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "gerenciamento").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Sol.id });
  const { data: step } = await admin.from("workflow_steps").select("id, workflows!inner(task_type)").eq("name", "Programado").eq("workflows.task_type", "design").single();
  const { data: t, error: e2 } = await admin
    .from("tasks")
    .insert({ organization_id: org!.id, client_id: clientId, type: "design", title, workflow_step_id: step!.id })
    .select("id, status")
    .single();
  if (e2) throw e2;
  taskId = t.id;
  await admin.from("task_content").upsert({ task_id: taskId, format: "estatico", caption: `Legenda da arte ${stamp}`, post_on: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10) });
});

test.afterAll(async () => {
  if (!configured) return;
  if (taskId) await admin.from("tasks").delete().eq("id", taskId);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("conteúdo aprovado aparece pronto para programar e sai quando é postado", async ({ page }) => {
  await login(page, "Sol");
  await page.goto("/publicacoes");
  const list = page.getByRole("list", { name: "Conteúdos prontos para programar" });
  const item = list.getByRole("listitem").filter({ hasText: title });
  await expect(item).toContainText(`Legenda da arte ${stamp}`);
  await expect(item).toContainText("Estático");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await item.getByRole("link", { name: `Programar ${title}` }).click();
  await expect(page).toHaveURL(new RegExp(`/clientes/${clientId}/redes\\?programar=${taskId}`));

  // Saiu o post (link registrado no conteúdo): deixa a lista.
  await admin.from("task_content").update({ post_url: "https://www.instagram.com/p/teste" }).eq("task_id", taskId);
  await page.goto("/publicacoes");
  await expect(page.getByText(title)).toHaveCount(0);
  await admin.from("task_content").update({ post_url: null }).eq("task_id", taskId);
});

test("social media de fora do cliente não vê o conteúdo", async ({ page }) => {
  await login(page, "Rui");
  await page.goto("/publicacoes");
  await expect(page.getByText(title)).toHaveCount(0);
});
