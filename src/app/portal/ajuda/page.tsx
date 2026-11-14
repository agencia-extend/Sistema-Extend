import type { Metadata } from "next";
import Link from "next/link";
import { requirePortal } from "@/lib/auth/dal";
import { publicEnv } from "@/lib/env";
import { portalHome } from "@/features/portal/queries";
import { PushDevice } from "@/features/notifications/components/push-device";

export const metadata: Metadata = { title: "Ajuda" };

const STEPS: { title: string; body: string }[] = [
  { title: "Início", body: "Mostra o mês do projeto: quanto já foi entregue de cada serviço, os próximos posts e as etapas do projeto." },
  { title: "Aprovações", body: "Quando a equipe envia uma peça, ela aparece aqui. Toque em Aprovar, ou em Pedir alteração e escreva o que precisa mudar. A equipe recebe sua resposta na hora." },
  { title: "Cronograma", body: "Os posts do mês, semana a semana, com a data, a legenda e o link do post depois de publicado." },
  { title: "Relatórios", body: "Os relatórios de resultado enviados pela agência, para abrir ou baixar em PDF." },
  { title: "Materiais", body: "Arquivos que a agência compartilhou com você e os conteúdos prontos, com o link para baixar do Drive." },
  { title: "Estratégia", body: "O planejamento do seu projeto, publicado pela agência." },
];

/** Manual do cliente (implantação de janeiro) e avisos no celular (RF-ACL-03). */
export default async function PortalHelpPage() {
  const { user, clientId, preview } = await requirePortal();
  const home = await portalHome(clientId);

  return (
    <>
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold">Ajuda</h1>
        <p className="text-sm text-muted-foreground">Como usar a área do cliente da Agência Extend.</p>
      </header>

      <section id="avisos" aria-labelledby="avisos-t" className="grid scroll-mt-20 gap-3">
        <h2 id="avisos-t" className="text-base font-semibold">Avisos no celular</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Ligue os avisos para saber na hora quando houver conteúdo para aprovar, relatório novo ou estratégia atualizada. No celular, instale antes:
          no Android, menu do navegador → “Instalar app”; no iPhone, Compartilhar → “Adicionar à Tela de Início”.
        </p>
        {preview ? (
          <p className="rounded-lg border border-dashed bg-surface p-3 text-sm text-muted-foreground">Na prévia, os avisos são ligados pela própria pessoa do cliente.</p>
        ) : (
          <PushDevice
            vapidKey={publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
            userId={user.id}
            offHint="Ative para saber na hora quando houver algo para aprovar."
            appName="a área do cliente"
          />
        )}
      </section>

      <section aria-labelledby="manual" className="grid gap-3">
        <h2 id="manual" className="text-base font-semibold">O que tem em cada seção</h2>
        <dl className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5">
          {STEPS.map((s) => (
            <div key={s.title} className="grid gap-0.5">
              <dt className="text-sm font-semibold">{s.title}</dt>
              <dd className="max-w-prose text-sm text-muted-foreground">{s.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="duvidas" className="grid gap-2">
        <h2 id="duvidas" className="text-base font-semibold">Dúvidas e acesso</h2>
        <ul className="grid max-w-prose list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
          <li>{home.owner?.name ? `Fale com ${home.owner.name}, seu contato na Extend, pelo canal de sempre.` : "Fale com o seu contato na Extend pelo canal de sempre."}</li>
          <li>Esqueceu a senha? Saia e use “Esqueci minha senha” na tela de entrada.</li>
          <li>Outra pessoa da sua empresa precisa de acesso? Peça à agência: cada pessoa tem o próprio login.</li>
          <li>
            Seus dados: veja a <Link href="/privacidade" className="font-medium text-primary hover:underline">Política de privacidade</Link> e os{" "}
            <Link href="/termos" className="font-medium text-primary hover:underline">Termos de uso</Link>.
          </li>
        </ul>
      </section>
    </>
  );
}
