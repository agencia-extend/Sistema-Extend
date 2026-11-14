import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { EmptyState } from "@/components/app/states";
import { PROPOSAL_STATUSES, STATUS_LABEL, effectiveStatus, formatDay, type ProposalStatus } from "@/domain/proposals";
import { formatBRL } from "@/domain/shared/money";
import { formatDateTime } from "@/domain/shared/dates";
import { listProposals } from "@/features/proposals/queries";
import { ProposalStatusBadge } from "@/features/proposals/components/status-badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Propostas" };

export default async function PropostasPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [user, sp] = await Promise.all([requirePermission("proposals.read"), searchParams]);
  const all = (await listProposals()).map((p) => ({ ...p, status: effectiveStatus(p.status, p.validUntil) }));
  const filter = PROPOSAL_STATUSES.includes(sp.status as ProposalStatus) ? (sp.status as ProposalStatus) : null;
  const rows = filter ? all.filter((p) => p.status === filter) : all;
  const count = (s: ProposalStatus) => all.filter((p) => p.status === s).length;

  if (all.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nenhuma proposta ainda"
        description={user.permissions["proposals.manage"] ? "Abra um lead e use “Criar proposta”: os dados do lead já entram preenchidos." : "Quando o comercial criar propostas, elas aparecem aqui."}
        action={<Link href="/comercial/leads" className="text-sm font-medium text-primary hover:underline">Ir para os leads</Link>}
      />
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <nav aria-label="Filtrar por status">
        <ul className="flex flex-wrap gap-2">
          {[null, ...PROPOSAL_STATUSES].map((s) => (
            <li key={s ?? "todas"}>
              <Link
                href={s ? `/comercial/propostas?status=${s}` : "/comercial/propostas"}
                aria-current={filter === s ? "page" : undefined}
                className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm", filter === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
              >
                {s ? STATUS_LABEL[s] : "Todas"} <span className="tabular opacity-80">{s ? count(s) : all.length}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">Nenhuma proposta com este status.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">Propostas comerciais</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th scope="col" className="px-3 py-2 font-medium">Nº</th>
                <th scope="col" className="px-3 py-2 font-medium">Cliente</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Mensal</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Valor único</th>
                <th scope="col" className="px-3 py-2 font-medium">Válida até</th>
                <th scope="col" className="px-3 py-2 font-medium">Aberturas</th>
                <th scope="col" className="px-3 py-2 font-medium">Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t align-top [contain-intrinsic-size:auto_56px] [content-visibility:auto]">
                  <td className="px-3 py-2 tabular">{String(p.number).padStart(4, "0")}</td>
                  <td className="px-3 py-2">
                    <Link href={`/comercial/propostas/${p.id}`} className="font-medium hover:underline">{p.clientName}</Link>
                    {p.leadName !== p.clientName && <span className="block text-xs text-muted-foreground">{p.leadName}</span>}
                  </td>
                  <td className="px-3 py-2"><ProposalStatusBadge status={p.status} /></td>
                  <td className="px-3 py-2 text-right tabular">{p.monthlyCents ? formatBRL(p.monthlyCents) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular">{p.oneTimeCents ? formatBRL(p.oneTimeCents) : "—"}</td>
                  <td className="px-3 py-2 tabular">{formatDay(p.validUntil)}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className="block tabular">{p.viewCount}×</span>
                    {p.lastViewedAt && <span className="text-muted-foreground tabular">última {formatDateTime(p.lastViewedAt)}</span>}
                  </td>
                  <td className="px-3 py-2">{p.ownerName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
