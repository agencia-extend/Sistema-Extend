import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublicLeadReview, PUBLIC_DAYS } from "@/features/ads/leads/public";
import { CookieNotice } from "@/components/app/cookie-notice";
import { cn } from "@/lib/utils";
import { LeadReviewList } from "./lead-review-list";

// Link privado: não entra em busca nem passa o endereço a outros sites.
export const metadata: Metadata = { title: "Avaliar leads", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Página pública do cliente: avalia os leads das campanhas (bom, médio, ruim, não atendeu) com comentário. */
export default async function AvaliarLeadsPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ dias?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const days = PUBLIC_DAYS.find((d) => String(d) === sp.dias) ?? 30;
  const r = await getPublicLeadReview(token, days);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-4">
          <Image src="/brand/logo.png" alt="Agência Extend" width={150} height={28} className="h-7 w-auto" priority />
        </div>
        <span className="gold-rule block h-0.5" aria-hidden="true" />
      </header>
      <main className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
        {!r || r.state === "cancelado" ? (
          <section className="grid gap-2">
            <h1 className="text-2xl font-semibold">{r ? "Este link foi cancelado" : "Link não encontrado"}</h1>
            <p className="text-muted-foreground">{r ? "Peça o link atual à Agência Extend." : "Confira se copiou o endereço inteiro ou peça um novo link à Agência Extend."}</p>
          </section>
        ) : (
          <>
            <header className="grid gap-1">
              <p className="text-sm text-muted-foreground">{r.clientName}</p>
              <h1 className="text-2xl font-semibold text-balance">Como foram estes leads?</h1>
              <p className="text-sm text-muted-foreground">
                Marque cada contato que chegou pelos anúncios. Com isso, a Agência Extend sabe quais campanhas trazem clientes de verdade e ajusta o investimento.
              </p>
            </header>
            <nav aria-label="Período" className="flex flex-wrap gap-1.5">
              {PUBLIC_DAYS.map((d) => (
                <Link key={d} href={`?dias=${d}`} aria-current={d === days ? "page" : undefined} scroll={false}
                  className={cn("rounded-full border px-3 py-1 text-sm", d === days ? "border-brand bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}>
                  Últimos {d} dias
                </Link>
              ))}
            </nav>
            {r.leads.length ? (
              <LeadReviewList token={token} leads={r.leads} />
            ) : (
              <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhum lead nos últimos {days} dias. Quando a agência trouxer os novos, eles aparecem aqui.</p>
            )}
          </>
        )}
      </main>
      <CookieNotice />
    </div>
  );
}
