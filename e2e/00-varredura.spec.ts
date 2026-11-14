import { writeFileSync, mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Varredura do sistema: um usuário de cada papel entra e abre todas as telas do próprio menu
 * (e de Configurações), um cliente com todas as abas, uma demanda e um treinamento.
 * Confere que cada tela abre sem erro, sem falha no navegador, com título, e que as telas
 * fora do menu daquele papel ficam bloqueadas. Grava o tempo de cada tela em test-results/varredura.json.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret && process.env.E2E_ADMIN_EMAIL);

test.skip(!configured, "Defina as variáveis E2E_* e do Supabase de desenvolvimento.");
test.setTimeout(240_000);

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;

const ROLES = ["admin", "gerente_trafego", "gestor_trafego", "coord_conteudo", "social_media", "editor_video", "designer", "gravacao", "sites", "comercial", "atendimento", "leitura"];
const MENU = ["/inicio", "/tarefas", "/clientes", "/agenda", "/setores", "/quadros", "/criativos", "/producao", "/playbooks", "/comercial", "/treinamentos"];
const SETTINGS = [
  "/configuracoes/perfil", "/configuracoes/notificacoes", "/configuracoes/usuarios", "/configuracoes/papeis", "/configuracoes/servicos",
  "/configuracoes/onboarding", "/configuracoes/rotinas", "/configuracoes/fluxos", "/configuracoes/funis", "/configuracoes/setores", "/configuracoes/auditoria", "/configuracoes/privacidade",
];
const users: string[] = [];
const timings: { role: string; path: string; ms: number }[] = [];

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(pw);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio**");
}

/** Abre a tela e confere: sem erro, com título, sem falha no navegador. */
async function visit(page: Page, role: string, path: string, problems: string[]) {
  const t0 = Date.now();
  const res = await page.goto(path, { waitUntil: "load" });
  timings.push({ role, path, ms: Date.now() - t0 });
  const where = `${role} ${path}`;
  if (!res || res.status() >= 500) problems.push(`${where}: resposta ${res?.status()}`);
  if (await page.getByText("Não foi possível carregar esta página").count()) problems.push(`${where}: tela de erro`);
  await expect(page.locator("h1").first(), `${where}: sem título`).toBeVisible();
}

for (const role of ROLES) {
  test(`papel ${role}: todas as telas do menu abrem e o resto fica fechado`, async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "A varredura usa o menu lateral do computador.");
    const { data: r } = await admin.from("roles").select("id, name").eq("key", role).single();
    const email = `varredura.${role}.${stamp}@extend.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `Varredura ${r!.name} ${stamp}`, role_id: r!.id } });
    if (error) throw error;
    users.push(data.user.id);

    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`${role} ${page.url()}: erro no navegador: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 404/.test(m.text())) problems.push(`${role} ${page.url()}: console: ${m.text().slice(0, 200)}`);
    });

    await login(page, email);
    const menu = page.getByRole("navigation", { name: "Menu principal" });
    const visible = new Set<string>();
    for (const href of MENU) if (await menu.locator(`a[href="${href}"]`).count()) visible.add(href);
    expect(visible.has("/inicio")).toBe(true);

    for (const path of MENU) {
      if (visible.has(path)) {
        await visit(page, role, path, problems);
        await expect(page.locator("h1").first()).not.toHaveText("Sem acesso");
        expect(page.url(), `${role} abre ${path}`).not.toContain("sem-acesso");
      } else {
        await page.goto(path).catch(() => undefined); // o redirecionamento pode interromper o carregamento
        await expect(page, `${role} não deveria abrir ${path}`).toHaveURL(/sem-acesso/);
      }
    }

    // Configurações: o que aparece na lista abre; o resto fica fechado.
    await visit(page, role, "/configuracoes", problems);
    const settingsVisible = new Set<string>();
    for (const href of SETTINGS) if (await page.locator(`main a[href="${href}"]`).count()) settingsVisible.add(href);
    for (const path of SETTINGS) {
      if (settingsVisible.has(path)) {
        await visit(page, role, path, problems);
      } else {
        await page.goto(path).catch(() => undefined); // o redirecionamento pode interromper o carregamento
        await expect(page, `${role} não deveria abrir ${path}`).toHaveURL(/sem-acesso/);
      }
    }

    // Detalhes: primeiro cliente com todas as abas, primeira demanda e primeiro treinamento.
    if (visible.has("/clientes")) {
      await page.goto("/clientes");
      const first = page.locator('main a[href^="/clientes/"]').filter({ hasNotText: /Novo|Importar/ }).first();
      if (await first.count()) {
        const href = (await first.getAttribute("href"))!.split("?")[0];
        if (/^\/clientes\/[0-9a-f-]{36}$/.test(href)) {
          await visit(page, role, href, problems);
          const tabs = await page.getByRole("navigation", { name: "Seções do cliente" }).getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
          for (const tab of tabs.slice(1)) await visit(page, role, tab, problems);
        }
      }
    }
    if (visible.has("/comercial")) {
      await page.goto("/comercial");
      const tabs = await page.getByRole("navigation", { name: "Seções do comercial" }).getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
      for (const tab of tabs.slice(1)) await visit(page, role, tab, problems);
    }
    if (visible.has("/treinamentos")) {
      await page.goto("/treinamentos");
      const t = page.locator('main a[href^="/treinamentos/"]').first();
      if (await t.count()) await visit(page, role, (await t.getAttribute("href"))!, problems);
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });
}

test.afterAll(async () => {
  if (!configured) return;
  for (const id of users) await admin.auth.admin.deleteUser(id);
  if (timings.length) {
    const dir = process.env.VARREDURA_DIR ?? "test-results";
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/varredura-${process.env.VARREDURA_TAG ?? "local"}-${test.info().workerIndex}.json`, JSON.stringify(timings, null, 2));
  }
});
