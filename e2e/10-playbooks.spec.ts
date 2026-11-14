import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Playbooks: a coordenação monta o processo, o tráfego aplica num cliente, a demanda vai para a pessoa do setor. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret && process.env.E2E_ADMIN_EMAIL);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const people: Record<string, { id: string; email: string; name: string }> = {};
const pbName = `Lançamento de campanha ${stamp}`;
const clientName = `Clínica Playbook ${stamp}`;
let clientId = "";

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.pbk.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Joana", "coord_conteudo");
  await makeUser("Luiz", "gestor_trafego");
  await makeUser("Ben", "gestor_trafego");
  await makeUser("Madu", "social_media");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data: c } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo", contract_start: "2026-01-10" }).select("id").single();
  clientId = c!.id;
  const { data: tr } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  // Ben é o tráfego deste cliente: as demandas de tráfego vão para ele.
  await admin.from("client_members").insert({ client_id: clientId, sector_id: tr!.id, profile_id: people.Ben.id, is_default: true });
  // O Luiz também é da equipe (só aplica playbook em cliente que vê), mas não é o principal.
  await admin.from("client_members").insert({ client_id: clientId, sector_id: tr!.id, profile_id: people.Luiz.id, is_default: false });
});

test("1. coordenação monta o playbook com etapas, prazos e marcos", async ({ page }) => {
  await login(page, people.Joana.email);
  await page.goto("/playbooks");
  await page.getByRole("button", { name: "Novo playbook" }).click();
  const d = page.getByRole("dialog", { name: "Novo playbook" });
  await d.getByLabel("Nome").fill(pbName);
  await d.getByRole("combobox", { name: "Área" }).click();
  await page.getByRole("option", { name: "Tráfego" }).click();
  await d.getByRole("button", { name: "Criar playbook" }).click();
  await page.waitForURL(/\/playbooks\/[0-9a-f-]{36}/);

  for (const [title, days, milestone] of [["Configurar o pixel", "2", "Planejamento"], ["Subir a campanha", "5", "No ar"], ["Briefing da campanha", "0", "Planejamento"]] as const) {
    await page.getByRole("button", { name: "Nova etapa" }).click();
    const s = page.getByRole("dialog", { name: "Nova etapa" });
    await s.getByLabel("Etapa").fill(title);
    await s.getByLabel("Prazo após o início").fill(days);
    await s.getByRole("combobox", { name: "Setor responsável" }).click();
    await page.getByRole("option", { name: "Tráfego", exact: true }).click();
    await s.getByLabel("Marco").fill(milestone);
    await s.getByRole("button", { name: "Adicionar etapa" }).click();
    await expect(s).toBeHidden();
    await expect(page.getByRole("list", { name: "Etapas do playbook" })).toContainText(title);
  }
  // O briefing entrou por último: sobe para o começo.
  await page.getByRole("button", { name: "Subir a etapa Briefing da campanha" }).click();
  await page.getByRole("button", { name: "Subir a etapa Briefing da campanha" }).click();
  await expect(page.getByRole("list", { name: "Etapas do playbook" }).getByRole("listitem").first()).toContainText("Briefing da campanha");
});

test("2. o gestor de tráfego aplica no cliente: demandas para o Ben e marcos na central", async ({ page }) => {
  await login(page, people.Luiz.email);
  await page.goto("/playbooks");
  await page.getByRole("link", { name: new RegExp(pbName) }).click();
  await page.getByRole("button", { name: "Aplicar a um cliente" }).click();
  const d = page.getByRole("dialog", { name: `Aplicar “${pbName}”` });
  await d.getByRole("combobox", { name: "Cliente" }).click();
  await page.getByRole("option", { name: new RegExp(clientName) }).click();
  await d.getByLabel("Data de início").fill("2026-11-13");
  const preview = d.getByRole("list", { name: "Prévia dos marcos" });
  await expect(preview).toContainText("Planejamento");
  await expect(preview).toContainText("2 demanda(s) · até 17/11/2026");
  await expect(preview).toContainText("até 23/11/2026");
  await d.getByRole("button", { name: "Criar demandas e marcos" }).click();
  await page.waitForURL(new RegExp(`/clientes/${clientId}$`));
  await expect(page.getByRole("list", { name: `Marcos de ${pbName}` })).toContainText("No ar");

  const { data: tasks } = await admin.from("tasks").select("title, assignee_id").eq("client_id", clientId).not("playbook_run_id", "is", null);
  expect(tasks).toHaveLength(3);
  expect(tasks!.every((t) => t.assignee_id === people.Ben.id)).toBe(true);
  await expect.poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Ben.id)).count).toBeGreaterThanOrEqual(1);
});

test("3. social media não vê Playbooks no menu nem abre a página", async ({ page }) => {
  await login(page, people.Madu.email);
  await expect(page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Playbooks" })).toHaveCount(0);
  await page.goto("/playbooks");
  await expect(page).toHaveURL(/sem-acesso/);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  await admin.from("playbooks").delete().eq("name", pbName);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
