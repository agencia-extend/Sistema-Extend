import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Cronogramas do mês (RF-CON-01, visão do setor de gerenciamento): a social media vê os clientes dela com os
 * posts contratados × programados × postados, abre o cronograma do cliente, programa o que falta e o mês fica
 * completo. A gestora de tráfego não abre a página. Regras no banco: 29_cronogramas_do_mes.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Clínica Cronograma ${stamp}`;
const month = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7); // mês em São Paulo
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.crm.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Sol", "social_media");
  await makeUser("Ana", "gestor_trafego");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "gerenciamento").single();
  await admin.from("client_services").insert({ client_id: clientId, service_id: svc!.id, monthly_qty: 3 });
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "gerenciamento").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Sol.id });
  // Só os posts deste roteiro: um postado, um programado e um marcado para o cronograma sem data.
  await admin.from("tasks").delete().eq("client_id", clientId);
  const posts = [
    { title: "Dica de clareamento", post_on: `${month}-10`, post_url: "https://instagram.com/p/teste", destination: [] as string[] },
    { title: "Bastidores da clínica", post_on: `${month}-12`, post_url: null, destination: [] },
    { title: "Depoimento de paciente", post_on: null, post_url: null, destination: ["cronograma"] },
  ];
  for (const p of posts) {
    const { data: t, error: te } = await admin.from("tasks").insert({ organization_id: org!.id, client_id: clientId, type: "conteudo", title: p.title }).select("id").single();
    if (te) throw te;
    await admin.from("task_content").upsert({ task_id: t.id, post_on: p.post_on, post_url: p.post_url, destination: p.destination });
  }
});

test("1. social media vê o que falta, programa o post e o mês fica completo", async ({ page }) => {
  await login(page, "Sol");
  await page.goto(`/cronogramas?mes=${month}`);
  await expect(page.getByRole("link", { name: "Meus clientes" })).toHaveAttribute("aria-current", "page");
  const row = page.getByRole("row", { name: new RegExp(clientName) });
  await expect(row).toContainText("Falta 1 post");
  await expect(row).toContainText(`Sol ${stamp}`);
  expect(await noOverflow(page)).toBe(true);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}-cronogramas-${test.info().project.name}.png`, fullPage: true });

  await row.getByRole("link", { name: new RegExp(clientName) }).click();
  await page.waitForURL(`**/clientes/${clientId}/cronograma?mes=${month}`);
  await page.getByRole("button", { name: "Programar Depoimento de paciente" }).click();
  const d = page.getByRole("dialog", { name: "Programar post" });
  await d.getByLabel("Data do post").fill(`${month}-20`);
  await d.getByRole("button", { name: "Salvar post" }).click();
  await expect(page.getByText("Post programado.")).toBeVisible();

  await page.goto(`/cronogramas?mes=${month}`);
  await expect(page.getByRole("row", { name: new RegExp(clientName) })).toContainText("Completo");
});

test("2. gestora de tráfego não abre os cronogramas", async ({ page }) => {
  await login(page, "Ana");
  await page.goto("/cronogramas");
  await expect(page).toHaveURL(/sem-acesso/);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    await admin.from("tasks").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
