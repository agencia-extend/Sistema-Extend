import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Roteiro da etapa 12 (prompts/12-AREA-DO-CLIENTE.md), itens 1 a 5.
 * O convite é criado no banco com o mesmo formato da action (o e-mail real não é lido no teste);
 * o aceite, o portal, a prévia da equipe e a revogação passam pela tela.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const configured = Boolean(url && secret && publishable && process.env.E2E_ADMIN_EMAIL);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const tag = `E2E${stamp}`;
const clientName = `Teste Imobiliária ${tag}`;
const ids = { org: "", madu: "", carol: "", client: "", other: "", task: "", report: "", shared: "", carolInvite: "", daniInvite: "" };
const carolEmail = `carol.portal.${stamp}@cliente.test`;
const carolToken = randomBytes(32).toString("base64url");
const paths: string[] = [];

// PDF mínimo válido (uma página em branco) e PNG 1×1.
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function login(page: Page, email: string, landing: RegExp) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(landing);
}

async function upload(path: string, body: Buffer, type: string) {
  const { error } = await admin.storage.from("anexos").upload(path, body, { contentType: type });
  if (error) throw error;
  paths.push(path);
}

async function invite(email: string, name: string, token: string) {
  const { data: inv, error } = await admin
    .from("invitations")
    .insert({ organization_id: ids.org, email, full_name: name, role_id: null, portal_client_id: ids.client, invited_by: ids.madu, token_hash: createHash("sha256").update(token).digest("hex") })
    .select("id")
    .single();
  if (error) throw error;
  const { data: created } = await admin.auth.admin.createUser({ email, email_confirm: false, user_metadata: { invitation_id: inv!.id, full_name: name } });
  await admin.from("invitations").update({ user_id: created.user!.id }).eq("id", inv!.id);
  return inv!.id;
}

test.beforeAll(async () => {
  if (!configured) return;
  const { data: o } = await admin.from("organizations").select("id").limit(1).single();
  ids.org = o!.id;
  const { data: role } = await admin.from("roles").select("id").eq("key", "social_media").single();
  const { data: madu, error } = await admin.auth.admin.createUser({
    email: `madu.portal.${stamp}@extend.test`,
    password: pw,
    email_confirm: true,
    user_metadata: { full_name: `Madu ${tag}`, role_id: role!.id },
  });
  if (error) throw error;
  ids.madu = madu.user.id;

  const { data: c } = await admin
    .from("clients")
    .insert([
      { organization_id: ids.org, name: clientName, status: "ativo", monthly_fee_cents: 987654, notes: `nota interna ${tag}` },
      { organization_id: ids.org, name: `Outro Cliente ${tag}`, status: "ativo" },
    ])
    .select("id, name");
  ids.client = c!.find((x) => x.name === clientName)!.id;
  ids.other = c!.find((x) => x.name !== clientName)!.id;
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "gerenciamento").single();
  await admin.from("client_members").insert({ client_id: ids.client, sector_id: sector!.id, profile_id: ids.madu });

  // Conteúdo na etapa do cliente, com comentário interno; a versão entra no item 4 (depois do aceite).
  const { data: t } = await admin.from("tasks").insert({ organization_id: ids.org, client_id: ids.client, type: "conteudo", title: `Post de lançamento ${tag}`, created_by: ids.madu }).select("id").single();
  ids.task = t!.id;
  const { data: step } = await admin.from("workflow_steps").select("id, workflows!inner(task_type, organization_id)").eq("workflows.task_type", "conteudo").eq("name", "Aprovação do cliente").single();
  await admin.from("tasks").update({ workflow_step_id: step!.id, assignee_id: ids.madu }).eq("id", ids.task);
  await admin.from("task_comments").insert({ task_id: ids.task, author_id: ids.madu, body: `comentario interno ${tag}` });

  // Relatório e arquivo compartilhado (e um documento interno que não pode aparecer).
  const rel = `clientes/${ids.client}/${randomUUID()}-relatorio-outubro.pdf`;
  const mat = `clientes/${ids.client}/${randomUUID()}-apresentacao.pdf`;
  const internal = `clientes/${ids.client}/${randomUUID()}-interno.pdf`;
  await upload(rel, PDF, "application/pdf");
  await upload(mat, PDF, "application/pdf");
  await upload(internal, PDF, "application/pdf");
  const { data: files } = await admin
    .from("client_files")
    .insert([
      { client_id: ids.client, storage_path: rel, name: "relatorio-outubro.pdf", mime_type: "application/pdf", size_bytes: PDF.length, folder: "relatorios", uploaded_by: ids.madu },
      { client_id: ids.client, storage_path: mat, name: "apresentacao.pdf", mime_type: "application/pdf", size_bytes: PDF.length, folder: "cliente", uploaded_by: ids.madu },
      { client_id: ids.client, storage_path: internal, name: `interno ${tag}.pdf`, mime_type: "application/pdf", size_bytes: PDF.length, folder: "geral", uploaded_by: ids.madu },
    ])
    .select("id, folder");
  ids.report = files!.find((f) => f.folder === "relatorios")!.id;
  ids.shared = files!.find((f) => f.folder === "cliente")!.id;

  ids.carolInvite = await invite(carolEmail, `Carol ${tag}`, carolToken);
  ids.daniInvite = await invite(`dani.portal.${stamp}@cliente.test`, `Dani ${tag}`, randomBytes(32).toString("base64url"));
});

test("1. convidar o cliente → ele entra e vê só os próprios dados", async ({ page }) => {
  // Equipe: aba Área do cliente mostra os convites; revoga um; valida o formulário.
  await login(page, `madu.portal.${stamp}@extend.test`, /\/inicio/);
  await page.goto(`/clientes/${ids.client}/area-do-cliente`);
  await expect(page.getByText(`Carol ${tag}`)).toBeVisible();
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  const dani = page.getByRole("listitem").filter({ hasText: `Dani ${tag}` });
  await dani.getByRole("button", { name: "Revogar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Revogar convite" }).click();
  await expect(page.getByText(`Dani ${tag}`)).toHaveCount(0);
  const { data: d } = await admin.from("invitations").select("status").eq("id", ids.daniInvite).single();
  expect(d!.status).toBe("cancelado");

  // Cliente aceita o convite e cai na área do cliente.
  await page.context().clearCookies();
  await page.goto(`/convite/${carolToken}`);
  await expect(page.getByText(/área do cliente de Teste Imobiliária/)).toBeVisible();
  await page.getByLabel("Crie uma senha").fill(pw);
  await page.getByRole("checkbox", { name: /Li e concordo/ }).click();
  await page.getByRole("button", { name: "Aceitar convite e entrar" }).click();
  await page.waitForURL(/\/portal$/);
  await expect(page.getByRole("heading", { level: 1, name: clientName })).toBeVisible();
  const { data: carol } = await admin.from("profiles").select("id, portal_client_id, is_active").eq("email", carolEmail).single();
  expect(carol!.portal_client_id).toBe(ids.client);
  ids.carol = carol!.id;
  const { count } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("user_id", ids.carol);
  expect(count).toBe(0);
  const { count: joined } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ids.madu).eq("kind", "portal");
  expect(joined).toBe(1);
});

test("2. outro cliente pela URL e por consulta direta → negado", async ({ page }) => {
  await login(page, carolEmail, /\/portal/);
  for (const path of [`/clientes/${ids.other}`, `/clientes/${ids.client}`, "/inicio", "/configuracoes/usuarios"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/portal$/);
  }
  await expect(page.getByText(`Outro Cliente ${tag}`)).toHaveCount(0);

  const api = createClient(url, publishable, { auth: { persistSession: false } });
  await api.auth.signInWithPassword({ email: carolEmail, password: pw });
  expect((await api.from("clients").select("id")).data ?? []).toHaveLength(0);
  expect((await api.from("tasks").select("id")).data ?? []).toHaveLength(0);
  expect((await api.from("task_comments").select("id")).data ?? []).toHaveLength(0);
  expect((await api.from("client_files").select("id")).data ?? []).toHaveLength(0);
  const other = await api.rpc("portal_home", { p_client: ids.other });
  expect(other.error?.code).toBe("42501");
  const own = await api.rpc("portal_home", { p_client: ids.client });
  expect(own.error).toBeNull();
  const leak = await api.rpc("portal_file_path", { p_client: ids.other, p_kind: "arquivo", p_id: ids.report });
  expect(leak.error?.code).toBe("42501");
});

test("3. comentários internos e valores do contrato não aparecem em lugar nenhum", async ({ page }) => {
  await login(page, carolEmail, /\/portal/);
  for (const path of ["/portal", "/portal/aprovacoes", "/portal/cronograma", "/portal/relatorios", "/portal/materiais", "/portal/estrategia", "/portal/ajuda"]) {
    await page.goto(path);
    const html = await page.content();
    expect(html, path).not.toMatch(/987654|9\.876,54|nota interna|comentario interno|interno E2E/);
  }
});

test("4. conteúdo enviado para aprovação → cliente é avisado, aprova pelo portal → o fluxo interno segue", async ({ page }) => {
  // A versão chega na etapa do cliente: aviso no sistema (e na fila do push).
  const asset = `tarefas/${ids.task}/entregas/${randomUUID()}-post.png`;
  await upload(asset, PNG, "image/png");
  const { data: dl } = await admin.from("task_deliveries").insert({ task_id: ids.task, version: 1, note: `nota interna da entrega ${tag}`, created_by: ids.madu }).select("id").single();
  await admin.from("delivery_assets").insert({ delivery_id: dl!.id, kind: "arquivo", name: "post.png", storage_path: asset, mime_type: "image/png", size_bytes: PNG.length });
  const { data: notes } = await admin.from("notifications").select("href, push_status").eq("user_id", ids.carol).eq("kind", "portal");
  expect(notes!.some((n) => n.href === "/portal/aprovacoes" && ["pending", "sending", "sent", "skipped"].includes(n.push_status))).toBe(true);

  await login(page, carolEmail, /\/portal/);
  await expect(page.getByText("1 conteúdo aguardando sua aprovação")).toBeVisible();
  await page.goto("/portal/aprovacoes");
  const card = page.getByRole("article").filter({ hasText: `Post de lançamento ${tag}` });
  await expect(card.getByRole("img", { name: "post.png" })).toBeVisible();
  await expect(page.getByText(`nota interna da entrega ${tag}`)).toHaveCount(0);
  await card.getByRole("button", { name: "Pedir alteração" }).click();
  await card.getByRole("button", { name: "Enviar pedido de alteração" }).click();
  await expect(card.getByText("Descreva o que precisa mudar.")).toBeVisible();
  await card.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByText("Nada aguardando você")).toBeVisible();
  await expect(page.getByText(/Aprovado por Carol/)).toBeVisible();

  const { data: t } = await admin.from("tasks").select("workflow_steps(name)").eq("id", ids.task).single();
  const step = (Array.isArray(t!.workflow_steps) ? t!.workflow_steps[0] : t!.workflow_steps) as { name: string };
  expect(step.name).not.toBe("Aprovação do cliente");
  const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ids.madu).like("title", "Cliente aprovou%");
  expect(count).toBe(1);
});

test("5. baixar um material e um relatório", async ({ page }) => {
  await login(page, carolEmail, /\/portal/);
  await page.goto("/portal/relatorios");
  const [report] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Baixar relatorio-outubro.pdf" }).click()]);
  expect(report.suggestedFilename()).toBe("relatorio-outubro.pdf");
  await page.goto("/portal/materiais");
  await expect(page.getByText(`interno ${tag}`)).toHaveCount(0);
  const [material] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Baixar apresentacao.pdf" }).click()]);
  expect(material.suggestedFilename()).toBe("apresentacao.pdf");
  // Documento interno: nem pelo endereço direto.
  const { data: internal } = await admin.from("client_files").select("id").eq("client_id", ids.client).eq("folder", "geral").single();
  const res = await page.request.get(`/portal/arquivo/arquivo/${internal!.id}`, { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test("6. equipe publica a estratégia, vê como o cliente e pausa o acesso", async ({ page }) => {
  await login(page, `madu.portal.${stamp}@extend.test`, /\/inicio/);
  await page.goto(`/clientes/${ids.client}/area-do-cliente`);
  await page.getByLabel("Texto que o cliente vê").fill(`**Objetivo** ${tag}\nGerar 40 leads por mês.\n\n- Reels semanais\n- Campanha de captação`);
  await page.getByRole("button", { name: "Publicar para o cliente" }).click();
  await expect(page.getByText(/Publicada em/)).toBeVisible();

  await page.getByRole("link", { name: "Ver como o cliente" }).click();
  await page.waitForURL(/\/portal$/);
  await expect(page.getByText("Prévia: você está vendo o que a pessoa do cliente vê.")).toBeVisible();
  await page.goto("/portal/estrategia");
  await expect(page.getByText(`Objetivo`, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Sair da prévia" }).click();
  await page.waitForURL(new RegExp(`/clientes/${ids.client}/area-do-cliente$`));

  const carol = page.getByRole("listitem").filter({ hasText: carolEmail });
  await carol.getByRole("button", { name: "Pausar acesso" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Pausar acesso" }).click();
  await expect(carol.getByText("Acesso pausado")).toBeVisible();
  const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ids.carol).eq("href", "/portal/estrategia");
  expect(count).toBe(1);

  const api = createClient(url, publishable, { auth: { persistSession: false } });
  const signIn = await api.auth.signInWithPassword({ email: carolEmail, password: pw });
  expect(signIn.error).not.toBeNull();
});

test.afterAll(async () => {
  if (!configured) return;
  if (paths.length) await admin.storage.from("anexos").remove(paths);
  if (ids.client) await admin.from("tasks").delete().eq("client_id", ids.client);
  for (const id of [ids.client, ids.other].filter(Boolean)) await admin.from("clients").delete().eq("id", id);
  const { data: invs } = await admin.from("invitations").select("user_id").in("id", [ids.carolInvite, ids.daniInvite].filter(Boolean));
  for (const u of new Set([...(invs ?? []).map((i) => i.user_id), ids.carol, ids.madu].filter(Boolean))) await admin.auth.admin.deleteUser(u as string);
});
