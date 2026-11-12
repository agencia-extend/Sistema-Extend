import Link from "next/link";
import { History } from "lucide-react";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { getClient } from "@/features/clients/queries";
import { listTimeline } from "@/features/clients/queries";
import { EmptyState } from "@/components/app/states";
import { formatDateTime } from "@/domain/shared/dates";
import { cn } from "@/lib/utils";

const KINDS: Record<string, string> = {
  "": "Tudo",
  handoff: "Fechamento",
  onboarding: "Onboarding",
  service: "Serviços",
  member: "Equipe",
  slots: "Demandas do mês",
  status: "Status",
  import: "Importação",
};

/** Linha do tempo do cliente, filtrável (RF-CLI-07). */
export default async function HistoricoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string }> }) {
  await requirePermission("clients.read");
  const { id } = await params;
  if ((await getClient(id))?.status === "onboarding") redirect(`/clientes/${id}`);
  const { tipo = "" } = await searchParams;
  const kind = tipo in KINDS ? tipo : "";
  const items = await listTimeline(id, kind || undefined);

  return (
    <div className="grid max-w-3xl gap-5">
      <nav aria-label="Filtrar histórico" className="flex flex-wrap gap-1.5">
        {Object.entries(KINDS).map(([k, v]) => (
          <Link
            key={k || "tudo"}
            href={k ? `?tipo=${k}` : "?"}
            aria-current={kind === k ? "page" : undefined}
            className={cn("chip rounded-full border px-3 text-sm", kind === k ? "border-brand bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}
          >
            {v}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState icon={History} title="Nada registrado" description="Mudanças de serviço, equipe, status e demandas aparecem aqui." />
      ) : (
        <ol className="grid gap-3">
          {items.map((t) => (
            <li key={t.id} className="grid gap-0.5 border-l-2 border-border pl-4">
              <span className="text-sm">{t.title}</span>
              <span className="text-xs text-muted-foreground">
                {[KINDS[t.kind] ?? t.kind, t.actor ?? "Sistema", formatDateTime(t.created_at)].join(" · ")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
