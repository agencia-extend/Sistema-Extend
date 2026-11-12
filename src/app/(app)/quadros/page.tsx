import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { listBoards } from "@/features/tasks/queries";
import { listSectors } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { BoardDialog } from "./board-dialog";

export const metadata: Metadata = { title: "Quadros" };

/** Quadros livres com colunas próprias (internos, campanhas, mutirões). */
export default async function QuadrosPage() {
  const user = await requirePermission("tasks.read");
  const [boards, sectors] = await Promise.all([listBoards(), listSectors()]);
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));
  const canConfigure = Boolean(user.permissions["tasks.boards.configure"]);
  const active = boards.filter((b) => !b.archived_at);
  const archived = boards.filter((b) => b.archived_at);
  return (
    <>
      <PageHeader
        title="Quadros"
        description="Quadros livres, com colunas próprias. Os quadros de cada cliente ficam no ambiente do cliente, na aba Quadros."
        actions={canConfigure ? <BoardDialog sectors={sectors.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }))} /> : undefined}
      />
      <PageBody className="grid gap-6">
        {active.length === 0 ? (
          <EmptyState icon={LayoutDashboard} title="Nenhum quadro livre" description={canConfigure ? "Crie um quadro para demandas internas da agência." : "Ainda não há quadros livres."} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((b) => (
              <li key={b.id}>
                <Link href={`/quadros/${b.id}`} className="grid gap-1 rounded-xl border bg-card p-4 hover:border-brand/60">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs text-muted-foreground">{[b.sector_id ? sectorName.get(b.sector_id) : null, `${b.board_columns.length} colunas`].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {archived.length > 0 && (
          <section className="grid gap-2" aria-label="Arquivados">
            <h2 className="text-sm font-semibold text-muted-foreground">Arquivados</h2>
            <ul className="flex flex-wrap gap-2">{archived.map((b) => <li key={b.id}><Link href={`/quadros/${b.id}`} className="chip rounded-full border px-3 text-sm hover:bg-muted">{b.name}</Link></li>)}</ul>
          </section>
        )}
      </PageBody>
    </>
  );
}
