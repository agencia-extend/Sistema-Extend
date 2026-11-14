import type { Metadata } from "next";
import { CheckCircle2, Download } from "lucide-react";
import { requirePortal } from "@/lib/auth/dal";
import { portalApprovals } from "@/features/portal/queries";
import { AssetPreview } from "@/features/creatives/components/asset-preview";
import { PortalDecision } from "@/features/portal/components/portal-decision";
import { EmptyState } from "@/components/app/states";
import { formatDateTime } from "@/domain/shared/dates";

export const metadata: Metadata = { title: "Aprovações" };

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="grid gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="rounded-lg border bg-surface p-3 text-sm break-words whitespace-pre-wrap">{text}</p>
    </section>
  );
}

/** Conteúdos aguardando o cliente (mesmo fluxo do link de aprovação) e as últimas decisões. */
export default async function PortalApprovalsPage() {
  const { clientId, preview } = await requirePortal();
  const { pending, history } = await portalApprovals(clientId);

  return (
    <>
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold">Aprovações</h1>
        <p className="text-sm text-muted-foreground">Veja cada peça e aprove ou peça alteração. A equipe recebe sua resposta na hora.</p>
      </header>

      {pending.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nada aguardando você" description="Quando a equipe enviar um conteúdo para aprovar, ele aparece aqui e você recebe um aviso." />
      ) : (
        <ul className="grid gap-5">
          {pending.map((p) => (
            <li key={p.task_id}>
              <article aria-labelledby={`t-${p.task_id}`} className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
                <header className="grid gap-0.5">
                  <h2 id={`t-${p.task_id}`} className="text-lg font-semibold text-balance break-words">{p.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {p.step}
                    {p.version ? ` · versão ${p.version}` : ""} · enviado em {formatDateTime(p.since)}
                  </p>
                </header>
                {p.assets.length > 0 && (
                  <div className="grid gap-3">
                    {p.assets.map((a) => (
                      <div key={a.id} className="grid gap-1">
                        <AssetPreview name={a.name} url={a.url} mimeType={a.mimeType} />
                        {a.isFile && (
                          <a href={`/portal/arquivo/versao/${a.id}?baixar`} className="inline-flex min-h-8 w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
                            <Download className="size-3.5" aria-hidden="true" /> Baixar {a.name}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {p.script && <TextBlock title="Roteiro" text={p.script} />}
                {p.caption && <TextBlock title="Legenda" text={p.caption} />}
                {p.copy && <TextBlock title="Texto do anúncio" text={p.copy} />}
                {p.cta && <p className="text-sm text-muted-foreground">Botão do anúncio: {p.cta}</p>}
                <PortalDecision taskId={p.task_id} title={p.title} preview={preview} />
              </article>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <section aria-labelledby="historico" className="grid gap-3">
          <h2 id="historico" className="text-base font-semibold">Decisões recentes</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {history.map((d, i) => (
              <li key={i} className="grid gap-0.5 px-4 py-3 text-sm">
                <span className="font-medium break-words">{d.title}</span>
                <span className={d.decision === "aprovado" ? "text-success" : "text-warning"}>
                  {d.decision === "aprovado" ? "Aprovado" : "Alteração pedida"}
                  {d.name ? ` por ${d.name}` : ""} em {formatDateTime(d.decided_at)}
                </span>
                {d.comment && <span className="break-words whitespace-pre-wrap text-muted-foreground">{d.comment}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
