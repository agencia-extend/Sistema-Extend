import type { Metadata } from "next";
import Image from "next/image";
import { CircleCheck, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { CookieNotice } from "@/components/app/cookie-notice";
import { getClientLink } from "@/lib/integrations/client-links";

// Link privado: não entra em busca nem passa o endereço a outros sites.
export const metadata: Metadata = { title: "Conectar o Facebook", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  cancelado: "A autorização foi cancelada no Facebook. Quando quiser, toque no botão de novo.",
  estado: "A autorização demorou demais ou foi aberta em outro navegador. Toque no botão de novo.",
  troca: "O Facebook não confirmou a autorização.",
  configuracao: "A conexão com o Facebook está em manutenção. Avise a Agência Extend.",
};

const CLOSED = {
  cancelado: "Este link foi substituído ou cancelado. Peça o link atual à Agência Extend.",
  expirado: "Este link venceu. Peça um novo link à Agência Extend.",
} as const;

/** Página pública: o cliente autoriza a Agência Extend a ler os anúncios do Facebook dele. */
export default async function ConectarPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string; detalhe?: string; conectado?: string }> }) {
  const [{ token }, q] = await Promise.all([params, searchParams]);
  const link = await getClientLink(token);
  const error = q.erro ? (q.erro === "troca" && q.detalhe ? `${ERRORS.troca} ${q.detalhe}` : ERRORS[q.erro]) : null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-xl items-center px-4 py-4">
          <Image src="/brand/logo.png" alt="Agência Extend" width={150} height={28} className="h-7 w-auto" priority />
        </div>
        <span className="gold-rule block h-0.5" aria-hidden="true" />
      </header>
      <main className="mx-auto grid max-w-xl gap-6 px-4 py-8">
        {!link ? (
          <section className="grid gap-2">
            <h1 className="text-2xl font-semibold">Link não encontrado</h1>
            <p className="text-muted-foreground">Confira se copiou o endereço inteiro ou peça um novo link à Agência Extend.</p>
          </section>
        ) : link.state === "usado" ? (
          <section className="grid justify-items-start gap-3" role="status">
            <CircleCheck className="size-10 text-success" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-balance">Facebook conectado</h1>
            <p className="text-muted-foreground">
              Obrigado! A equipe da Agência Extend já recebeu o acesso de leitura aos anúncios de {link.clientName}. Pode fechar esta página.
            </p>
            <p className="text-sm text-muted-foreground">
              Para retirar o acesso quando quiser: no Facebook, vá em Configurações › Integrações comerciais e remova “Sistema Extend”.
            </p>
          </section>
        ) : link.state !== "aberto" ? (
          <section className="grid gap-2">
            <h1 className="text-2xl font-semibold">Link indisponível</h1>
            <p className="text-muted-foreground">{CLOSED[link.state]}</p>
          </section>
        ) : (
          <>
            <header className="grid gap-2">
              <p className="text-sm text-muted-foreground">{link.clientName}</p>
              <h1 className="text-2xl font-semibold text-balance">Conectar o seu Facebook à Agência Extend</h1>
              <p className="text-muted-foreground">
                Assim a equipe acompanha os resultados dos seus anúncios no sistema da agência, sem precisar da sua senha.
              </p>
            </header>

            {error && (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <ul className="grid gap-3 rounded-xl border bg-card p-4 text-sm">
              <li className="flex gap-3">
                <Eye className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span><strong className="font-medium">O que a agência vê:</strong> as contas de anúncio, as campanhas e os números delas (gasto, alcance, cliques e resultados), e as páginas que você administra.</span>
              </li>
              <li className="flex gap-3">
                <EyeOff className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span><strong className="font-medium">O que a agência não faz:</strong> não publica, não altera nem cria anúncios, não lê mensagens e não vê a sua senha.</span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span><strong className="font-medium">Você controla:</strong> no Facebook você escolhe o que liberar e pode retirar o acesso quando quiser.</span>
              </li>
            </ul>

            <div className="grid gap-2">
              <a
                href={`/api/integracoes/meta/link?t=${token}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-5 text-base font-semibold text-white hover:bg-[#166FE5] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Continuar com o Facebook
              </a>
              <p className="text-xs text-muted-foreground">
                Você vai entrar no Facebook e confirmar. Entre com o perfil que administra os anúncios da empresa.{" "}
                <a href="/privacidade" className="underline underline-offset-2">Política de privacidade</a>
              </p>
            </div>
          </>
        )}
      </main>
      <div className="px-4 pb-6"><CookieNotice /></div>
    </div>
  );
}
