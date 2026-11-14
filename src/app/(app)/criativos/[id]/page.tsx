import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCreative } from "@/features/creatives/queries";
import { DeliveryUpload } from "@/features/creatives/components/delivery-upload";
import { AssetPreview } from "@/features/creatives/components/asset-preview";
import { ReviewActions } from "@/features/creatives/components/review-actions";
import { ApprovalLinkPanel } from "@/features/creatives/components/approval-link-panel";
import { DeliveryComment } from "@/features/creatives/components/delivery-comment";
import { CREATIVE_FORMAT_LABEL, CREATIVE_OBJECTIVE_LABEL, linkState, reviewActions, type CreativeObjective } from "@/domain/creatives";
import { PRIORITY_LABEL } from "@/domain/tasks";
import { formatDate, formatDateTime } from "@/domain/shared/dates";

export const metadata: Metadata = { title: "Criativo" };

const LINK_STATE = { aberto: "Aguardando o cliente", usado: "Decidido", substituido: "Substituído por um link novo", expirado: "Vencido" } as const;

export default async function CriativoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [user, c] = await Promise.all([getCurrentUser(), getCreative(id)]);
  if (!c || !user) notFound();
  const r = c.request;
  const isRequester = r.requestedBy === user.id;
  const canReview = isRequester || Boolean(user.permissions["creatives.review"]);
  const canProduce = c.assigneeId === user.id || Boolean(user.permissions["tasks.manage"]);
  const step = c.step?.name ?? null;
  const producing = step === "Solicitado" || step === "Em produção" || step === "Ajustes solicitados";
  const actions = canReview ? reviewActions(step) : [];
  const rows: [string, string][] = [
    ["Campanha", r.campaign],
    ["Objetivo", CREATIVE_OBJECTIVE_LABEL[r.objective as CreativeObjective] ?? r.objective],
    ["Formato", `${CREATIVE_FORMAT_LABEL[r.format]} · ${r.quantity} peça(s)${r.variations ? ` + ${r.variations} variação(ões)` : ""}`],
    ["Público", r.audience],
    ["CTA", r.cta],
    ["Prazo", c.dueAt ? formatDate(c.dueAt) : "—"],
    ["Prioridade", PRIORITY_LABEL[c.priority] ?? c.priority],
    ["Quem pediu", r.requesterName ?? "—"],
    ["Quem produz", c.assigneeName ?? "Sem responsável"],
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid content-start gap-5">
        <header className="grid gap-1.5">
          <p className="text-sm text-muted-foreground"><Link href={`/clientes/${c.clientId}`} className="hover:underline">{c.clientName}</Link></p>
          <h2 className="text-xl font-semibold text-balance break-words">{r.angle}</h2>
          {c.step && <span className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm"><span className="size-2 rounded-full" style={{ background: c.step.color }} aria-hidden="true" />{c.step.name}</span>}
        </header>

        {actions.length > 0 && (
          <section aria-labelledby="decidir" className="grid gap-2 rounded-xl border bg-card p-4">
            <h3 id="decidir" className="text-sm font-semibold">{step === "Em revisão" ? "Revise a última versão" : step === "Aprovação do cliente" ? "Aguardando o cliente" : "Próximo passo"}</h3>
            <ReviewActions taskId={c.id} actions={actions} />
          </section>
        )}

        {step === "Aprovação do cliente" && canReview && (
          <section aria-labelledby="link-cliente" className="grid gap-2 rounded-xl border bg-card p-4">
            <h3 id="link-cliente" className="text-sm font-semibold">Link para o cliente aprovar</h3>
            <ApprovalLinkPanel taskId={c.id} clientName={c.clientName} title={r.angle} />
          </section>
        )}

        {canProduce && producing && <DeliveryUpload taskId={c.id} nextVersion={(c.deliveries[0]?.version ?? 0) + 1} />}

        <section aria-labelledby="versoes" className="grid gap-3">
          <h3 id="versoes" className="text-base font-semibold">Versões</h3>
          {c.deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma versão enviada ainda.</p>
          ) : (
            <ol aria-label="Versões do criativo" className="grid gap-3">
              {c.deliveries.map((d) => (
                <li key={d.id} className="grid gap-3 rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">v{d.version}</span>
                    <span className="text-xs text-muted-foreground">{[d.author, formatDateTime(d.createdAt)].filter(Boolean).join(" · ")}</span>
                  </div>
                  {d.note && <p className="text-sm break-words whitespace-pre-line">{d.note}</p>}
                  <div className="grid gap-3">{d.assets.map((a) => <AssetPreview key={a.id} name={a.name} url={a.url} mimeType={a.mimeType} />)}</div>
                  {d.comments.length > 0 && (
                    <ul className="grid gap-1.5 border-t pt-2">
                      {d.comments.map((cm) => <li key={cm.id} className="text-sm"><span className="font-medium">{cm.author}:</span> <span className="break-words">{cm.body}</span></li>)}
                    </ul>
                  )}
                  <DeliveryComment deliveryId={d.id} taskId={c.id} version={d.version} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside className="grid content-start gap-4">
        <section aria-labelledby="pedido" className="grid gap-2 rounded-xl border bg-card p-4">
          <h3 id="pedido" className="text-sm font-semibold">Pedido</h3>
          <dl className="grid gap-1.5 text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 text-right break-words">{v}</dd></div>)}
          </dl>
          {r.copySuggestion && <div className="grid gap-1 border-t pt-2"><span className="text-xs text-muted-foreground">Copy sugerida</span><p className="text-sm break-words whitespace-pre-line">{r.copySuggestion}</p></div>}
          {r.references.length > 0 && (
            <ul className="grid gap-1 border-t pt-2" aria-label="Referências">
              {r.references.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-primary hover:underline"><ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{u}</span></a></li>)}
            </ul>
          )}
          {r.notes && <p className="border-t pt-2 text-sm break-words whitespace-pre-line text-muted-foreground">{r.notes}</p>}
        </section>
        {c.links.length > 0 && (
          <section aria-labelledby="links" className="grid gap-2 rounded-xl border bg-card p-4">
            <h3 id="links" className="text-sm font-semibold">Aprovação do cliente</h3>
            <ol className="grid gap-2">
              {c.links.map((l) => {
                const st = linkState(l);
                return (
                  <li key={l.id} className="grid gap-0.5 text-sm">
                    <span className="font-medium">{l.decision === "aprovado" ? "Aprovado pelo cliente" : l.decision === "ajustes" ? "Cliente pediu alteração" : LINK_STATE[st]}</span>
                    <span className="text-xs text-muted-foreground">{l.decidedAt ? `${l.reviewerName ?? "Cliente"} · ${formatDateTime(l.decidedAt)}` : `Link de ${formatDateTime(l.createdAt)}`}</span>
                    {l.comment && <span className="break-words text-muted-foreground">“{l.comment}”</span>}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </aside>
    </div>
  );
}
