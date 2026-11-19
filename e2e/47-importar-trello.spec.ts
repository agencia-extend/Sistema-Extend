import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Importação do Trello (RF-TAR-11): a social media do cliente escolhe o JSON exportado, confere listas e membros
 * (o membro com o mesmo nome já vem associado), importa e cai no quadro novo; o mesmo quadro não entra de novo;
 * a pessoa associada recebe um aviso só; "Desfazer importação" tira os cards. Regras no banco: 52_importar_trello.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Clínica Trello ${stamp}`;
const people: Record<string, { id: string; email: string; name: string }> = {};
let clientId = "";
const base = `${Math.floor(Date.now() / 1000).toString(16)}${stamp.slice(-8).padStart(8, "0")}`;
const hex = (n: number) => `${base}${String(n).padStart(8, "0")}`.slice(0, 24);

async function login(page: Page, who: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(people[who].email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

async function makeUser(key: string, role: string) {
  const email = `${key.toLowerCase()}.tre.${stamp}@extend.test`;
  const name = `${key} Trello ${stamp}`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email, name };
}

const trelloJson = () => JSON.stringify({
  id: hex(1),
  name: "Conteúdo do mês",
  lists: [
    { id: hex(10), name: "A fazer", closed: false, pos: 1 },
    { id: hex(11), name: "Feito", closed: false, pos: 2 },
  ],
  cards: [
    { id: hex(20), name: `Reels ${stamp}`, desc: "Roteiro no Drive", closed: false, idList: hex(10), pos: 1, idMembers: [hex(30)], labels: [{ name: `Urgente ${stamp}`, color: "red" }] },
    { id: hex(21), name: `Carrossel ${stamp}`, closed: false, idList: hex(11), pos: 1, idMembers: [] },
    { id: hex(22), name: `Arquivado ${stamp}`, closed: true, idList: hex(10), pos: 2 },
  ],
  checklists: [{ id: hex(40), idCard: hex(20), name: "Roteiro", pos: 1, checkItems: [{ name: "Gancho", state: "complete", pos: 1 }] }],
  members: [{ id: hex(30), fullName: people.Dani.name }],
  actions: [{ type: "commentCard", date: "2026-10-01T15:00:00.000Z", memberCreator: { fullName: "Luiz" }, data: { text: "Primeira versão", card: { id: hex(20) } } }],
});

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Sol", "social_media");
  await makeUser("Dani", "designer");
  const { data: org } = await admin.from("organizations").select("id").order("created_at").limit(1).single();
  const { data: c, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = c.id;
  const { data: sectors } = await admin.from("sectors").select("id, key").in("key", ["gerenciamento", "design"]);
  const sec = (k: string) => sectors!.find((x) => x.key === k)!.id;
  await admin.from("client_members").insert([
    { client_id: clientId, sector_id: sec("gerenciamento"), profile_id: people.Sol.id },
    { client_id: clientId, sector_id: sec("design"), profile_id: people.Dani.id },
  ]);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) {
    await admin.from("tasks").delete().eq("client_id", clientId);
    await admin.from("boards").delete().eq("client_id", clientId);
    await admin.from("clients").delete().eq("id", clientId);
  }
  await admin.from("tags").delete().eq("name", `Urgente ${stamp}`);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});

test("importa o quadro do Trello, não repete e desfaz", async ({ page }) => {
  await login(page, "Sol");
  await page.goto(`/clientes/${clientId}/quadros`);
  await page.getByRole("button", { name: "Importar do Trello" }).click();
  const d = page.getByRole("dialog", { name: "Importar quadro do Trello" });
  const file = d.getByLabel("Arquivo JSON do Trello");

  await file.setInputFiles({ name: "quadro.json", mimeType: "application/json", buffer: Buffer.from("{\"nada\": 1}") });
  await expect(d.getByText("Este arquivo não é a exportação de um quadro do Trello.")).toBeVisible();

  await file.setInputFiles({ name: "quadro.json", mimeType: "application/json", buffer: Buffer.from(trelloJson()) });
  await expect(d.getByText(/2 cards em 2 listas, com 1 comentário, 1 item de checklist e 0 links\. Fica de fora o que está arquivado no Trello: 1 card./)).toBeVisible();
  await expect(d.getByRole("checkbox", { name: "Feito é coluna de concluído" })).toBeChecked();
  await expect(d.getByRole("combobox", { name: `Pessoa da equipe para ${people.Dani.name}` })).toContainText(people.Dani.name);
  await d.getByLabel("Nome do quadro no sistema").fill("Conteúdo (Trello)");
  await d.getByRole("button", { name: "Importar 2 cards" }).click();
  await expect(page.getByText("Quadro importado: 2 cards. Quem recebeu cards foi avisado.")).toBeVisible();
  await expect(page).toHaveURL(/quadro=/);
  await expect(page.getByText(`Reels ${stamp}`)).toBeVisible();
  await expect(page.getByText(`Carrossel ${stamp}`)).toBeVisible();
  await expect(page.getByText(`Arquivado ${stamp}`)).toHaveCount(0);
  await expect(page.getByText(/Importado do Trello \(Conteúdo do mês\) em .* por Sol Trello/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  const { data: n } = await admin.from("notifications").select("title").eq("user_id", people.Dani.id).not("title", "like", "Você foi marcado%");
  expect(n?.map((x) => x.title)).toEqual(["1 card do Trello está com você"]);

  // O mesmo quadro não entra de novo.
  await page.goto(`/clientes/${clientId}/quadros`);
  await page.getByRole("button", { name: "Importar do Trello" }).click();
  await d.getByLabel("Arquivo JSON do Trello").setInputFiles({ name: "quadro.json", mimeType: "application/json", buffer: Buffer.from(trelloJson()) });
  await d.getByRole("button", { name: "Importar 2 cards" }).click();
  await expect(d.getByText(/Este quadro do Trello já foi importado para este cliente em/)).toBeVisible();
  await page.keyboard.press("Escape");

  // Desfazer.
  await page.getByRole("link", { name: "Conteúdo (Trello)" }).click();
  await page.getByRole("button", { name: "Desfazer importação" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desfazer importação" }).click();
  await expect(page.getByText("Importação desfeita. Os cards saíram e o quadro foi arquivado.")).toBeVisible();
  await expect(page.getByText(`Reels ${stamp}`)).toHaveCount(0);
  // Outro aparelho do teste começa do zero.
  await admin.from("tasks").delete().eq("client_id", clientId);
  await admin.from("boards").delete().eq("client_id", clientId);
});

test("designer (não distribui demandas) não vê o botão de importar", async ({ page }) => {
  await login(page, "Dani");
  await page.goto(`/clientes/${clientId}/quadros`);
  await expect(page.getByRole("button", { name: "Importar do Trello" })).toHaveCount(0);
});
