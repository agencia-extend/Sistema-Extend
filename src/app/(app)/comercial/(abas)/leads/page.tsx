import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { EmptyState, NoResults } from "@/components/app/states";
import { SOURCE_LABEL, formatPhone, normalizePhone, slaState } from "@/domain/crm";
import { formatBRL } from "@/domain/shared/money";
import { formatDateTime } from "@/domain/shared/dates";
import { listCrmPeople, listLeads, listPipelines } from "@/features/crm/queries";
import { blankLead, pickPipeline } from "@/features/crm/defaults";
import { LeadDialog } from "@/features/crm/components/lead-dialog";
import { LeadFilters } from "@/features/crm/components/lead-filters";
import { PipelineSwitch } from "@/features/crm/components/pipeline-switch";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads" };

type Search = { funil?: string; q?: string; etapa?: string; origem?: string; resp?: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [user, sp] = await Promise.all([requirePermission("crm.leads.read"), searchParams]);
  const pipelines = await listPipelines();
  const pipeline = pickPipeline(pipelines, sp.funil);
  if (!pipeline) return <EmptyState icon={Target} title="Nenhum funil configurado" description="Crie um funil em Configurações › Funis comerciais." />;
  const canManage = Boolean(user.permissions["crm.leads.manage"]);
  const [all, people] = await Promise.all([listLeads(pipeline.id), canManage ? listCrmPeople() : Promise.resolve([])]);
  const stage = new Map(pipeline.stages.map((s) => [s.id, s]));
  const now = new Date();

  const term = fold(sp.q?.trim() ?? "");
  const digits = normalizePhone(term) ?? term.replace(/\D/g, "");
  const leads = all.filter(
    (l) =>
      (!term || fold(`${l.name} ${l.company ?? ""} ${l.email ?? ""}`).includes(term) || (digits.length >= 4 && (l.phone ?? "").includes(digits))) &&
      (!sp.etapa || l.stageId === sp.etapa) &&
      (!sp.origem || l.source === sp.origem) &&
      (!sp.resp || l.ownerId === sp.resp),
  );
  const owners = [...new Map(all.filter((l) => l.ownerId).map((l) => [l.ownerId!, l.ownerName ?? ""])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <PipelineSwitch value={pipeline.id} pipelines={pipelines} />
        {canManage && <LeadDialog initial={blankLead(pipeline)} people={people} trigger={<Button><Plus aria-hidden="true" /> Novo lead</Button>} />}
      </div>
      {all.length === 0 ? (
        <EmptyState icon={Target} title="Nenhum lead neste funil" description={canManage ? "Cadastre o primeiro lead ou importe sua planilha de contatos na aba Importar." : "Quando o comercial cadastrar leads, eles aparecem aqui."} />
      ) : (
        <>
          <LeadFilters stages={pipeline.stages.map((s) => ({ id: s.id, name: s.name }))} people={owners} />
          {leads.length === 0 ? (
            <NoResults query={sp.q} />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[820px] text-sm">
                <caption className="sr-only">Leads do funil {pipeline.name}</caption>
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th scope="col" className="px-3 py-2 font-medium">Lead</th>
                    <th scope="col" className="px-3 py-2 font-medium">Contato</th>
                    <th scope="col" className="px-3 py-2 font-medium">Etapa</th>
                    <th scope="col" className="px-3 py-2 font-medium">Origem</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                    <th scope="col" className="px-3 py-2 font-medium">Responsável</th>
                    <th scope="col" className="px-3 py-2 font-medium">Próxima ação</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => {
                    const s = stage.get(l.stageId);
                    const sla = s?.kind === "aberta" ? slaState(l.stageChangedAt, s.slaDays, now) : null;
                    const late = l.nextAction && new Date(l.nextAction.dueAt) < now;
                    return (
                      <tr key={l.id} className="border-t align-top [contain-intrinsic-size:auto_64px] [content-visibility:auto]">
                        <td className="px-3 py-2">
                          <Link href={`/comercial/leads/${l.id}`} className="font-medium hover:underline">{l.name}</Link>
                          {l.company && <span className="block text-xs text-muted-foreground">{l.company}</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {l.phone && <span className="block tabular">{formatPhone(l.phone)}</span>}
                          {l.email && <span className="block break-all text-muted-foreground">{l.email}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5"><span className="size-2 shrink-0 rounded-full" style={{ background: s?.color }} aria-hidden="true" />{s?.name}</span>
                          {sla && <span className={cn("block text-xs tabular", sla.late ? "font-medium text-warning" : "text-muted-foreground")}>{sla.days} dia(s){sla.late ? " · passou do prazo" : ""}</span>}
                          {s?.kind === "perdido" && l.lostReason && <span className="block text-xs text-muted-foreground">{l.lostReason}</span>}
                        </td>
                        <td className="px-3 py-2">{SOURCE_LABEL[l.source]}</td>
                        <td className="px-3 py-2 text-right tabular">{l.valueCents != null ? formatBRL(l.valueCents) : "—"}</td>
                        <td className="px-3 py-2">{l.ownerName ?? "—"}</td>
                        <td className={cn("px-3 py-2 text-xs", late ? "font-medium text-danger" : "text-muted-foreground")}>
                          {l.nextAction ? <><span className="block tabular">{formatDateTime(l.nextAction.dueAt)}</span><span className="line-clamp-2 break-words">{l.nextAction.body}</span></> : s?.kind === "aberta" ? "Sem próxima ação" : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t px-3 py-2 text-xs text-muted-foreground tabular">{leads.length} de {all.length} lead(s)</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
