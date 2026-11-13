// Configura o envio de e-mails do Supabase Auth pela caixa da Extend (HostGator)
// e aplica os modelos de convite e de recuperação de senha.
// Uso: node scripts/configure-email.mjs https://endereco-do-sistema
// Precisa em .env.local: SUPABASE_ACCESS_TOKEN, SMTP_USER, SMTP_PASS (senha da caixa de e-mail),
// e opcionais SMTP_HOST (padrão mail.agenciaextend.com.br), SMTP_PORT (padrão 465) e SMTP_FROM_NAME.
import { readFileSync } from "node:fs";
import { loadEnv, required } from "./env.mjs";

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
const template = (file) => readFileSync(`supabase/templates/${file}`, "utf8").replaceAll("SITE_URL", site);

const body = {
  site_url: site,
  uri_allow_list: `${site}/**,http://localhost:3000/**,http://localhost:3100/**`,
  smtp_host: process.env.SMTP_HOST || "mail.agenciaextend.com.br",
  smtp_port: process.env.SMTP_PORT || "465",
  smtp_user: user,
  smtp_pass: pass,
  smtp_admin_email: user,
  smtp_sender_name: process.env.SMTP_FROM_NAME || "Agência Extend",
  rate_limit_email_sent: 100,
  mailer_subjects_invite: "{{ .Data.inviter_name }} convidou você para o sistema da Extend",
  mailer_templates_invite_content: template("convite.html"),
  mailer_subjects_recovery: "Crie uma nova senha no sistema da Extend",
  mailer_templates_recovery_content: template("recuperar-senha.html"),
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`Falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
console.log(`E-mails configurados: envio por ${user}, links para ${site}.`);
