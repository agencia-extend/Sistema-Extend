import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Central do cliente (parte A): lista em tabela com filtros, nº e responsável, contratos com renovação e valores protegidos. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && adminEmail && adminPassword);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const people: Record<string, { id: string; email: string; name: string }> = {};
const clients: { id: string; name: string; code: number }[] = [];

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.ctr.${stamp}@extend.test`;
  const name = `${key} ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Comercial", "comercial");
  await makeUser("Joana", "atendimento");
  await makeUser("Madu", "social_media");
  const asSales = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await asSales.auth.signInWithPassword({ email: people.Comercial.email, password: pw });
  const { data: svc } = await admin.from("service_catalog").select("id").eq("key", "meta_ads").limit(1).single();
  for (const name of [`Clínica Contrato ${stamp}`, `Loja Contrato ${stamp}`]) {
    const { data, error } = await asSales.rpc("create_handoff", {
      p: { name, contract_start: "2026-01-10", contract_months: 6, monthly_fee_cents: 350000, services: [{ service_id: svc!.id, monthly_qty: 0 }] },
    });
    if (error) throw error;
    const { data: c } = await admin.from("clients").select("code").eq("id", data as string).single();
    clients.push({ id: data as string, name, code: c!.code });
  }
  // A Madu é da equipe do primeiro cliente (vê o cliente, mas não vê valores).
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "gerenciamento").single();
  await admin.from("client_members").insert({ client_id: clients[0].id, sector_id: sector!.id, profile_id: people.Madu.id });
});

test("1. lista em tabela: nº, busca por nº e filtro de contrato", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto("/clientes");
  const table = page.getByRole("table", { name: "Clientes" });
  const row = table.getByRole("row", { name: new RegExp(clients[0].name) });
  await expect(row).toContainText(String(clients[0].code).padStart(3, "0"));
  await expect(row).toContainText("09/07/2026");
  await expect(row).toContainText("Vencido");
  await page.getByRole("textbox", { name: "Buscar cliente" }).fill(String(clients[1].code));
  await expect(table.getByRole("row", { name: new RegExp(clients[1].name) })).toBeVisible();
  await expect(table.getByRole("row", { name: new RegExp(clients[0].name) })).toHaveCount(0);
  await page.goto("/clientes?contrato=vencido");
  await expect(page.getByRole("table", { name: "Clientes" }).getByRole("row", { name: new RegExp(clients[0].name) })).toBeVisible();
});

test("2. nº repetido é recusado; responsável pela comunicação é definido e avisado", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto(`/clientes/${clients[0].id}`);
  await page.getByRole("region", { name: "Dados do cliente" }).getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog", { name: "Dados do cliente" });
  await dialog.getByLabel("Nº do cliente").fill(String(clients[1].code));
  await dialog.getByRole("button", { name: "Salvar dados" }).click();
  await expect(dialog.getByText("Este nº já é de outro cliente.")).toBeVisible();
  await dialog.getByLabel("Nº do cliente").fill(String(clients[0].code));
  await dialog.getByRole("combobox", { name: "Responsável pela comunicação" }).click();
  await page.getByRole("option", { name: people.Joana.name }).click();
  await dialog.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.getByText("Dados do cliente salvos.")).toBeVisible();
  await expect(page.getByText(people.Joana.name).first()).toBeVisible();
  await expect
    .poll(async () => (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", people.Joana.id).like("title", "Você é o responsável pela comunicação%")).count)
    .toBe(1);
});

test("3. renovar contrato: sugere datas, guarda o anterior e recusa sobreposição", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto(`/clientes/${clients[0].id}/contratos`);
  await page.getByRole("button", { name: "Renovar contrato" }).click();
  const dialog = page.getByRole("dialog", { name: "Renovar contrato" });
  await expect(dialog.getByLabel("Início")).toHaveValue("2026-07-10");
  await expect(dialog.getByLabel("Fim")).toHaveValue("2027-01-09");
  await dialog.getByLabel("Escopo contratado").fill("10 vídeos + 4 designs por mês");
  await dialog.getByLabel("Mensalidade (R$)").fill("4.200,00");
  await dialog.getByRole("button", { name: "Salvar contrato" }).click();
  await expect(page.getByText(/Contrato registrado/)).toBeVisible();
  const history = page.getByRole("list", { name: "Histórico de contratos" }).getByRole("listitem");
  await expect(history).toHaveCount(2);
  await expect(history.first()).toContainText("Atual");
  await expect(history.first()).toContainText("R$ 4.200,00");
  await expect(history.nth(1)).toContainText("Encerrado");

  // Editar o antigo para cair dentro do novo é recusado.
  await page.getByRole("button", { name: "Editar o contrato de 10/01/2026" }).click();
  const edit = page.getByRole("dialog", { name: "Editar contrato" });
  await edit.getByLabel("Fim").fill("2026-08-01");
  await edit.getByRole("button", { name: "Salvar contrato" }).click();
  await expect(edit.getByText(/se sobrepõem a outro contrato/)).toBeVisible();

  // O cadastro passou a usar o contrato novo.
  await page.goto(`/clientes/${clients[0].id}`);
  await expect(page.getByText("10 vídeos + 4 designs por mês")).toBeVisible();
  await expect(page.getByRole("link", { name: "até 09/01/2027" })).toBeVisible();
});

test("4. quem é da equipe vê os contratos, mas não o valor nem os botões", async ({ page }) => {
  await login(page, people.Madu.email, pw);
  await page.goto(`/clientes/${clients[0].id}/contratos`);
  await expect(page.getByRole("list", { name: "Histórico de contratos" }).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("Mensalidade")).toHaveCount(0);
  await expect(page.getByText("R$ 4.200,00")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Renovar contrato" })).toHaveCount(0);
});

test.afterAll(async () => {
  if (!configured) return;
  for (const c of clients) await admin.from("clients").delete().eq("id", c.id);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
