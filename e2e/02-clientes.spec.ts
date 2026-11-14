import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Roteiro da etapa 02 (prompts/02-CLIENTES-ONBOARDING.md) contra o Supabase de desenvolvimento. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && adminEmail && adminPassword);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const clientName = `Teste Imobiliária ${stamp}`;
const pw = `Senha${stamp}x9`;
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string, sector: string) {
  const email = `${key}.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  const { data: s } = await admin.from("sectors").select("id").eq("key", sector).single();
  await admin.from("profile_sectors").insert({ profile_id: data.user.id, sector_id: s!.id });
  people[key] = { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Priscila", "editor_video", "edicao");
  await makeUser("Madu", "social_media", "gerenciamento");
  await makeUser("OutroEditor", "editor_video", "edicao");
});

test("1-2. comercial registra o fechamento → cliente em onboarding só com 6 abas", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/clientes/novo");
  await page.getByLabel(/^Nome do cliente/).fill(clientName);
  await page.getByLabel("Facebook/Instagram Ads").check();
  await page.getByLabel("Pacote de vídeos").check();
  await page.getByLabel("Quantidade de Pacote de vídeos").fill("4");
  await page.getByLabel("Gerenciamento de redes").check();
  await page.getByRole("button", { name: "Adicionar promessa" }).click();
  await page.getByLabel(/^Promessa/).fill("Primeiro vídeo em 7 dias");
  await page.getByLabel(/^Prazo/).fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16));
  await page.setInputFiles('input[type="file"]', { name: "print.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByRole("button", { name: "Registrar fechamento" }).click();
  await page.waitForURL(/\/clientes\/[0-9a-f-]{36}$/);
  clientId = page.url().split("/").pop()!;
  const tabs = page.getByRole("navigation", { name: "Seções do cliente" }).getByRole("link");
  await expect(tabs).toHaveText(["Visão geral", "Ficha", "Materiais", "Reuniões", "Contratos", "Documentos"]);
  await expect(page.getByText("Primeiro vídeo em 7 dias")).toBeVisible();
});

test("3. concluir com a ficha incompleta → bloqueado e mostra o que falta", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto(`/clientes/${clientId}/ficha`);
  await expect(page.getByRole("button", { name: "Concluir onboarding" })).toBeDisabled();
  await expect(page.getByText(/Falta \d+ itens/)).toBeVisible();
});

test("4-5. preencher ficha, checklist e equipe → ativo com 4 vídeos da Priscila", async ({ page }) => {
  const { data: ob } = await admin.from("client_onboarding").select("form_id, onboarding_forms(sections)").eq("client_id", clientId).single();
  const sections = (ob!.onboarding_forms as unknown as { sections: { questions: { key: string }[] }[] }).sections;
  const answers = Object.fromEntries(sections.flatMap((s) => s.questions.map((q) => [q.key, "Resposta E2E"])));
  await admin.from("client_onboarding").update({ answers }).eq("client_id", clientId);
  await admin.from("onboarding_checklist_items").update({ done_at: new Date().toISOString() }).eq("client_id", clientId);

  await login(page, adminEmail, adminPassword);
  await page.goto(`/clientes/${clientId}`);
  for (const [sector, person] of [["Edição de vídeo", "Priscila"], ["Gerenciamento", "Madu"]]) {
    await page.getByRole("combobox", { name: "Setor" }).click();
    await page.getByRole("option", { name: sector }).click();
    await page.getByRole("combobox", { name: "Pessoa" }).click();
    await page.getByRole("option", { name: new RegExp(`^${person} ${stamp}`) }).click();
    await page.getByRole("button", { name: "Marcar" }).click();
    await expect(page.getByText(/Pessoa marcada/)).toBeVisible();
  }
  await page.goto(`/clientes/${clientId}/ficha`);
  await page.getByRole("button", { name: "Concluir onboarding" }).click();
  await page.waitForURL(new RegExp(`/clientes/${clientId}$`));
  await expect(page.getByText("Ativo", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Controle de Mídias" }).click();
  await page.waitForURL("**/midias");
  await expect(page.getByRole("link", { name: /^Vídeo \d\/4/ }).filter({ visible: true })).toHaveCount(4);
  await expect(page.getByText(/Priscila/).filter({ visible: true }).first()).toBeVisible();
});

test("6. visibilidade: Priscila vê só o resumo; editor não marcado não vê o cliente", async ({ page }) => {
  await login(page, people.Priscila.email, pw);
  await page.goto("/clientes");
  await expect(page.getByRole("link", { name: clientName })).toBeVisible();
  await page.goto(`/clientes/${clientId}/ficha`);
  await expect(page.getByText("Este é o resumo operacional da ficha")).toBeVisible();

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await anon.auth.signInWithPassword({ email: people.OutroEditor.email, password: pw });
  const { data } = await anon.from("clients").select("id").eq("id", clientId);
  expect(data ?? []).toHaveLength(0);
});

test("9. importar planilha com 10 clientes e desfazer", async ({ page }) => {
  const csv = ["Cliente,Nicho,Início,Fim,Vídeos", ...Array.from({ length: 10 }, (_, i) => `Import E2E ${stamp} ${i + 1},Varejo,01/10/2026,30/09/2027,${i % 3}`)].join("\n");
  const file = join(tmpdir(), `clientes-${stamp}.csv`);
  writeFileSync(file, csv, "utf8");
  await login(page, adminEmail, adminPassword);
  await page.goto("/clientes/importar");
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await page.setInputFiles('input[type="file"]', file);
  await expect(page.getByText("2. Prévia: 10 cliente(s) válido(s)")).toBeVisible();
  await page.getByRole("button", { name: /Importar 10 cliente/ }).click();
  await page.waitForURL("**/clientes");
  await page.goto("/clientes/importar");
  await page.getByRole("button", { name: "Desfazer" }).first().click();
  await page.getByRole("button", { name: "Desfazer importação" }).click();
  await expect(page.getByText(/Importação desfeita: 10/)).toBeVisible();
  const { count } = await admin.from("clients").select("id", { count: "exact", head: true }).like("name", `Import E2E ${stamp}%`);
  expect(count).toBe(0);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
