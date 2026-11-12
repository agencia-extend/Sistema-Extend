import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { listSectors } from "@/features/admin/queries";
import { listTasks } from "@/features/tasks/queries";
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
        description="Demandas que estão neste setor agora, de todos os clientes."
      />
      <PageBody>
        <SectorView tasks={all} stats={stats} filters={{ cliente: sp.cliente ?? "", pessoa: sp.pessoa ?? "", etapa: sp.etapa ?? "", tipo: sp.tipo ?? "", periodo: period, situacao: sp.situacao ?? "", visao: sp.visao ?? "lista" }} />
      </PageBody>
    </>
  );
}
