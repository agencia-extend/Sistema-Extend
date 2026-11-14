import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { PLAYBOOK_AREAS, PLAYBOOK_AREA_LABEL, durationDays } from "@/domain/playbooks";
import { todayKey } from "@/domain/media";
import { listPlaybooks } from "@/features/playbooks/queries";
import { PlaybookDialog } from "@/features/playbooks/components/playbook-dialog";

export const metadata: Metadata = { title: "Playbooks" };

/** Processos padrão da agência. Aplicar a um cliente cria as demandas e os marcos. */
export default async function PlaybooksPage() {
  const user = await requirePermission(["playbooks.apply", "playbooks.manage"]);
  const manages = Boolean(user.permissions["playbooks.manage"]);
  const playbooks = await listPlaybooks();
  const today = todayKey(new Date());
  const groups = PLAYBOOK_AREAS.map((a) => ({ a, items: playbooks.filter((p) => p.area === a && (p.isActive || manages)) })).filter((g) => g.items.length);

  return (
    <>
      <PageHeader
        title="Playbooks"
        description="Processos padrão da agência. Aplicado a um cliente, o playbook cria todas as demandas com responsável e prazo, e os marcos na linha do tempo. O onboarding de cliente novo continua na ficha do cliente."
        actions={manages ? <PlaybookDialog trigger={<Button><Plus aria-hidden="true" /> Novo playbook</Button>} /> : undefined}
      />
      <PageBody className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-8">
        {groups.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Nenhum playbook ainda"
            description={manages ? "Crie o primeiro com um processo que se repete em vários clientes, como o lançamento de uma campanha ou a entrega de um site." : "Quando a coordenação criar um playbook, ele aparece aqui."}
          />
        ) : (
          groups.map(({ a, items }) => (
            <section key={a} aria-labelledby={`area-${a}`} className="grid gap-3">
              <h2 id={`area-${a}`} className="text-base font-semibold">{PLAYBOOK_AREA_LABEL[a]}</h2>
              <ul className="divide-y rounded-xl border bg-card">
                {items.map((p) => {
                  const steps = p.steps.map((s) => ({ ...s }));
                  const milestones = new Set(p.steps.map((s) => s.milestone).filter(Boolean)).size;
                  return (
                    <li key={p.id}>
                      <Link href={`/playbooks/${p.id}`} className="grid gap-1 px-4 py-3.5 hover:bg-muted/50">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{p.name}</span>
                          {!p.isActive && <Badge variant="secondary">Arquivado</Badge>}
                        </span>
                        {p.description && <span className="line-clamp-2 text-sm text-muted-foreground">{p.description}</span>}
                        <span className="text-xs text-muted-foreground tabular">
                          {p.steps.length} etapa{p.steps.length === 1 ? "" : "s"} · {milestones} marco{milestones === 1 ? "" : "s"} · cerca de {durationDays(today, steps)} dias
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </PageBody>
    </>
  );
}
