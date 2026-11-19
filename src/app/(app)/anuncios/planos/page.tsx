import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { todayKey } from "@/domain/media";
import { PLAN_STATUSES, PLAN_STATUS_LABEL, type PlanStatus } from "@/domain/ads/plans";
import { listPlanClients, listPlans } from "@/features/ads/plan-queries";
import { PlanDialog } from "@/features/ads/components/plans/plan-dialog";
import { PlanList } from "@/features/ads/components/plans/plan-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Planos de campanha" };

/** Planos de campanha de todos os clientes (RF-PLA-01/02): planejado × campanha real, por situação. */
export default async function AnunciosPlanosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(["ads.read"]);
  const sp = await searchParams;
  const today = todayKey(new Date());
  const clientId = typeof sp.cliente === "string" && /^[0-9a-f-]{36}$/.test(sp.cliente) ? sp.cliente : undefined;
  const status = typeof sp.situacao === "string" && (PLAN_STATUSES as readonly string[]).includes(sp.situacao) ? (sp.situacao as PlanStatus) : undefined;
  const canManage = Boolean(user.permissions["optimization.manage"]);
  const [rows, clients] = await Promise.all([listPlans({ clientId, status }, today), canManage ? listPlanClients() : Promise.resolve([])]);
  const manageable = new Set(clients.map((c) => c.id));
  const href = (s?: PlanStatus) => {
    const q = new URLSearchParams();
    if (clientId) q.set("cliente", clientId);
    if (s) q.set("situacao", s);
    const qs = q.toString();
    return qs ? `/anuncios/planos?${qs}` : "/anuncios/planos";
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Situação dos planos" className="flex flex-wrap gap-1">
          {[undefined, ...PLAN_STATUSES].map((s) => (
            <Link key={s ?? "todos"} href={href(s)} aria-current={status === s ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-sm", status === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {s ? PLAN_STATUS_LABEL[s] : "Todos"}
            </Link>
          ))}
        </nav>
        {clients.length > 0 && (
          <PlanDialog today={today} clients={clientId && manageable.has(clientId) ? clients.filter((c) => c.id === clientId) : clients}
            trigger={<Button size="sm"><Plus aria-hidden="true" /> Novo plano</Button>} />
        )}
      </div>
      {rows.length ? (
        <PlanList rows={rows} today={today} showClient={!clientId} manageable={manageable} />
      ) : (
        <EmptyState
          icon={ClipboardList}
          title={status ? `Nenhum plano ${PLAN_STATUS_LABEL[status].toLowerCase()}` : "Nenhum plano de campanha"}
          description={clients.length
            ? "Monte o plano antes de subir a campanha: objetivo, orçamento, público, período e criativos. Com o nome padrão, ele se liga sozinho à campanha quando ela aparecer na conta."
            : "A equipe de tráfego monta aqui os planos de campanha dos clientes."}
        />
      )}
    </>
  );
}
