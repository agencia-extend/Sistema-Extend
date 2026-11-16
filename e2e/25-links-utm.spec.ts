import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Links com UTM (RF-ADS-11): a gestora gera o link da Meta (modelo com as chaves da plataforma), o link
 * manual da bio, não repete o mesmo link e copia; a colega de fora do cliente não vê. Regras no banco: 28_links_utm.test.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const configured = Boolean(url && secret);

test.describe.configure({ mode: "serial" });
test.skip(!configured, "Defina as variáveis do Supabase de desenvolvimento.");

const admin = configured ? createClient(url, secret, { auth: { persistSession: false } }) : null!;
const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const pw = `Senha${stamp}x9`;
const clientName = `Clínica UTM ${stamp}`;
const site = `https://clinica${stamp}.com.br/agendar`;
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
  const email = `${key.toLowerCase()}.utm.${stamp}@extend.test`;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: `${key} ${stamp}`, role_id: r!.id } });
  if (error) throw error;
  people[key] = { id: data.user.id, email };
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.beforeAll(async () => {
  if (!configured) return;
  await makeUser("Ana", "gestor_trafego");
  await makeUser("Edu", "gestor_trafego");
  const { data: org } = await admin.from("organizations").select("id").limit(1).single();
  const { data, error } = await admin.from("clients").insert({ organization_id: org!.id, name: clientName, status: "ativo" }).select("id").single();
  if (error) throw error;
  clientId = data.id;
  const { data: svcs } = await admin.from("service_catalog").select("id").in("key", ["meta_ads"]);
  await admin.from("client_services").insert(svcs!.map((s) => ({ client_id: clientId, service_id: s.id, monthly_qty: 0 })));
  const { data: sector } = await admin.from("sectors").select("id").eq("key", "trafego").single();
  await admin.from("client_members").insert({ client_id: clientId, sector_id: sector!.id, profile_id: people.Ana.id });
});

test("1. gestora gera o link da Meta e o da bio, sem repetir", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await login(page, "Ana");
  await page.goto(`/clientes/${clientId}/trafego`);
  const section = page.getByRole("region", { name: "Links com UTM" });
  await expect(section.getByText("Nenhum link gerado")).toBeVisible();

  await section.getByRole("button", { name: "Gerar link" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Gerar link" }).click();
  await expect(dialog.getByText("Dê um nome ao link")).toBeVisible();
  await expect(dialog.getByText("Informe o endereço do site")).toBeVisible();

  await dialog.getByLabel(/^Nome do link/).fill("Campanha clareamento");
  await dialog.getByLabel(/^Endereço de destino/).fill(site);
  const meta = `${site}?utm_source={{site_source_name}}&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}`;
  await expect(dialog.locator("output")).toHaveText(meta);
  await dialog.getByRole("button", { name: "Gerar link" }).click();
  await expect(dialog).toBeHidden();
  await expect(section.getByText(meta)).toBeVisible();

  // Link manual da bio: valores normalizados.
  await section.getByRole("button", { name: "Gerar link" }).first().click();
  const bio = page.getByRole("dialog");
  await bio.getByLabel(/^Nome do link/).fill("Bio do Instagram");
  await bio.getByRole("combobox", { name: "Onde vai ser usado" }).click();
  await page.getByRole("option", { name: /^Outro/ }).click();
  await bio.getByLabel(/^Endereço de destino/).fill(site.replace("https://", ""));
  await bio.getByLabel(/^Origem/).fill("Instagram");
  await bio.getByLabel(/^Mídia/).fill("Bio");
  await bio.getByLabel(/^Campanha/).fill("Black Friday");
  await bio.getByRole("button", { name: "Gerar link" }).click();
  await expect(bio).toBeHidden();
  const bioUrl = `${site}?utm_source=instagram&utm_medium=bio&utm_campaign=black_friday`;
  await expect(section.getByText(bioUrl)).toBeVisible();

  // Gerar parecido sem mudar nada: o banco não deixa repetir.
  await section.getByRole("button", { name: "Gerar um link parecido com: Bio do Instagram" }).click();
  const again = page.getByRole("dialog");
  await again.getByRole("button", { name: "Gerar link" }).click();
  await expect(again.getByText("Este link já foi gerado para o cliente. Copie da lista.")).toBeVisible();
  await again.getByRole("button", { name: "Fechar" }).click();

  await section.getByRole("button", { name: "Copiar o link: Bio do Instagram" }).click();
  await expect(page.getByText("Link copiado.")).toBeVisible();

  const { data } = await admin.from("utm_links").select("label, created_by").eq("client_id", clientId).order("created_at");
  expect(data).toEqual([
    { label: "Campanha clareamento", created_by: people.Ana.id },
    { label: "Bio do Instagram", created_by: people.Ana.id },
  ]);
  expect(await noOverflow(page)).toBe(true);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}-utm-${test.info().project.name}.png`, fullPage: true });

  // Apagar.
  await section.getByRole("button", { name: "Apagar o link: Campanha clareamento" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click();
  await expect(section.getByText(meta)).toBeHidden();
});

test("2. gestor de fora do cliente não abre o tráfego dele", async ({ page }) => {
  await login(page, "Edu");
  await page.goto(`/clientes/${clientId}/trafego`);
  await expect(page.getByRole("region", { name: "Links com UTM" })).toHaveCount(0);
});

test.afterAll(async () => {
  if (!configured) return;
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
});
