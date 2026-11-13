// Modelos dos e-mails que o Supabase Auth envia (convite, senha, códigos, avisos de segurança).
// Mesmo layout dos e-mails enviados pelo app (src/lib/email/layout.ts); os valores são marcadores do Go.
import { renderEmail } from "../src/lib/email/layout.ts";

const NAME = "{{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}{{ .Email }}{{ end }}";
const HELLO = "Olá{{ if .Data.full_name }}, {{ .Data.full_name }}{{ end }}!";

/** @param {string} site endereço do sistema, sem barra no fim */
export function authTemplates(site) {
  const confirm = (type, next) => `${site}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;next=${next}`;
  const t = (subject, parts) => ({ subject, html: renderEmail({ siteUrl: site, ...parts }) });

  return {
    invite: t("{{ .Data.inviter_name }} liberou seu acesso ao sistema da Extend", {
      preheader: "Crie sua senha para entrar. O convite vale até {{ .Data.expires_label }}.",
      title: "Seu lugar na equipe já está reservado",
      body: [
        HELLO,
        "<strong>{{ .Data.inviter_name }}</strong> convidou você para o sistema interno da Agência Extend. É nele que a equipe organiza demandas, clientes, aprovações e treinamentos do dia a dia.",
        "Falta só criar sua senha. Leva menos de um minuto.",
      ],
      pass: {
        name: NAME,
        rows: [
          ["Função", "{{ .Data.role_name }}"],
          ["E-mail de acesso", "{{ .Email }}"],
          ["Convite válido até", "{{ .Data.expires_label }}"],
        ],
        state: { label: "Aguardando sua senha", tone: "brand" },
      },
      cta: { label: "Criar minha senha", href: "{{ .Data.invite_url }}" },
      note: "O link é pessoal e funciona uma vez. Não esperava este convite? Ignore este e-mail: ninguém entra na sua conta sem a senha que você criar.",
    }),

    recovery: t("Crie uma nova senha no sistema da Extend", {
      preheader: "Use o botão para criar uma nova senha. O link vale por 1 hora.",
      title: "Vamos criar uma nova senha",
      body: [HELLO, "Recebemos um pedido para trocar a senha da conta <strong>{{ .Email }}</strong> no sistema da Agência Extend."],
      cta: { label: "Criar nova senha", href: confirm("recovery", "/definir-senha") },
      note: "O link funciona uma vez e vale por 1 hora. Não pediu a troca? Ignore este e-mail: sua senha continua a mesma.",
    }),

    magic_link: t("Seu link para entrar no sistema da Extend", {
      preheader: "Um toque e você entra. O link vale por 1 hora.",
      title: "Seu link de entrada",
      body: [HELLO, "Use o botão abaixo para entrar no sistema da Agência Extend com <strong>{{ .Email }}</strong>, sem digitar senha."],
      cta: { label: "Entrar no sistema", href: confirm("email", "/inicio") },
      note: "O link funciona uma vez e vale por 1 hora. Não pediu para entrar? Ignore este e-mail.",
    }),

    confirmation: t("Confirme seu e-mail no sistema da Extend", {
      preheader: "Confirme o endereço para ativar sua conta.",
      title: "Confirme seu e-mail",
      body: [HELLO, "Confirme que <strong>{{ .Email }}</strong> é seu para ativar o acesso ao sistema da Agência Extend."],
      cta: { label: "Confirmar e-mail", href: confirm("email", "/inicio") },
      note: "Não reconhece este pedido? Ignore este e-mail.",
    }),

    email_change: t("Confirme seu novo e-mail no sistema da Extend", {
      preheader: "Falta confirmar a troca de e-mail da sua conta.",
      title: "Confirme a troca de e-mail",
      body: [HELLO, "Para trocar o e-mail de acesso de <strong>{{ .Email }}</strong> para <strong>{{ .NewEmail }}</strong>, confirme pelo botão."],
      cta: { label: "Confirmar novo e-mail", href: confirm("email_change", "/inicio") },
      note: "Não pediu a troca? Ignore este e-mail e avise a coordenação da agência.",
    }),

    reauthentication: t("{{ .Token }} é seu código de verificação da Extend", {
      preheader: "Digite o código no sistema para confirmar que é você.",
      title: "Seu código de verificação",
      body: [HELLO, "Digite este código no sistema da Agência Extend para confirmar que é você:"],
      code: "{{ .Token }}",
      note: "O código vale por 1 hora. Não pediu? Ignore este e-mail e troque sua senha.",
    }),

    password_changed_notification: t("Sua senha do sistema da Extend foi alterada", {
      preheader: "Se foi você, está tudo certo.",
      title: "Sua senha foi alterada",
      body: [HELLO, "A senha da conta <strong>{{ .Email }}</strong> no sistema da Agência Extend acabou de ser alterada. Se foi você, não precisa fazer nada."],
      pass: { name: NAME, rows: [["E-mail de acesso", "{{ .Email }}"]], state: { label: "Senha nova ativa", tone: "success" } },
      cta: { label: "Ir para a tela de entrada", href: `${site}/login` },
      note: "Não foi você? Na tela de entrada, toque em “Esqueci minha senha” para criar outra e avise a coordenação da agência.",
    }),

    email_changed_notification: t("O e-mail da sua conta na Extend foi alterado", {
      preheader: "Seu acesso agora usa outro endereço.",
      title: "O e-mail da sua conta mudou",
      body: [HELLO, "O e-mail de acesso ao sistema da Agência Extend foi trocado de <strong>{{ .OldEmail }}</strong> para <strong>{{ .Email }}</strong>."],
      note: "Não reconhece esta troca? Avise a coordenação da agência o quanto antes.",
    }),
  };
}
