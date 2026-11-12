import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getBoard, getTask, getTaskExtras, listTags, listWorkflows, myRunningTimer } from "@/features/tasks/queries";
import { listTeam } from "@/features/clients/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { TASK_TYPE_LABEL } from "@/domain/tasks";
import { formatDateTime, formatRelative } from "@/domain/shared/dates";
import { Section } from "@/features/clients/components/section";
import { StagePicker } from "./stage-picker";
import { TaskFields } from "./task-fields";
import { TaskDescription } from "./task-description";
import { TaskChecklist } from "./task-checklist";
import { TaskAttachments } from "./task-attachments";
import { TaskComments } from "./task-comments";
import { TaskTime } from "./task-time";
import { TaskEvents } from "./task-events";
import { DeleteTask } from "./delete-task";
import { getContent } from "@/features/media/queries";
import { ContentCard } from "@/features/media/components/content-card";

export const metadata: Metadata = { title: "Demanda" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("tasks.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const task = await getTask(id);
  if (!task) notFound();

  const supabase = await createClient();
  const [content, extras, workflows, board, team, tags, running, related, events] = await Promise.all([
    getContent(id),
    getTaskExtras(id),
    listWorkflows(),
    task.boardId ? getBoard(task.boardId) : Promise.resolve(null),
    listTeam(),
    listTags(),
    myRunningTimer(user.id),
    task.clientId
      ? supabase.from("tasks").select("id, title").eq("client_id", task.clientId).neq("id", id).is("deleted_at", null).not("status", "in", "(concluido,cancelado)").limit(100)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    supabase.from("calendar_events").select("id, title, kind, starts_at, ends_at, location").eq("task_id", id).order("starts_at"),
  ]);

  const wf = workflows.find((w) => w.steps.some((s) => s.id === task.stepId)) ?? workflows.find((w) => w.taskType === task.type);
  const canManage = Boolean(user.permissions["tasks.manage"]);
  const canAssign = Boolean(user.permissions["tasks.assign"]);
  const teamOpts = team.map((t) => ({ id: t.id, name: t.name }));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Minhas tarefas", href: "/tarefas" },
          ...(task.clientId ? [{ label: task.clientName ?? "Cliente", href: `/clientes/${task.clientId}/quadros?tipo=${task.type}` }] : []),
          { label: task.title },
        ]}
        title={task.title}
        description={
          <>
            {TASK_TYPE_LABEL[task.type] ?? task.type}
            {task.clientId && (
              <>
                {" · "}
                <Link href={`/clientes/${task.clientId}`} className="text-primary hover:underline">{task.clientName}</Link>
              </>
            )}
            {" · criada "}
            <span title={formatDateTime(task.createdAt)}>{formatRelative(task.createdAt)}</span>
            {task.creatorName && ` por ${task.creatorName}`}
          </>
        }
        actions={canManage ? <DeleteTask id={id} /> : undefined}
      />
      <PageBody className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-6">
          <StagePicker
            taskId={id}
            canMove={canManage}
            current={board ? task.columnId : task.stepId}
            options={
              board
                ? board.columns.map((c) => ({ id: c.id, name: c.name, color: c.color, kind: "column" as const }))
                : (wf?.steps ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color, kind: "step" as const, waitsClient: s.waitsClient }))
            }
          />
          {content && (
            <ContentCard
              row={{ ...content, taskId: id, index: null, title: task.title, type: task.type, service: TASK_TYPE_LABEL[task.type] ?? task.type, status: task.status, dueAt: task.dueAt, assigneeId: task.assigneeId, assigneeName: task.assigneeName, step: null }}
              team={teamOpts}
              canEdit={canManage}
              canAssign={canAssign}
            />
          )}
          <TaskDescription id={id} value={task.description} canEdit={canManage} />
          <TaskChecklist taskId={id} items={extras.checklist} canEdit={canManage} />
          <TaskAttachments taskId={id} items={extras.attachments} userId={user.id} canManage={canManage} />
          <TaskComments taskId={id} comments={extras.comments} team={teamOpts} userId={user.id} />
        </div>
        <aside className="grid content-start gap-6">
          <TaskFields
            task={{ id, assigneeId: task.assigneeId, dueAt: task.dueAt, priority: task.priority, blockedBy: task.blocker?.id ?? null, waitingNote: task.waitingNote, tags: task.tags }}
            participants={extras.participants}
            team={teamOpts}
            tags={tags}
            related={related.data ?? []}
            canEdit={canManage}
            canAssign={canAssign || canManage}
            blocker={task.blocker}
          />
          <TaskTime taskId={id} running={running} entries={extras.time} history={extras.history} />
          <TaskEvents
            taskId={id}
            clientId={task.clientId}
            events={events.data ?? []}
            team={teamOpts}
            canSchedule={Boolean(user.permissions["calendar.manage"])}
            defaultTitle={`Gravação: ${task.title}`}
          />
          <Section title="Atividade">
            <ol className="grid gap-2 text-sm">
              {extras.activity.map((a) => (
                <li key={a.id} className="grid border-l-2 border-border pl-3">
                  <span>{a.title}</span>
                  <span className="text-xs text-muted-foreground">{[a.actor ?? "Sistema", formatDateTime(a.created_at)].join(" · ")}</span>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </PageBody>
    </>
  );
}
