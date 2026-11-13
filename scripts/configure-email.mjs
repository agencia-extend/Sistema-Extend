// Configura o envio de e-mails do Supabase Auth pela caixa da Extend (Titan, contratado na HostGator)
// e aplica todos os modelos de e-mail com a identidade da Extend (scripts/email-templates.mjs).
// Uso: node scripts/configure-email.mjs https://endereco-do-sistema
// Precisa em .env.local: SUPABASE_ACCESS_TOKEN, SMTP_USER, SMTP_PASS (senha da caixa de e-mail),
// e opcionais SMTP_HOST (padrão smtp.titan.email), SMTP_PORT (padrão 465) e SMTP_FROM_NAME.
import { loadEnv, required } from "./env.mjs";
import { authTemplates } from "./email-templates.mjs";

loadEnv();
const site = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https:\/\/[a-z0-9.-]+$/i.test(site)) {
  console.error("Informe o endereço do sistema: node scripts/configure-email.mjs https://...");
  process.exit(1);
}

const token = required("SUPABASE_ACCESS_TOKEN");
const user = required("SMTP_USER");
const pass = required("SMTP_PASS");
const ref = new URL(required("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0];

const body = {
  site_url: site,
  uri_allow_list: `${site}/**,http://localhost:3000/**,http://localhost:3100/**`,
  smtp_host: process.env.SMTP_HOST || "smtp.titan.email",
  smtp_port: process.env.SMTP_PORT || "465",
  smtp_user: user,
  smtp_pass: pass,
  smtp_admin_email: user,
  smtp_sender_name: process.env.SMTP_FROM_NAME || "Agência Extend",
  rate_limit_email_sent: 100,
  // Avisos de segurança: a pessoa sabe na hora quando a senha ou o e-mail da conta mudam.
  mailer_notifications_password_changed_enabled: true,
  mailer_notifications_email_changed_enabled: true,
};
for (const [key, { subject, html }] of Object.entries(authTemplates(site))) {
  body[`mailer_subjects_${key}`] = subject;
  body[`mailer_templates_${key}_content`] = html;
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`Falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
console.log(`E-mails configurados: envio por ${user}, ${Object.keys(authTemplates(site)).length} modelos, links para ${site}.`);
