import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Configurações › Fluxos: marcar e desmarcar uma etapa como retrabalho ("Em alteração" no quadro do setor
 * e contagem de retrabalho). Roda só no computador: mexe numa etapa real do fluxo Geral e devolve no fim.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && adminEmail && adminPassword);

test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");
test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "Altera uma etapa compartilhada; uma execução basta."));

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
let stepId = "";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.getByLabel(/^Senha/).fill(adminPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function toggle(page: Page) {
  const section = page.getByRole("region", { name: "Geral" });
  await section.getByRole("button", { name: "Editar Fazendo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Conta como retrabalho").click();
  await dialog.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(dialog).toBeHidden();
  return section;
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data } = await admin.from("workflow_steps").select("id, workflows!inner(task_type)").eq("workflows.task_type", "geral").eq("name", "Fazendo").single();
  stepId = data!.id;
  await admin.from("workflow_steps").update({ is_rework: false }).eq("id", stepId);
});

test("marcar e desmarcar a etapa como retrabalho", async ({ page }) => {
  await login(page);
  await page.goto("/configuracoes/fluxos");
  const section = await toggle(page);
  await expect(section.getByRole("listitem").filter({ hasText: "Fazendo" }).getByLabel("Conta como retrabalho")).toBeVisible();
  const { data: on } = await admin.from("workflow_steps").select("is_rework").eq("id", stepId).single();
  expect(on!.is_rework).toBe(true);

  await toggle(page);
  await expect(section.getByRole("listitem").filter({ hasText: "Fazendo" }).getByLabel("Conta como retrabalho")).toHaveCount(0);
  const { data: off } = await admin.from("workflow_steps").select("is_rework").eq("id", stepId).single();
  expect(off!.is_rework).toBe(false);
});

test.afterAll(async () => {
  if (configured && stepId) await admin.from("workflow_steps").update({ is_rework: false }).eq("id", stepId);
});
