import type { Metadata } from "next";
import Image from "next/image";
import { getPublicApproval } from "@/features/creatives/public";
import { AssetPreview } from "@/features/creatives/components/asset-preview";
import { formatDateTime } from "@/domain/shared/dates";
import { DecisionForm } from "./decision-form";
import { CookieNotice } from "@/components/app/cookie-notice";

// Link privado: não entra em busca nem passa o endereço a outros sites.
export const metadata: Metadata = { title: "Aprovação", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const CLOSED = {
  substituido: "Este link foi substituído por um mais novo. Peça o link atual à Agência Extend.",
  expirado: "Este link venceu. Peça um novo link à Agência Extend.",
} as const;

/** Página pública do cliente: vê a peça e a copy e aprova ou pede alteração (uma decisão por link). */
export default async function AprovarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await getPublicApproval(token);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-4">
          <Image src="/brand/logo.png" alt="Agência Extend" width={150} height={28} className="h-7 w-auto" priority />
        </div>
        <span className="gold-rule block h-0.5" aria-hidden="true" />
      </header>
      <main className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
        {!a ? (
          <section className="grid gap-2">
            <h1 className="text-2xl font-semibold">Link não encontrado</h1>
            <p className="text-muted-foreground">Confira se copiou o endereço inteiro ou peça um novo link à Agência Extend.</p>
          </section>
        ) : (
          <>
            <header className="grid gap-1">
              <p className="text-sm text-muted-foreground">{a.clientName ? `${a.clientName} · ` : ""}{a.version ? `versão ${a.version}` : ""}</p>
              <h1 className="text-2xl font-semibold text-balance break-words">{a.title}</h1>
              <p className="text-sm text-muted-foreground">A Agência Extend enviou esta peça para você aprovar.</p>
            </header>
            <div className="grid gap-4">{a.assets.map((x) => <AssetPreview key={x.id} name={x.name} url={x.url} mimeType={x.mimeType} />)}</div>
            {(a.copy || a.cta) && (
              <section aria-labelledby="copy" className="grid gap-1">
                <h2 id="copy" className="text-sm font-semibold">Texto do anúncio</h2>
                {a.copy && <p className="rounded-lg border bg-surface p-3 text-sm break-words whitespace-pre-wrap">{a.copy}</p>}
                {a.cta && <p className="text-sm text-muted-foreground">Botão: {a.cta}</p>}
              </section>
            )}
            {a.state === "aberto" ? (
              <DecisionForm token={token} />
            ) : a.decision ? (
              <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
                {a.decision.value === "aprovado" ? "Aprovado" : "Alteração pedida"}{a.decision.name ? ` por ${a.decision.name}` : ""} em {formatDateTime(a.decision.at)}.
                {a.decision.comment && <span className="mt-1 block break-words whitespace-pre-wrap">{a.decision.comment}</span>}
              </p>
            ) : (
              <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{CLOSED[a.state as keyof typeof CLOSED]}</p>
            )}
          </>
        )}
      </main>
      <div className="px-4 pb-6"><CookieNotice /></div>
    </div>
  );
}
