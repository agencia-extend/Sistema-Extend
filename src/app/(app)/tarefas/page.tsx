import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listTasks, listTemplates } from "@/features/tasks/queries";
import { listTeam } from "@/features/clients/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { dueState } from "@/domain/tasks";
import { TaskCardView } from "@/features/tasks/components/task-bits";
import { NewTaskDialog } from "@/features/tasks/components/new-task-dialog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Minhas tarefas" };

const TABS = {
  hoje: "Hoje",
  atrasadas: "Atrasadas",
  semana: "Próximos 7 dias",
  aguardando: "Aguardando outra pessoa",
  todas: "Todas abertas",
  concluidas: "Concluídas",
} as const;

/** Minhas tarefas (RF-TAR-06): hoje, atrasadas, semana, aguardando, concluídas. */
export default async function TarefasPage({ searchParams }: { searchParams: Promise<{ aba?: string; ordem?: string }> }) {
  const user = await requirePermission("tasks.read");
  const sp = await searchParams;
  const tab = (sp.aba && sp.aba in TABS ? sp.aba : "hoje") as keyof typeof TABS;
  const order = sp.ordem === "prioridade" ? "prioridade" : "prazo";

  const supabase = await createClient();
  const [mine, done, team, clients, templates] = await Promise.all([
    listTasks({ assigneeId: user.id, openOnly: true }),
    tab === "concluidas" ? listTasks({ assigneeId: user.id }) : Promise.resolve([]),
    listTeam(),
    supabase.from("clients").select("id, name").is("deleted_at", null).in("status", ["ativo", "onboarding"]).order("name"),
    listTemplates(),
  ]);

  const groups: Record<keyof typeof TABS, typeof mine> = {
    hoje: mine.filter((t) => ["today", "late"].includes(dueState(t.dueAt, t.status))),
    atrasadas: mine.filter((t) => dueState(t.dueAt, t.status) === "late"),
    semana: mine.filter((t) => ["today", "soon", "late"].includes(dueState(t.dueAt, t.status))),
    aguardando: mine.filter((t) => t.blocked || t.waitsClient),
    todas: mine,
    concluidas: done.filter((t) => t.status === "concluido").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 50),
  };
  const PRI = { urgente: 0, alta: 1, media: 2, baixa: 3 } as Record<string, number>;
  const list = [...groups[tab]].sort((a, b) =>
    tab === "concluidas" ? 0 : order === "prioridade" ? (PRI[a.priority] ?? 9) - (PRI[b.priority] ?? 9) : (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"),
  );

  return (
    <>
      <PageHeader
        title="Minhas tarefas"
        description="Tudo o que está na sua mão, com prazo e cliente."
        actions={user.permissions["tasks.manage"] ? <NewTaskDialog clients={clients.data ?? []} team={team.map((t) => ({ id: t.id, name: t.name }))} templates={templates} preset={{ assigneeId: user.id }} /> : undefined}
      />
      <PageBody className="grid gap-4">
        <nav aria-label="Filtro" className="flex gap-1 overflow-x-auto border-b">
          {Object.entries(TABS).map(([k, l]) => (
            <Link
              key={k}
              href={`?aba=${k}${order === "prioridade" ? "&ordem=prioridade" : ""}`}
              aria-current={tab === k ? "page" : undefined}
              className={cn("-mb-px min-h-10 shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap", tab === k ? "border-brand font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {l} {k !== "concluidas" && <span className="tabular text-muted-foreground">({groups[k as keyof typeof TABS].length})</span>}
            </Link>
          ))}
        </nav>
        {tab !== "concluidas" && (
          <p className="text-sm text-muted-foreground">
            Ordenar por{" "}
            <Link href={`?aba=${tab}`} className={cn("hover:underline", order === "prazo" && "font-medium text-foreground")}>prazo</Link>
            {" · "}
            <Link href={`?aba=${tab}&ordem=prioridade`} className={cn("hover:underline", order === "prioridade" && "font-medium text-foreground")}>prioridade</Link>
          </p>
        )}
        {list.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={tab === "atrasadas" ? "Nada atrasado" : "Nada por aqui"}
            description={tab === "hoje" ? "Nenhuma demanda vence hoje. Veja os próximos 7 dias ou todas as abertas." : "Quando alguém atribuir uma demanda a você, ela aparece aqui."}
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => <li key={t.id}><TaskCardView t={t} showStep /></li>)}
          </ul>
        )}
      </PageBody>
    </>
  );
}
