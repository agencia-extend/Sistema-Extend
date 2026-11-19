import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Columns3, List } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listTasks, listTemplates } from "@/features/tasks/queries";
import { listTeam } from "@/features/clients/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { dueState } from "@/domain/tasks";
import { daysAgoMs } from "@/domain/shared/dates";
import { TaskCardView } from "@/features/tasks/components/task-bits";
import { NewTaskDialog } from "@/features/tasks/components/new-task-dialog";
import { StatusBoard } from "@/features/tasks/components/status-board";
import { PersonPicker } from "@/features/tasks/components/person-picker";
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

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Minhas tarefas (RF-TAR-06): em lista (hoje, atrasadas, semana, aguardando, concluídas) ou em quadro no estilo
 * Trello (A fazer, Fazendo, Aguardando aprovação, Concluídas). Quem distribui as demandas vê o quadro de qualquer
 * pessoa ou de todas.
 */
export default async function TarefasPage({ searchParams }: { searchParams: Promise<{ aba?: string; ordem?: string; ver?: string; pessoa?: string }> }) {
  const user = await requirePermission("tasks.read");
  const sp = await searchParams;
  const board = sp.ver === "quadro";
  const tab = (sp.aba && sp.aba in TABS ? sp.aba : "hoje") as keyof typeof TABS;
  const order = sp.ordem === "prioridade" ? "prioridade" : "prazo";
  const canSeeOthers = Boolean(user.permissions["tasks.assign"] || user.permissions["tasks.boards.configure"]);
  const person = canSeeOthers && (sp.pessoa === "todos" || (sp.pessoa && UUID.test(sp.pessoa))) ? sp.pessoa : "eu";
  const who = person === "eu" ? user.id : person === "todos" ? undefined : person;

  const supabase = await createClient();
  const since = new Date(daysAgoMs(14)).toISOString();
  const [mine, done, team, clients, templates] = await Promise.all([
    listTasks({ assigneeId: who, openOnly: true, limit: 800 }),
    board || tab === "concluidas" ? listTasks({ assigneeId: who, sinceIso: board ? since : undefined, limit: 800 }) : Promise.resolve([]),
    listTeam(),
    supabase.from("clients").select("id, name").is("deleted_at", null).in("status", ["ativo", "onboarding"]).order("name"),
    listTemplates(),
  ]);
  const teamOpts = team.map((t) => ({ id: t.id, name: t.name }));
  const viewHref = (ver: "lista" | "quadro") => `?${new URLSearchParams({ ...(ver === "quadro" ? { ver } : {}), ...(person !== "eu" && ver === "quadro" ? { pessoa: person! } : {}) })}`;
  const personName = person === "todos" ? "todas as pessoas" : person !== "eu" ? (team.find((t) => t.id === person)?.name ?? "esta pessoa") : null;

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
  // Quadro: as abertas e as concluídas dos últimos 14 dias.
  const boardTasks = board ? [...mine, ...done.filter((t) => t.status === "concluido" && (t.completedAt ?? "") >= since)] : [];

  return (
    <>
      <PageHeader
        title="Minhas tarefas"
        description={personName ? `Tarefas de ${personName}, com prazo e cliente.` : "Tudo o que está na sua mão, com prazo e cliente."}
        actions={
          <>
            <div role="group" aria-label="Ver como" className="inline-flex rounded-md border p-0.5">
              <Link href={viewHref("lista")} aria-current={!board ? "page" : undefined} className={cn("inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm", !board ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
                <List className="size-4" aria-hidden="true" /> Lista
              </Link>
              <Link href={viewHref("quadro")} aria-current={board ? "page" : undefined} className={cn("inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm", board ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Columns3 className="size-4" aria-hidden="true" /> Quadro
              </Link>
            </div>
            {user.permissions["tasks.manage"] && <NewTaskDialog clients={clients.data ?? []} team={teamOpts} templates={templates} preset={{ assigneeId: user.id }} />}
          </>
        }
      />
      <PageBody className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {board ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Arraste o card para mudar a situação. Demanda de fluxo vai para a etapa certa e passa para quem cuida dela.</p>
              {canSeeOthers && <PersonPicker team={teamOpts} value={person!} />}
            </div>
            {boardTasks.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Nenhuma tarefa aberta" description={personName ? "Ninguém tem tarefa aberta com estes filtros." : "Quando alguém atribuir uma demanda a você, ela aparece aqui."} />
            ) : (
              <StatusBoard tasks={boardTasks} channel={`minhas-${person}`} canMove={Boolean(user.permissions["tasks.manage"])} />
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </PageBody>
    </>
  );
}
