import { esc, type EmailParts } from "./layout";

/** E-mails que o próprio sistema envia (os do Supabase Auth ficam em scripts/email-templates.mjs). */

type Person = { name: string; email: string; roleName?: string | null };

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export function welcomeEmail(site: string, p: Person): { subject: string; parts: EmailParts } {
  return {
    subject: "Boas-vindas ao sistema da Extend",
    parts: {
      siteUrl: site,
      preheader: "Seu acesso está ativo. Três passos para começar bem.",
      title: `Tudo pronto, ${esc(first(p.name))}`,
      body: [
        "Sua senha foi criada e seu acesso ao sistema interno da Agência Extend está ativo. Para começar bem:",
        `<ol style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.65;color:#3E4C60;">
                <li style="margin-bottom:6px;"><strong>Instale o app no celular.</strong> Abra o sistema no navegador do celular e use “Adicionar à tela inicial”.</li>
                <li style="margin-bottom:6px;"><strong>Ligue os avisos.</strong> Em Configurações → Notificações, permita as notificações para saber na hora quando algo for para você.</li>
                <li><strong>Faça o treinamento “Primeiros passos”.</strong> Em Treinamentos, são 5 aulas curtas sobre o dia a dia no sistema.</li>
              </ol>`,
      ],
      pass: {
        name: esc(p.name),
        rows: [
          ...(p.roleName ? ([["Função", esc(p.roleName)]] as [string, string][]) : []),
          ["E-mail de acesso", esc(p.email)],
        ],
        state: { label: "Acesso ativo", tone: "success" },
      },
      cta: { label: "Entrar no sistema", href: `${site}/inicio` },
      note: "Guarde este e-mail: o botão acima leva direto para o sistema.",
    },
  };
}

export function accessPausedEmail(site: string, p: Person, by: string, when: string): { subject: string; parts: EmailParts } {
  return {
    subject: "Seu acesso ao sistema da Extend foi pausado",
    parts: {
      siteUrl: site,
      preheader: "A sessão foi encerrada em todos os aparelhos.",
      title: "Seu acesso foi pausado",
      body: [
        `Olá, ${esc(first(p.name))}. <strong>${esc(by)}</strong> pausou seu acesso ao sistema interno da Agência Extend em ${esc(when)}.`,
        "A sessão foi encerrada em todos os aparelhos e não é possível entrar enquanto o acesso estiver pausado. Seus dados e histórico continuam guardados.",
      ],
      pass: { name: esc(p.name), rows: [["E-mail de acesso", esc(p.email)]], state: { label: "Acesso pausado", tone: "warning" } },
      note: "Acha que é um engano? Fale com a coordenação da agência: o acesso pode ser reativado a qualquer momento.",
    },
  };
}

export function accessResumedEmail(site: string, p: Person, by: string): { subject: string; parts: EmailParts } {
  return {
    subject: "Seu acesso ao sistema da Extend foi reativado",
    parts: {
      siteUrl: site,
      preheader: "Pode entrar de novo com seu e-mail e senha.",
      title: "Seu acesso voltou",
      body: [
        `Olá, ${esc(first(p.name))}. <strong>${esc(by)}</strong> reativou seu acesso ao sistema interno da Agência Extend.`,
        "Entre com o mesmo e-mail e a mesma senha de antes. Se não lembrar a senha, use “Esqueci minha senha” na tela de entrada.",
      ],
      pass: { name: esc(p.name), rows: [["E-mail de acesso", esc(p.email)]], state: { label: "Acesso ativo", tone: "success" } },
      cta: { label: "Entrar no sistema", href: `${site}/login` },
    },
  };
}
