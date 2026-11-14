import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { FilePlus2, Handshake, Mail, MessageCircle, Pencil } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { SOURCE_LABEL, formatPhone, slaState, whatsappLink } from "@/domain/crm";
import { formatBRL } from "@/domain/shared/money";
import { formatDateTime } from "@/domain/shared/dates";
import { getLead, listCrmPeople, listPipelines } from "@/features/crm/queries";
import { leadToForm } from "@/features/crm/defaults";
import { ActivityPanel } from "@/features/crm/components/activity-panel";
import { DeleteLead } from "@/features/crm/components/delete-lead";
import { LeadDialog } from "@/features/crm/components/lead-dialog";
import { StagePicker } from "@/features/crm/components/stage-picker";
import { effectiveStatus } from "@/domain/proposals";
import { listProposals } from "@/features/proposals/queries";
import { ProposalStatusBadge } from "@/features/proposals/components/status-badge";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requirePermission("crm.leads.read"), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const canManage = Boolean(user.permissions["crm.leads.manage"]);
  const canHandoff = Boolean(user.permissions["commercial.handoff.create"]);
  const canProposals = Boolean(user.permissions["proposals.read"]);
  const canCreateProposal = Boolean(user.permissions["proposals.manage"]);
  const [lead, pipelines, people, proposals] = await Promise.all([getLead(id), listPipelines(), canManage ? listCrmPeople() : Promise.resolve([]), canProposals ? listProposals(id) : Promise.resolve([])]);
  if (!lead) notFound();
  const pipeline = pipelines.find((p) => p.id === lead.pipelineId);
  const stage = pipeline?.stages.find((s) => s.id === lead.stageId);
  const now = new Date().getTime();
  const sla = stage?.kind === "aberta" ? slaState(lead.stageChangedAt, stage.slaDays, new Date(now)) : null;
  const wa = whatsappLink(lead.phone);
  const utms = Object.entries(lead.utm).filter(([, v]) => v);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Comercial", href: "/comercial" }, { label: "Leads", href: `/comercial/leads?funil=${lead.pipelineId}` }, { label: lead.name }]}
        title={lead.name}
        description={[lead.company, pipeline?.name].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap gap-2">
            {canHandoff && !lead.wonClientId && stage?.kind !== "perdido" && (
              <Link href={`/clientes/novo?lead=${lead.id}`} className={buttonVariants()}><Handshake aria-hidden="true" /> Registrar fechamento</Link>
            )}
            {canCreateProposal && !lead.wonClientId && stage?.kind !== "perdido" && (
              <Link href={`/comercial/propostas/nova?lead=${lead.id}`} className={buttonVariants({ variant: "outline" })}><FilePlus2 aria-hidden="true" /> Criar proposta</Link>
            )}
            {canManage && <LeadDialog initial={leadToForm(lead)} people={people} trigger={<Button variant="outline"><Pencil aria-hidden="true" /> Editar</Button>} />}
            {canManage && !lead.wonClientId && <DeleteLead id={lead.id} name={lead.name} />}
          </div>
        }
      />
      <PageBody className="grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ActivityPanel leadId={lead.id} activities={lead.activities} canEdit={canManage} now={now} />

        <aside className="grid content-start gap-4 lg:order-last">
          <section aria-labelledby="etapa" className="grid gap-2 rounded-xl border bg-card p-4">
            <h2 id="etapa" className="text-sm font-semibold">Etapa</h2>
            {canManage && pipeline ? (
              <StagePicker leadId={lead.id} leadName={lead.name} stageId={lead.stageId} stages={pipeline.stages} canHandoff={canHandoff} won={Boolean(lead.wonClientId)} />
            ) : (
              <p className="text-sm">{stage?.name}</p>
            )}
            {sla && <p className={sla.late ? "text-xs font-medium text-warning" : "text-xs text-muted-foreground"}>{sla.days} dia(s) nesta etapa{stage?.slaDays ? ` · prazo ${stage.slaDays}` : ""}{sla.late ? " · passou do prazo" : ""}</p>}
            {stage?.kind === "perdido" && lead.lostReason && <p className="text-sm break-words">Motivo: {lead.lostReason}</p>}
            {lead.wonClientId && (
              <Link href={`/clientes/${lead.wonClientId}`} className="text-sm font-medium text-primary hover:underline">Ver o cliente em onboarding</Link>
            )}
          </section>

          {canProposals && proposals.length > 0 && (
            <section aria-labelledby="propostas" className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
              <h2 id="propostas" className="text-sm font-semibold">Propostas</h2>
              <ul className="grid gap-2">
                {proposals.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <Link href={`/comercial/propostas/${p.id}`} className="min-w-0 truncate hover:underline">Nº {String(p.number).padStart(4, "0")} · {p.monthlyCents ? `${formatBRL(p.monthlyCents)}/mês` : formatBRL(p.oneTimeCents)}</Link>
                    <ProposalStatusBadge status={effectiveStatus(p.status, p.validUntil)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="dados" className="grid gap-3 rounded-xl border bg-card p-4 text-sm">
            <h2 id="dados" className="text-sm font-semibold">Contato</h2>
            {(wa || lead.email) && (
              <div className="flex flex-wrap gap-2">
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}><MessageCircle aria-hidden="true" /> WhatsApp</a>}
                {lead.email && <a href={`mailto:${lead.email}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Mail aria-hidden="true" /> E-mail</a>}
              </div>
            )}
            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              {lead.phone && <><dt className="text-muted-foreground">Telefone</dt><dd className="tabular">{formatPhone(lead.phone)}</dd></>}
              {lead.email && <><dt className="text-muted-foreground">E-mail</dt><dd className="break-all">{lead.email}</dd></>}
              <dt className="text-muted-foreground">Origem</dt><dd>{SOURCE_LABEL[lead.source]}</dd>
              <dt className="text-muted-foreground">Valor/mês</dt><dd className="tabular">{lead.valueCents != null ? formatBRL(lead.valueCents) : "—"}</dd>
              <dt className="text-muted-foreground">Responsável</dt><dd>{lead.ownerName ?? "—"}</dd>
              <dt className="text-muted-foreground">Entrou em</dt><dd className="tabular">{formatDateTime(lead.createdAt)}</dd>
              {utms.map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">utm_{k}</dt><dd className="break-all">{v}</dd></Fragment>)}
            </dl>
            {lead.notes && <p className="border-t pt-3 break-words whitespace-pre-wrap">{lead.notes}</p>}
          </section>
        </aside>
      </PageBody>
    </>
  );
}
