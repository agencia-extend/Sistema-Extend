import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/rate-limit";
import { buttonVariants } from "@/components/ui/button";
import { CookieNotice } from "@/components/app/cookie-notice";
import { buildDoc, totalSummary } from "@/domain/proposals";
import { formatDateTime } from "@/domain/shared/dates";
import { TOKEN_RE, getPublicProposal } from "@/features/proposals/server";
import { ProposalDocument } from "@/features/proposals/components/proposal-document";
import { AcceptForm } from "./accept-form";

// Link privado: não entra em busca nem passa o endereço a outros sites.
export const metadata: Metadata = { title: "Proposta", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Registra a abertura (RF-PRO-04). Quem está logado no sistema (a equipe) não conta. */
async function registerView(token: string) {
  if (!TOKEN_RE.test(token) || !process.env.SUPABASE_SECRET_KEY) return;
  try {
    const { data: claims } = await (await createClient()).auth.getClaims();
    if (claims?.claims?.sub) return;
    const ua = (await headers()).get("user-agent") ?? "";
    await createAdminClient().rpc("proposal_viewed", { p_token: token, p_ip: await clientIp(), p_user_agent: ua });
  } catch (e) {
    console.error("[proposta-visualizada]", (e as Error)?.message);
  }
}

export default async function PropostaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await registerView(token);
  const p = await getPublicProposal(token);
  const doc = p ? buildDoc(p.snapshot) : null;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[794px] items-center justify-between gap-3 px-4 py-3">
          <Image src="/brand/logo.png" alt="Agência Extend" width={150} height={28} className="h-7 w-auto" priority />
          {p && <a href={`/proposta/${token}/pdf`} className={buttonVariants({ variant: "outline", size: "sm" })} download><Download aria-hidden="true" /> Baixar PDF</a>}
        </div>
        <span className="gold-rule block h-0.5" aria-hidden="true" />
      </header>
      <main className="mx-auto grid max-w-[794px] gap-6 px-4 py-6 sm:py-10">
        {!p || !doc ? (
          <section className="grid gap-2">
            <h1 className="font-heading text-2xl font-semibold">Proposta não encontrada</h1>
            <p className="text-muted-foreground">Confira se copiou o endereço inteiro ou peça um novo link à Agência Extend.</p>
          </section>
        ) : (
          <>
            {p.status === "expirada" && (
              <p role="status" className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm font-medium text-warning">
                Esta proposta expirou em {doc.validUntil}. Fale com a Agência Extend para receber uma proposta atualizada.
              </p>
            )}
            {p.status === "recusada" && <p role="status" className="rounded-xl border bg-muted/50 p-4 text-sm">Esta proposta foi encerrada. Fale com a Agência Extend se quiser retomar.</p>}
            {p.status === "aceita" && (
              <p role="status" className="rounded-xl border border-success/40 bg-success-soft p-4 text-sm font-medium text-success">
                Proposta aceita{p.acceptedName ? ` por ${p.acceptedName}` : ""}{p.acceptedAt ? ` em ${formatDateTime(p.acceptedAt)}` : ""}. Obrigado!
              </p>
            )}
            <ProposalDocument doc={doc} images={p.images} standalone />
            {(p.status === "enviada" || p.status === "visualizada") && <AcceptForm token={token} total={totalSummary(doc.totals)} />}
          </>
        )}
      </main>
      <div className="px-4 pb-6"><CookieNotice /></div>
    </div>
  );
}
