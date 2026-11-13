/**
 * Layout único dos e-mails da Extend (HTML de e-mail: tabelas e estilos inline).
 * Puro e sem imports: é usado pelo app (envio pelo Titan) e por scripts/email-templates.mjs
 * (modelos do Supabase Auth, com marcadores {{ .X }} do Go no lugar dos valores).
 * Os textos passados aqui já devem vir escapados (use `esc`) ou ser marcadores do Go.
 */

export type EmailTone = "brand" | "success" | "warning" | "danger";

export type EmailParts = {
  siteUrl: string;
  /** Linha que aparece ao lado do assunto na caixa de entrada. */
  preheader: string;
  title: string;
  /** Parágrafos em HTML simples (strong, a, ol/li). */
  body: string[];
  /** O "crachá": quem é a pessoa no sistema e em que situação está o acesso. */
  pass?: { name: string; rows: [label: string, value: string][]; state: { label: string; tone: EmailTone } };
  code?: string;
  cta?: { label: string; href: string };
  /** Texto pequeno depois do botão (validade, o que fazer se não foi você). */
  note?: string;
};

const C = {
  ink: "#0E1726",
  body: "#3E4C60",
  muted: "#6B7A90",
  line: "#DCE4EE",
  page: "#EEF3F9",
  blue: "#1570C4",
  blueSoft: "#E8F2FC",
};

const TONE: Record<EmailTone, { fg: string; bg: string; bar: string }> = {
  brand: { fg: "#0F5DA6", bg: "#E8F2FC", bar: "#1D8AE6" },
  success: { fg: "#0E6B4C", bg: "#E4F5EE", bar: "#14956A" },
  warning: { fg: "#8A4B06", bg: "#FDF1DE", bar: "#F7931E" },
  danger: { fg: "#A12A1B", bg: "#FCE8E5", bar: "#D9442B" },
};

const FONT = "'Inter','Segoe UI',Helvetica,Arial,sans-serif";
const HEAD = "'Outfit','Segoe UI',Helvetica,Arial,sans-serif";

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function pass(p: NonNullable<EmailParts["pass"]>): string {
  const t = TONE[p.state.tone];
  const rows = p.rows
    .map(
      ([label, value]) => `
                  <tr>
                    <td style="padding:3px 16px 3px 0;font-size:13px;line-height:1.5;color:${C.muted};white-space:nowrap;vertical-align:top;">${label}</td>
                    <td style="padding:3px 0;font-size:13px;line-height:1.5;color:${C.ink};word-break:break-word;">${value}</td>
                  </tr>`,
    )
    .join("");
  return `
          <tr>
            <td style="padding:4px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:12px;border-collapse:separate;">
                <tr>
                  <td width="6" style="width:6px;background:${t.bar};border-radius:12px 0 0 12px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family:${HEAD};font-size:18px;font-weight:600;line-height:1.3;color:${C.ink};padding-bottom:4px;">${p.name}</td>
                        <td align="right" style="vertical-align:top;">
                          <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${t.bg};color:${t.fg};font-size:12px;font-weight:600;line-height:1.5;white-space:nowrap;">${p.state.label}</span>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export function renderEmail(e: EmailParts): string {
  const site = e.siteUrl.replace(/\/$/, "");
  const host = site.replace(/^https?:\/\//, "");
  const paragraphs = e.body
    .map((p) => (p.startsWith("<ol") ? p : `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${C.body};">${p}</p>`))
    .join("\n              ");
  const code = e.code
    ? `
          <tr>
            <td style="padding:4px 32px 12px;">
              <div style="display:inline-block;padding:14px 22px;border-radius:12px;background:${C.blueSoft};font-family:${HEAD};font-size:30px;font-weight:600;letter-spacing:6px;color:${C.ink};">${e.code}</div>
            </td>
          </tr>`
    : "";
  const cta = e.cta
    ? `
          <tr>
            <td style="padding:12px 32px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="border-radius:10px;background:${C.blue};">
                  <a href="${e.cta.href}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${e.cta.label}</a>
                </td>
              </tr></table>
            </td>
          </tr>`
    : "";
  const note = e.note
    ? `
          <tr>
            <td style="padding:16px 32px 0;font-size:13px;line-height:1.6;color:${C.muted};">${e.note}</td>
          </tr>`
    : "";
  const fallback = e.cta
    ? `
          <tr>
            <td style="padding:16px 32px 0;font-size:12px;line-height:1.6;color:${C.muted};">
              Se o botão não abrir, copie este endereço no navegador:<br>
              <a href="${e.cta.href}" style="color:${C.blue};word-break:break-all;">${e.cta.href}</a>
            </td>
          </tr>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>${e.title}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};color:${C.ink};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${e.preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.line};border-radius:16px;border-collapse:separate;overflow:hidden;">
          <tr>
            <td style="padding:26px 32px 22px;">
              <a href="${site}" style="text-decoration:none;"><img src="${site}/brand/logo.png" width="150" alt="Agência Extend" style="display:block;width:150px;height:auto;border:0;font-family:${HEAD};font-size:20px;font-weight:600;color:${C.blue};"></a>
            </td>
          </tr>
          <tr><td style="height:3px;background:#F7931E;background-image:linear-gradient(90deg,#FFB800,#F7931E);font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:30px 32px 6px;">
              <h1 style="margin:0 0 16px;font-family:${HEAD};font-size:24px;font-weight:600;line-height:1.25;color:${C.ink};">${e.title}</h1>
              ${paragraphs}
            </td>
          </tr>${e.pass ? pass(e.pass) : ""}${code}${cta}${note}${fallback}
          <tr>
            <td style="padding:28px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};">
                <tr>
                  <td style="padding-top:18px;font-size:12px;line-height:1.6;color:${C.muted};">
                    Sistema interno da Agência Extend<br>
                    <a href="${site}" style="color:${C.muted};">${host}</a><br>
                    Você recebeu este e-mail porque este endereço está cadastrado no sistema da equipe.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Versão em texto puro (melhora a entrega e serve leitores de e-mail sem HTML). */
export function renderText(e: EmailParts): string {
  const strip = (s: string) =>
    s
      .replace(/<li[^>]*>/g, "- ")
      .replace(/<\/(li|p|ol)>/g, "\n")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  const parts = [strip(e.title), ...e.body.map(strip)];
  if (e.pass) parts.push([strip(e.pass.name) + ` (${strip(e.pass.state.label)})`, ...e.pass.rows.map(([l, v]) => `${strip(l)}: ${strip(v)}`)].join("\n"));
  if (e.code) parts.push(`Código: ${strip(e.code)}`);
  if (e.cta) parts.push(`${strip(e.cta.label)}: ${e.cta.href}`);
  if (e.note) parts.push(strip(e.note));
  parts.push(`Agência Extend · ${e.siteUrl}`);
  return parts.join("\n\n");
}
