import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Página inicial pública (hub.agenciaextend.com.br): explica o sistema para quem chega sem login,
// inclusive os revisores do Google e da Meta. Quem está logado vai direto para /inicio (proxy.ts).
export const metadata: Metadata = {
  title: "Sistema Extend",
  description: "Sistema interno da Agência Extend: produção de conteúdo, criativos, tráfego pago e área do cliente.",
};

const FEATURES: [string, string][] = [
  ["Produção de conteúdo", "Demandas de vídeo, design e redes sociais de cada cliente, com prazos, etapas, cronograma do mês e aprovação do cliente."],
  ["Criativos para anúncios", "Pedido padronizado do tráfego para a equipe de mídias, versões, revisão interna, aprovação do cliente e biblioteca de criativos."],
  ["Tráfego pago", "Conecta às contas de anúncio da Meta e do Google Ads administradas pela agência, só para leitura, e mostra a cada cliente o investimento e os resultados."],
  ["Agenda", "Gravações e reuniões da equipe. Quem conecta a própria Google Agenda recebe, numa agenda separada chamada “Sistema Extend”, os eventos do sistema em que participa."],
  ["Área do cliente", "Cada cliente acompanha o andamento do mês, aprova conteúdos e baixa relatórios e materiais."],
];

export default function SobrePage() {
  return (
    <article className="grid gap-12">
      <header className="grid max-w-3xl gap-4">
        <p className="text-sm font-medium text-muted-foreground">Agência Extend</p>
        <h1 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">Sistema Extend</h1>
        <p className="text-lg text-muted-foreground">
          O sistema interno da Agência Extend para organizar a produção de conteúdo, os criativos e o tráfego pago dos clientes da agência. O acesso é só para a equipe e os clientes da agência, por convite.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>Entrar</Link>
          <Link href="/privacidade" className={buttonVariants({ size: "lg", variant: "outline" })}>Política de privacidade</Link>
        </div>
      </header>

      <section aria-labelledby="o-que-faz" className="grid gap-5">
        <h2 id="o-que-faz" className="text-xl font-semibold">O que o sistema faz</h2>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="grid gap-1 border-l-2 border-gold pl-4">
              <dt className="font-semibold">{t}</dt>
              <dd className="text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="dados" className="grid max-w-3xl gap-3">
        <h2 id="dados" className="text-xl font-semibold">Dados do Google e da Meta</h2>
        <p className="text-sm text-muted-foreground">
          O sistema só acessa uma conta do Google ou da Meta quando alguém da agência a conecta, e só para o que está descrito na{" "}
          <Link href="/privacidade#conexoes" className="font-medium text-brand underline underline-offset-2">política de privacidade</Link>. Os dados não são usados para publicidade, não são vendidos e não são compartilhados com terceiros. Quem conectou pode desconectar a qualquer momento, e o acesso é revogado na hora.
        </p>
      </section>

      <section aria-labelledby="about" lang="en" className="grid max-w-3xl gap-3 rounded-xl border bg-card p-5">
        <h2 id="about" className="text-xl font-semibold">About this app</h2>
        <p className="text-sm text-muted-foreground">
          Sistema Extend is the internal management system of Agência Extend, a marketing agency in Brazil. The agency team uses it to manage content production, ad creatives and paid traffic for the agency&apos;s clients. Access is by invitation only.
        </p>
        <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Google Ads API</strong> (read-only): lists the agency&apos;s manager account (MCC) and client ad accounts and shows their performance to the agency team and to each client.</li>
          <li><strong className="text-foreground">Google Calendar</strong>: when a team member connects their Google account, the system creates a separate secondary calendar named “Sistema Extend” and adds, updates and removes in it only the system&apos;s own events (recordings and meetings) they take part in. It has no access to the user&apos;s other calendars or events.</li>
          <li><strong className="text-foreground">Meta Marketing API</strong> (read-only): lists the ad accounts the agency manages and shows ad performance to the agency team and to each client.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Data is never used for advertising, sold or shared. Users can disconnect at any time. Read the{" "}
          <Link href="/privacidade" className="font-medium text-brand underline underline-offset-2">Privacy Policy</Link> and the{" "}
          <Link href="/termos" className="font-medium text-brand underline underline-offset-2">Terms of Use</Link>. Contact: <span className="font-medium text-foreground">hub.extend@agenciaextend.com.br</span>.
        </p>
      </section>

      <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm text-muted-foreground">
        <span>Agência Extend</span>
        <a href="https://agenciaextend.com.br" className="hover:text-foreground">agenciaextend.com.br</a>
        <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
        <Link href="/termos" className="hover:text-foreground">Termos de uso</Link>
      </footer>
    </article>
  );
}
