import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { listSectors } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Setores" };

/** Lista dos setores que a pessoa pode acompanhar (escopo "setor" = só os seus). */
export default async function SetoresPage() {
  const user = await requirePermission("sector.dashboard.read");
  const sectors = (await listSectors()).filter((s) => s.is_active);
  const mine = user.permissions["sector.dashboard.read"] === "all" ? sectors : sectors.filter((s) => user.sectors.some((x) => x.id === s.id));
  if (mine.length === 1) redirect(`/setores/${mine[0].key}`);
  return (
    <>
      <PageHeader title="Setores" description="Volume do mês, atrasos e demandas por pessoa em cada setor." />
      <PageBody>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não faz parte de nenhum setor. Peça ao administrador para incluir você em Configurações → Usuários.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((s) => (
              <li key={s.id}>
                <Link href={`/setores/${s.key}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-brand/60">
                  <span className="size-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <span className="font-medium">{s.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
