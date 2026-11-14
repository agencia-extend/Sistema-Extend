import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Handshake, Pencil } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { FormAlert } from "@/components/app/form-field";
import { buttonVariants } from "@/components/ui/button";
import { buildDoc, effectiveStatus, fillVariables, formatDay, variablesFor } from "@/domain/proposals";
import { formatBRL } from "@/domain/shared/money";
import { formatDateTime } from "@/domain/shared/dates";
import { getProposal, getSnapshot } from "@/features/proposals/queries";
import { signBlockImages } from "@/features/proposals/server";
import { ProposalDocument } from "@/features/proposals/components/proposal-document";
import { ProposalStatusBadge } from "@/features/proposals/components/status-badge";
import { SendPanel } from "@/features/proposals/components/send-panel";
import { DeleteProposal, RefuseProposal } from "@/features/proposals/components/proposal-actions";

export const metadata: Metadata = { title: "Proposta" };

export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requirePermission("proposals.read"), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await getProposal(id);
  if (!p) notFound();
  const supabase = await createClient();
  const [snap, tpl] = await Promise.all([
    getSnapshot(id, p.version),
    p.templateId ? supabase.from("proposal_templates").select("whatsapp_message").eq("id", p.templateId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!snap) notFound();
  const images = await signBlockImages(supabase, snap.blocks);
  const status = effectiveStatus(p.status, p.validUntil);
  const canManage = Boolean(user.permissions["proposals.manage"]);
  const canHandoff = Boolean(user.permissions["commercial.handoff.create"]);
  const number = String(p.number).padStart(4, "0");
  const link = p.sentVersion != null ? `${publicEnv.NEXT_PUBLIC_SITE_URL}/proposta/${p.publicToken}` : null;
  const message = fillVariables(tpl.data?.whatsapp_message ?? "Olá, {contato}! Segue a proposta da Agência Extend: {link}", variablesFor(snap));
  const blockedSend = status === "aceita" ? "Proposta aceita: não pode mais ser alterada nem reenviada." : status === "expirada" ? "A proposta venceu. Edite a validade e salve para enviar de novo." : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Comercial", href: "/comercial" }, { label: "Propostas", href: "/comercial/propostas" }, { label: `Nº ${number}` }]}
        title={`Proposta nº ${number} · ${p.clientName}`}
        description={<span className="flex flex-wrap items-center gap-2"><ProposalStatusBadge status={status} /> Válida até {formatDay(p.validUntil)} · versão {p.version}{p.sentVersion ? ` (cliente vê a ${p.sentVersion})` : ""}</span>}
        actions={
          <div className="flex flex-wrap gap-2">
            {status === "aceita" && canHandoff && !p.leadWonClientId && (
              <Link href={`/clientes/novo?lead=${p.leadId}&proposta=${p.id}`} className={buttonVariants()}><Handshake aria-hidden="true" /> Registrar fechamento</Link>
            )}
            {canManage && status !== "aceita" && <Link href={`/comercial/propostas/${p.id}/editar`} className={buttonVariants()}><Pencil aria-hidden="true" /> Editar</Link>}
            <a href={`/api/propostas/${p.id}/pdf?baixar`} className={buttonVariants({ variant: "outline" })} download><Download aria-hidden="true" /> Baixar PDF</a>
            {canManage && (status === "enviada" || status === "visualizada" || status === "expirada") && <RefuseProposal id={p.id} />}
            {canManage && status === "rascunho" && <DeleteProposal id={p.id} />}
          </div>
        }
      />
      <PageBody className="grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-4">
          {status === "aceita" && (
            <FormAlert tone="success">
              Aceita por {p.acceptedName} em {formatDateTime(p.acceptedAt!)}. O lead foi para Ganho.
              {p.leadWonClientId ? <> <Link href={`/clientes/${p.leadWonClientId}`} className="font-medium underline">Ver o cliente</Link>.</> : canHandoff ? " Registre o fechamento para o cliente entrar em onboarding." : ""}
            </FormAlert>
          )}
          {status === "recusada" && p.refusedReason && <FormAlert tone="info">Recusada: {p.refusedReason}</FormAlert>}
          <ProposalDocument doc={buildDoc(snap)} images={images} />
        </div>

        <aside className="grid content-start gap-4">
          {canManage && <SendPanel id={p.id} phone={p.contactPhone} message={message} link={link} pendingVersion={p.sentVersion !== p.version} disabled={blockedSend} />}

          <section aria-labelledby="acompanhamento" className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
            <h2 id="acompanhamento" className="font-semibold">Acompanhamento</h2>
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              <dt className="text-muted-foreground">Lead</dt><dd><Link href={`/comercial/leads/${p.leadId}`} className="text-primary hover:underline">{p.leadName}</Link></dd>
              <dt className="text-muted-foreground">Vendedor</dt><dd>{p.ownerName ?? "—"}</dd>
              <dt className="text-muted-foreground">Enviada em</dt><dd className="tabular">{p.sentAt ? formatDateTime(p.sentAt) : "Ainda não"}</dd>
              <dt className="text-muted-foreground">Aberturas</dt><dd className="tabular">{p.viewCount}</dd>
              {p.firstViewedAt && <><dt className="text-muted-foreground">Primeira</dt><dd className="tabular">{formatDateTime(p.firstViewedAt)}</dd></>}
              {p.lastViewedAt && <><dt className="text-muted-foreground">Última</dt><dd className="tabular">{formatDateTime(p.lastViewedAt)}</dd></>}
            </dl>
            {p.views.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Todas as aberturas</summary>
                <ol className="mt-2 grid gap-1">{p.views.map((v, i) => <li key={i} className="tabular">{formatDateTime(v.at)}{v.version ? ` · versão ${v.version}` : ""}</li>)}</ol>
              </details>
            )}
          </section>

          <section aria-labelledby="versoes" className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
            <h2 id="versoes" className="font-semibold">Versões</h2>
            <ol className="grid gap-2">
              {p.versions.map((v) => (
                <li key={v.version} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-medium">Versão {v.version}</span>
                    {v.version === p.sentVersion && <span className="ml-1.5 rounded-full bg-info-soft px-2 text-xs text-info">enviada</span>}
                    <span className="block text-xs text-muted-foreground tabular">{formatDateTime(v.createdAt)}{v.author ? ` · ${v.author}` : ""}</span>
                    <span className="block text-xs tabular">{[v.monthlyCents ? `${formatBRL(v.monthlyCents)}/mês` : null, v.oneTimeCents ? `${formatBRL(v.oneTimeCents)} único` : null].filter(Boolean).join(" + ")}</span>
                  </span>
                  <a href={`/api/propostas/${p.id}/pdf?versao=${v.version}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-primary hover:underline">PDF<span className="sr-only"> da versão {v.version}</span></a>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </PageBody>
    </>
  );
}
