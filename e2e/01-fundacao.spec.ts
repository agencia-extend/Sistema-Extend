import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Roteiro de teste da etapa 01 (prompts/01-FUNDACAO.md), contra o Supabase de DESENVOLVIMENTO.
 * Requer em .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD.
 * O convite é criado direto no banco (o e-mail real não é lido no teste), com o mesmo formato da action.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const adminEmail = process.env.E2E_ADMIN_EMAIL!;
const adminPassword = process.env.E2E_ADMIN_PASSWORD!;
const configured = Boolean(url && secret && adminEmail && adminPassword);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const editorEmail = `editor.e2e.${Date.now()}@extend.test`;
const editorPassword = `Senha${Date.now()}x9`;
let editorId = "";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

test("1-2. convite → editor define senha, vê só o permitido e é bloqueado em /configuracoes/usuarios", async ({ page }) => {
  const { data: role } = await admin.from("roles").select("id").eq("key", "editor_video").single();
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "edicao").single();
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const token = randomBytes(32).toString("base64url");
  const { data: inv, error } = await admin
    .from("invitations")
    .insert({
      organization_id: org!.id,
      email: editorEmail,
      full_name: "Editor Teste",
      role_id: role!.id,
      sector_ids: [sector!.id],
      token_hash: createHash("sha256").update(token).digest("hex"),
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const { data: created } = await admin.auth.admin.createUser({
    email: editorEmail,
    email_confirm: false,
    user_metadata: { invitation_id: inv!.id, role_id: role!.id, full_name: "Editor Teste" },
  });
  editorId = created.user!.id;
  await admin.from("invitations").update({ user_id: editorId }).eq("id", inv!.id);

  await page.goto(`/convite/${token}`);
  await page.getByLabel("Crie uma senha").fill(editorPassword);
  await page.getByRole("button", { name: "Aceitar convite e entrar" }).click();
  await page.waitForURL("**/inicio**");
  await expect(page.getByRole("heading", { name: /Editor/ })).toBeVisible();

  await page.goto("/configuracoes/usuarios");
  await expect(page).toHaveURL(/sem-acesso/);
});

test("3. consulta direta com o token do editor não vê papéis de outros", async () => {
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await anon.auth.signInWithPassword({ email: editorEmail, password: editorPassword });
  const { data } = await anon.from("user_roles").select("user_id").neq("user_id", editorId);
  expect(data ?? []).toHaveLength(0);
  const { data: matrix } = await anon.from("role_permissions").select("role_id");
  expect(matrix ?? []).toHaveLength(0);
  const { error } = await anon.from("user_roles").insert({ user_id: editorId, role_id: editorId });
  expect(error).not.toBeNull();
});

test("5. editor tenta se dar permissão (RPC/insert direto) → negado", async () => {
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await anon.auth.signInWithPassword({ email: editorEmail, password: editorPassword });
  const { error } = await anon.from("user_permission_overrides").insert({ user_id: editorId, permission_key: "users.manage", effect: "grant", scope: "all" });
  expect(error).not.toBeNull();
  const { error: rpcErr } = await anon.rpc("admin_set_user_role", { p_user: editorId, p_role: editorId });
  expect(rpcErr).not.toBeNull();
});

test("4, 6, 7, 8, 9. admin: exceção, ver como, notificação, desativar e auditoria", async ({ page, browser }) => {
  await login(page, adminEmail, adminPassword);
  await page.goto(`/configuracoes/usuarios/${editorId}`);

  // 4. exceção concede "Ver auditoria" → aparece no "Ver como"; remove → some.
  await page.getByRole("combobox", { name: "Exceção para Ver auditoria" }).click();
  await page.getByRole("option", { name: "Liberar" }).click();
  await expect(page.getByText("Permissão concedida.")).toBeVisible();
  await page.goto(`/configuracoes/usuarios/${editorId}/ver-como`);
  await expect(page.getByText("Ver auditoria")).toBeVisible();
  await page.goto(`/configuracoes/usuarios/${editorId}`);
  await page.getByRole("combobox", { name: "Exceção para Ver auditoria" }).click();
  await page.getByRole("option", { name: "Como no papel" }).click();
  await expect(page.getByText("Exceção removida.")).toBeVisible();

  // 7. notificação de teste chega no sino do editor.
  await page.getByRole("button", { name: "Notificação de teste" }).click();
  await expect(page.getByText("Notificação de teste enviada.")).toBeVisible();
  const editorCtx = await browser.newContext();
  const editorPage = await editorCtx.newPage();
  await login(editorPage, editorEmail, editorPassword);
  await expect(editorPage.getByRole("button", { name: /Notificações: \d+ não lidas/ })).toBeVisible();

  // 8. desativar derruba a sessão.
  await page.getByRole("button", { name: "Desativar acesso" }).click();
  await page.getByRole("button", { name: "Desativar acesso" }).last().click();
  await expect(page.getByText(/Acesso desativado/)).toBeVisible();
  await editorPage.goto("/inicio");
  await expect(editorPage).toHaveURL(/login/);
  await editorCtx.close();

  // 9. auditoria mostra as ações.
  await page.goto("/configuracoes/auditoria?periodo=hoje");
  await expect(page.getByText("exceção de permissão").first()).toBeVisible();
});

test.afterAll(async () => {
  if (!configured || !editorId) return;
  await admin.auth.admin.deleteUser(editorId);
});
