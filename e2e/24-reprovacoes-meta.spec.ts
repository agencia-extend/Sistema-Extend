import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Histórico de reprovações da Meta (RF-T2-02): a gestora registra a reprovação ligada a um criativo da
 * biblioteca (a peça vira "Reprovado pela Meta" e quem produziu é avisado), a designer vê o motivo no criativo
 * e quem pede o próximo criativo vê "O que evitar". Regras no banco: 27_reprovacoes_meta.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Clínica Reprovação ${stamp}`;
const angle = `Antes e depois do clareamento ${stamp}`;
const lesson = "Mostrar só o sorriso final, sem comparação lado a lado";
const people: Record<string, { id: string; email: string }> = {};
let clientId = "";
let taskId = "";
let libraryId = "";

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.rep.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Ana", "gestor_trafego");
  await makeUser("Bia", "gestor_trafego");
  await makeUser("Dani", "designer");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  const { data: svcs } = await admin.from("service_catalog").select("id").in("key", ["meta_ads"]);
  await admin.from("client_services").insert(svcs!.map((s) => ({ client_id: clientId, service_id: s.id, monthly_qty: 0 })));
  const { data: sectors } = await admin.from("sectors").select("id, key").in("key", ["trafego", "design"]);
  const sid = (k: string) => sectors!.find((s) => s.key === k)!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sid("trafego"), profile_id: people.Ana.id },
    { client_id: clientId, sector_id: sid("trafego"), profile_id: people.Bia.id },
    { client_id: clientId, sector_id: sid("design"), profile_id: people.Dani.id },
  ]);
  // Criativo que a Ana pediu, a Dani produziu e já está na biblioteca.
  const { data: t, error: te } = await admin.from("tasks").insert({ organization_id: org!.id, client_id: clientId, type: "criativo", title: angle, assignee_id: people.Dani.id }).select("id").single();
  if (te) throw te;
  taskId = t.id;
  await admin.from("creative_requests").insert({ task_id: taskId, client_id: clientId, requested_by: people.Ana.id, campaign: "Clareamento", objective: "mensagens", format: "imagem", angle, audience: "Mulheres de 25 a 45", cta: "Chamar no WhatsApp" });
  const { data: lib, error: le } = await admin.from("creative_library").insert({ task_id: taskId, client_id: clientId, campaign: "Clareamento", format: "imagem", angle }).select("id").single();
  if (le) throw le;
  libraryId = lib.id;
});

test("1. gestora registra a reprovação ligada ao criativo e depois o desfecho", async ({ page }) => {
  await login(page, "Ana");
  await page.goto(`/clientes/${clientId}/trafego`);
  const section = page.getByRole("region", { name: "Reprovações da Meta" });
  await expect(section.getByText("Nenhuma reprovação registrada")).toBeVisible();

  await section.getByRole("button", { name: "Registrar reprovação" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Registrar reprovação" }).click();
  await expect(dialog.getByText("Escolha o motivo.")).toBeVisible();
  await expect(dialog.getByText("Cole ou resuma o que a Meta disse.")).toBeVisible();

  await dialog.getByRole("combobox", { name: "Criativo da biblioteca" }).click();
  await page.getByRole("option", { name: new RegExp(angle) }).click();
  await expect(dialog.getByLabel(/^Ângulo/)).toHaveValue(angle);
  await dialog.getByRole("combobox", { name: "Motivo" }).click();
  await page.getByRole("option", { name: "Antes e depois / imagem corporal" }).click();
  await expect(dialog.getByText(/Comparação de antes e depois/)).toBeVisible();
  await dialog.getByLabel(/^O que a Meta disse/).fill("Seu anúncio não segue a política de antes e depois.");
  await dialog.getByLabel(/^O que evitar/).fill(lesson);
  await dialog.getByRole("button", { name: "Registrar reprovação" }).click();
  await expect(dialog).toBeHidden();

  await expect(section.getByText(`Antes e depois / imagem corporal: ${angle}`)).toBeVisible();
  await expect(section.getByText("Em aberto")).toBeVisible();
  await expect.poll(async () => (await admin.from("creative_library").select("status").eq("id", libraryId).single()).data?.status).toBe("reprovado_meta");
  const { data: n } = await admin.from("notifications").select("user_id, href").eq("title", `Anúncio reprovado: ${clientName}`).order("user_id");
  expect(n).toEqual(
    [
      { user_id: people.Bia.id, href: `/clientes/${clientId}/trafego#reprovacoes` },
      { user_id: people.Dani.id, href: `/criativos/${taskId}` },
    ].sort((a, b) => a.user_id.localeCompare(b.user_id)),
  );

  await section.getByRole("button", { name: `Atualizar a reprovação: ${angle}` }).click();
  const edit = page.getByRole("dialog");
  await edit.getByRole("combobox", { name: "Desfecho" }).click();
  await page.getByRole("option", { name: "Corrigido e reenviado" }).click();
  await edit.getByRole("button", { name: "Salvar" }).click();
  await expect(edit).toBeHidden();
  await expect(section.getByText("Corrigido e reenviado")).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}-aba-${test.info().project.name}.png`, fullPage: true });
});

test("2. a designer vê o motivo no criativo", async ({ page }) => {
  await login(page, "Dani");
  await page.goto(`/criativos/${taskId}`);
  const box = page.getByRole("region", { name: "Reprovado pela Meta" });
  await expect(box.getByText(/Antes e depois \/ imagem corporal/)).toBeVisible();
  await expect(box.getByText(lesson)).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test("3. quem pede o próximo criativo vê o que evitar", async ({ page }) => {
  await login(page, "Bia");
  await page.goto(`/criativos/novo?cliente=${clientId}`);
  const avoid = page.getByRole("region", { name: "O que evitar" });
  await expect(avoid.getByText(/Antes e depois \/ imagem corporal/)).toBeVisible();
  await expect(avoid.getByText(lesson)).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}-pedido-${test.info().project.name}.png`, fullPage: true });
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    await admin.from("tasks").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
