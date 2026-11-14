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

/** Boas-vindas de quem entrou pela área do cliente. */
export function portalWelcomeEmail(site: string, p: Person, clientName: string): { subject: string; parts: EmailParts } {
  return {
    subject: "Sua área do cliente na Agência Extend está pronta",
    parts: {
      siteUrl: site,
      preheader: "Acompanhe o projeto, aprove conteúdos e baixe relatórios.",
      title: `Tudo pronto, ${esc(first(p.name))}`,
      body: [
        `Seu acesso à área do cliente de <strong>${esc(clientName)}</strong> está ativo. Por ela você:`,
        `<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.65;color:#3E4C60;">
                <li style="margin-bottom:6px;">acompanha o andamento do mês e o cronograma de posts;</li>
                <li style="margin-bottom:6px;">aprova conteúdos ou pede alterações;</li>
                <li>baixa relatórios e arquivos que a agência compartilhar.</li>
              </ul>`,
        "Dica: no celular, abra a área do cliente e use “Adicionar à tela inicial”; depois ligue os avisos em Ajuda para saber na hora quando houver algo para aprovar.",
      ],
      pass: { name: esc(p.name), rows: [["Cliente", esc(clientName)], ["E-mail de acesso", esc(p.email)]], state: { label: "Acesso ativo", tone: "success" } },
      cta: { label: "Abrir a área do cliente", href: `${site}/portal` },
      note: "Guarde este e-mail: o botão acima leva direto para a sua área.",
    },
  };
}

/** Acesso da área do cliente pausado ou reativado pela agência. */
export function portalAccessEmail(site: string, p: Person, active: boolean, clientName: string): { subject: string; parts: EmailParts } {
  return active
    ? {
        subject: "Seu acesso à área do cliente foi reativado",
        parts: {
          siteUrl: site,
          preheader: "Pode entrar de novo com seu e-mail e senha.",
          title: "Seu acesso voltou",
          body: [
            `Olá, ${esc(first(p.name))}. A Agência Extend reativou seu acesso à área do cliente de <strong>${esc(clientName)}</strong>.`,
            "Entre com o mesmo e-mail e a mesma senha de antes. Se não lembrar a senha, use “Esqueci minha senha” na tela de entrada.",
          ],
          pass: { name: esc(p.name), rows: [["Cliente", esc(clientName)], ["E-mail de acesso", esc(p.email)]], state: { label: "Acesso ativo", tone: "success" } },
          cta: { label: "Entrar", href: `${site}/login` },
        },
      }
    : {
        subject: "Seu acesso à área do cliente foi pausado",
        parts: {
          siteUrl: site,
          preheader: "A sessão foi encerrada em todos os aparelhos.",
          title: "Seu acesso foi pausado",
          body: [
            `Olá, ${esc(first(p.name))}. A Agência Extend pausou seu acesso à área do cliente de <strong>${esc(clientName)}</strong>.`,
            "A sessão foi encerrada em todos os aparelhos. Se precisar do acesso de volta, fale com o seu contato na agência.",
          ],
          pass: { name: esc(p.name), rows: [["Cliente", esc(clientName)], ["E-mail de acesso", esc(p.email)]], state: { label: "Acesso pausado", tone: "warning" } },
        },
      };
}
