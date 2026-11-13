import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { renderEmail, renderText, type EmailParts } from "./layout";

export type SendResult = "sent" | "skipped" | "failed";

let transport: Transporter | null = null;

function smtp() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.titan.email",
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return { transport, from: { name: process.env.SMTP_FROM_NAME || "Agência Extend", address: user } };
}

/** Domínios reservados que nunca recebem e-mail (contas de teste). */
const UNDELIVERABLE = /\.(test|example|invalid|localhost)$/i;

/**
 * Envia um e-mail com o layout da Extend pela caixa do sistema.
 * Nunca lança: quem chama decide como avisar a falha na tela.
 */
export async function sendEmail(to: string, subject: string, parts: EmailParts): Promise<SendResult> {
  const domain = to.split("@")[1] ?? "";
  if (UNDELIVERABLE.test(domain)) return "skipped";
  const cfg = smtp();
  if (!cfg) {
    console.error("[email] SMTP_USER/SMTP_PASS ausentes: e-mail não enviado.");
    return "failed";
  }
  try {
    await cfg.transport.sendMail({ from: cfg.from, to, subject, html: renderEmail(parts), text: renderText(parts) });
    return "sent";
  } catch (err) {
    console.error("[email] falha no envio", (err as { code?: string }).code ?? "");
    return "failed";
  }
}
