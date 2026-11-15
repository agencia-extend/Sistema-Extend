import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Relatório semanal e retorno do cliente (briefing de mídias 3.9): a gestora registra o envio de tráfego pela
 * página "Relatórios da semana" e um retorno negativo (avisa o responsável pela comunicação); a social media
 * registra o de conteúdo pela aba do cliente com "sem retorno" (vira demanda de ligação); editor de vídeo não abre.
 * Regras no banco: 26_relatorios_retorno.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Loja Relatório ${stamp}`;
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
  const email = `${key.toLowerCase()}.rel.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Ana", "gestor_trafego");
  await makeUser("Sol", "social_media");
  await makeUser("Caio", "social_media");
  await makeUser("Vic", "editor_video");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo", owner_id: people.Caio.id }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  const { data: svcs } = await admin.from("service_catalog").select("id").in("key", ["meta_ads", "gerenciamento"]);
  await admin.from("client_services").insert(svcs!.map((s) => ({ client_id: clientId, service_id: s.id, monthly_qty: 0 })));
  const { data: sectors } = await admin.from("sectors").select("id, key").in("key", ["trafego", "gerenciamento"]);
  const sid = (k: string) => sectors!.find((s) => s.key === k)!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sid("trafego"), profile_id: people.Ana.id },
    { client_id: clientId, sector_id: sid("gerenciamento"), profile_id: people.Sol.id },
  ]);
});

test("1. gestora registra o envio de tráfego e um retorno negativo, que avisa o responsável", async ({ page }) => {
  await login(page, "Ana");
  await page.goto("/relatorios");
  const row = page.getByRole("row").filter({ hasText: clientName });
  await expect(row.getByText("Não enviado")).toBeVisible();

  await row.getByRole("button", { name: `Registrar envio do relatório de tráfego: ${clientName}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Link do relatório/).fill("reportei.com/abc");
  await dialog.getByRole("button", { name: "Registrar envio" }).click();
  await expect(dialog.getByText("Cole o link completo, começando com https://.")).toBeVisible();
  await dialog.getByLabel(/^Link do relatório/).fill("https://app.reportei.com/r/abc");
  await dialog.getByRole("button", { name: "Registrar envio" }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByText("Aguardando retorno")).toBeVisible();

  await row.getByRole("button", { name: `Registrar o retorno de ${clientName} ao relatório de tráfego` }).click();
  const fb = page.getByRole("dialog");
  await fb.locator("label").filter({ hasText: /^Negativo$/ }).click();
  await expect(fb.getByText(/estudar e ajustar as campanhas/)).toBeVisible();
  await fb.getByRole("button", { name: "Salvar retorno" }).click();
  await expect(fb.getByText("Conte o que o cliente achou ruim.")).toBeVisible();
  await fb.getByLabel(/^O que o cliente achou ruim/).fill("Poucos leads no WhatsApp esta semana");
  await fb.getByRole("button", { name: "Salvar retorno" }).click();
  await expect(fb).toBeHidden();
  await expect(row.getByText("Negativo")).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}-semana-${test.info().project.name}.png`, fullPage: true });

  await expect.poll(async () => (await admin.from("client_reports").select("feedback, sent_by, link").eq("client_id", clientId).eq("area", "trafego").single()).data)
    .toEqual({ feedback: "negativo", sent_by: people.Ana.id, link: "https://app.reportei.com/r/abc" });
  const { data: n } = await admin.from("notifications").select("user_id").eq("title", `Retorno negativo: ${clientName}`);
  expect(n!.map((x) => x.user_id)).toEqual([people.Caio.id]);
});

test("2. social media registra o de conteúdo na aba do cliente; sem retorno vira ligação", async ({ page }) => {
  await login(page, "Sol");
  await page.goto(`/clientes/${clientId}/relatorios`);
  await expect(page.getByRole("link", { name: "Relatórios", exact: true })).toHaveAttribute("aria-current", "page");
  const traffic = page.getByRole("region", { name: "Relatório de tráfego" });
  await expect(traffic.getByText("Negativo")).toBeVisible();
  await expect(traffic.getByRole("button", { name: /Registrar|Corrigir/ })).toHaveCount(0);

  const content = page.getByRole("region", { name: "Relatório de conteúdo" });
  await content.getByRole("button", { name: "Registrar envio do relatório de conteúdo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Registrar envio" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await content.getByRole("button", { name: /^Registrar o retorno do relatório de conteúdo/ }).click();
  const fb = page.getByRole("dialog");
  await fb.locator("label").filter({ hasText: /^Sem retorno$/ }).click();
  await fb.getByRole("button", { name: "Salvar retorno" }).click();
  await expect(fb).toBeHidden();
  await expect(content.getByRole("link", { name: "Ver a demanda de ligação" })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}-aba-${test.info().project.name}.png`, fullPage: true });

  const { data: r } = await admin.from("client_reports").select("call_task_id").eq("client_id", clientId).eq("area", "conteudo").single();
  const { data: t } = await admin.from("tasks").select("assignee_id, title").eq("id", r!.call_task_id!).single();
  expect(t).toEqual({ assignee_id: people.Caio.id, title: `Ligar para ${clientName}: sem retorno do relatório de conteúdo` });
});

test("3. editor de vídeo não abre os relatórios da semana", async ({ page }) => {
  await login(page, "Vic");
  await expect(page.getByRole("link", { name: "Relatórios da semana" })).toHaveCount(0);
  await page.goto("/relatorios");
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
