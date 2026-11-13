import { describe, expect, it } from "vitest";
import { esc, renderEmail, renderText } from "./layout";
import { accessPausedEmail, accessResumedEmail, welcomeEmail } from "./messages";
import { authTemplates } from "../../../scripts/email-templates.mjs";

const SITE = "https://hub.agenciaextend.com.br";

describe("layout dos e-mails", () => {
  it("escapa HTML vindo de nomes", () => {
    expect(esc(`<b>"Ana" & 'Bia'</b>`)).toBe("&lt;b&gt;&quot;Ana&quot; &amp; &#39;Bia&#39;&lt;/b&gt;");
    const m = welcomeEmail(SITE, { name: "<script>x</script> Silva", email: "a@b.com" });
    expect(renderEmail(m.parts)).not.toContain("<script>");
  });

  it("monta logo do domínio, botão e link alternativo", () => {
    const html = renderEmail(accessResumedEmail(SITE, { name: "Maria Eduarda", email: "madu@agenciaextend.com.br" }, "Joana").parts);
    expect(html).toContain(`${SITE}/brand/logo.png`);
    expect(html).toContain(`href="${SITE}/login"`);
    expect(html.match(new RegExp(`${SITE}/login`, "g"))!.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Acesso ativo");
    expect(html).toContain("Olá, Maria.");
  });

  it("acesso pausado não tem botão e diz quem pausou e quando", () => {
    const m = accessPausedEmail(SITE, { name: "Madu", email: "madu@x.com" }, "Joana Lima", "13/11/2026 20:00");
    const html = renderEmail(m.parts);
    expect(m.parts.cta).toBeUndefined();
    expect(html).toContain("<strong>Joana Lima</strong> pausou seu acesso");
    expect(html).toContain("13/11/2026 20:00");
    expect(renderText(m.parts)).toContain("Madu (Acesso pausado)");
  });

  it("modelos do Supabase cobrem todos os e-mails de autenticação com marcadores do Go", () => {
    const t = authTemplates(SITE);
    expect(Object.keys(t).sort()).toEqual(
      ["confirmation", "email_change", "email_changed_notification", "invite", "magic_link", "password_changed_notification", "reauthentication", "recovery"].sort(),
    );
    expect(t.invite.html).toContain('href="{{ .Data.invite_url }}"');
    expect(t.recovery.html).toContain(`${SITE}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/definir-senha`);
    expect(t.reauthentication.html).toContain("{{ .Token }}");
    for (const { subject, html } of Object.values(t) as { subject: string; html: string }[]) {
      expect(subject.length).toBeGreaterThan(10);
      expect(html).toContain('lang="pt-BR"');
      expect(html).not.toContain("SITE_URL");
    }
  });
});
