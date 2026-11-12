import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { listSectors } from "@/features/admin/queries";
import Link from "next/link";
import { listTasks, listWorkflows } from "@/features/tasks/queries";
import { listSectorBoard } from "@/features/media/queries";
import { cn } from "@/lib/utils";
import { SectorBoard } from "./sector-board";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { currentMonthKey, daysAgoMs } from "@/domain/shared/dates";
import { dueState } from "@/domain/tasks";
import { SectorView } from "./sector-view";

export const metadata: Metadata = { title: "Visão do setor" };

/** Visão do setor (RF-TAR-07/09): contadores do mês, atrasos, por pessoa e por cliente, com filtros. */
export default async function SetorPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("sector.dashboard.read");
  const { key } = await params;
  const sp = await searchParams;
  const sector = (await listSectors()).find((s) => s.key === key);
  if (!sector) notFound();
  if (user.permissions["sector.dashboard.read"] !== "all" && !user.sectors.some((s) => s.id === sector.id)) redirect("/sem-acesso");

  // Setores que produzem conteúdo (Edição, Design) abrem no quadro; os demais, na lista.
  const flows = (await listWorkflows()).filter((w) => w.boardSectorId === sector.id);
  // Um link com filtro da lista (ex.: atrasadas de uma pessoa) abre a lista, mesmo sem ?visao=lista.
  const listFilter = Boolean(sp.cliente || sp.pessoa || sp.etapa || sp.tipo || sp.situacao || sp.periodo);
  const view = flows.length > 0 && sp.visao !== "lista" && !listFilter ? "quadro" : "lista";
  const cards = view === "quadro" ? await listSectorBoard(flows.map((w) => w.taskType)) : [];

  const period = sp.periodo && ["hoje", "7", "30"].includes(sp.periodo) ? sp.periodo : "";
  const all = await listTasks({ sectorId: sector.id, sinceIso: period ? new Date(daysAgoMs(period === "hoje" ? 1 : Number(period))).toISOString() : undefined, limit: 1000 });
  const month = currentMonthKey();
  const monthTasks = all.filter((t) => (t.dueAt ?? t.createdAt).slice(0, 7) === month && t.status !== "cancelado");
  const stats = {
    month: monthTasks.length,
    done: monthTasks.filter((t) => t.status === "concluido" || t.status === "aprovado").length,
    late: all.filter((t) => dueState(t.dueAt, t.status) === "late").length,
    waiting: all.filter((t) => t.waitsClient && t.status !== "concluido").length,
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Setores", href: "/setores" }, { label: sector.name }]}
        title={sector.name}
        description={view === "quadro" ? "Conteúdos de todos os clientes que já têm quem edita ou cria. Arraste o card para mudar a etapa." : "Demandas que estão neste setor agora, de todos os clientes."}
      />
      <PageBody className="grid gap-4">
        {flows.length > 0 && (
          <nav aria-label="Visão" className="flex w-fit rounded-lg border p-0.5">
            {([["quadro", "Quadro"], ["lista", "Lista"]] as const).map(([k, l]) => (
              <Link key={k} href={k === "quadro" ? `/setores/${key}` : `/setores/${key}?visao=lista`} aria-current={view === k ? "page" : undefined}
                className={cn("chip rounded-md px-3 text-sm", view === k ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</Link>
            ))}
          </nav>
        )}
        {view === "quadro" ? (
          <SectorBoard cards={cards} flows={flows} sectorId={sector.id} sectorKey={sector.key} canMove={Boolean(user.permissions["tasks.manage"])} />
        ) : (
        <SectorView tasks={all} stats={stats} filters={{ cliente: sp.cliente ?? "", pessoa: sp.pessoa ?? "", etapa: sp.etapa ?? "", tipo: sp.tipo ?? "", periodo: period, situacao: sp.situacao ?? "", visao: sp.visao ?? "lista" }} />
        )}
      </PageBody>
    </>
  );
}
