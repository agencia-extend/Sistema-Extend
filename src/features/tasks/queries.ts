import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export const LIST_SELECT =
  "id, title, type, status, priority, due_at, position, client_id, sector_id, assignee_id, workflow_step_id, board_id, board_column_id, blocked_by_task_id, slot_month, completed_at, created_at, repeat_unit, repeat_every, clients(name), profiles!tasks_assignee_id_fkey(full_name), workflow_steps(name, color, waits_client), task_tags(tags(id, name, color))";

export type TaskRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueAt: string | null;
  position: number;
  clientId: string | null;
  clientName: string | null;
  sectorId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  stepId: string | null;
  stepName: string | null;
  stepColor: string | null;
  waitsClient: boolean;
  boardId: string | null;
  columnId: string | null;
  blocked: boolean;
  completedAt: string | null;
  createdAt: string;
  repeatUnit: string | null;
  repeatEvery: number | null;
  tags: { id: string; name: string; color: string }[];
};

export type Raw = Record<string, unknown> & { [k: string]: unknown };

export function mapRow(t: Raw): TaskRow {
  const step = one(t.workflow_steps as { name: string; color: string; waits_client: boolean } | null);
  return {
    id: t.id as string,
    title: t.title as string,
    type: t.type as string,
    status: t.status as string,
    priority: t.priority as string,
    dueAt: (t.due_at as string) ?? null,
    position: t.position as number,
    clientId: (t.client_id as string) ?? null,
    clientName: one(t.clients as { name: string } | null)?.name ?? null,
    sectorId: (t.sector_id as string) ?? null,
    assigneeId: (t.assignee_id as string) ?? null,
    assigneeName: one(t.profiles as { full_name: string } | null)?.full_name ?? null,
    stepId: (t.workflow_step_id as string) ?? null,
    stepName: step?.name ?? null,
    stepColor: step?.color ?? null,
    waitsClient: step?.waits_client ?? false,
    boardId: (t.board_id as string) ?? null,
    columnId: (t.board_column_id as string) ?? null,
    blocked: Boolean(t.blocked_by_task_id),
    completedAt: (t.completed_at as string) ?? null,
    createdAt: t.created_at as string,
    repeatUnit: (t.repeat_unit as string) ?? null,
    repeatEvery: (t.repeat_every as number) ?? null,
    tags: ((t.task_tags as { tags: { id: string; name: string; color: string } | null }[]) ?? []).flatMap((x) => (x.tags ? [x.tags] : [])),
  };
}

export type TaskFilter = {
  assigneeId?: string;
  clientId?: string;
  sectorId?: string;
  type?: string;
  boardId?: string;
  openOnly?: boolean;
  sinceIso?: string;
  limit?: number;
};

export async function listTasks(f: TaskFilter = {}): Promise<TaskRow[]> {
  const supabase = await createClient();
  let q = supabase.from("tasks").select(LIST_SELECT).is("deleted_at", null);
  if (f.assigneeId) q = q.eq("assignee_id", f.assigneeId);
  if (f.clientId) q = q.eq("client_id", f.clientId);
  if (f.sectorId) q = q.eq("sector_id", f.sectorId);
  if (f.type) q = q.eq("type", f.type);
  if (f.boardId) q = q.eq("board_id", f.boardId);
  if (f.openOnly) q = q.not("status", "in", "(concluido,cancelado)");
  if (f.sinceIso) q = q.or(`due_at.gte.${f.sinceIso},created_at.gte.${f.sinceIso},completed_at.gte.${f.sinceIso}`);
  const { data, error } = await q.order("position").limit(f.limit ?? 500);
  if (error) throw error;
  return (data as unknown as Raw[]).map(mapRow);
}

export const getTask = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `${LIST_SELECT}, description, created_by, waiting_note, repeat_next_id, service_id, start_at, blocker:blocked_by_task_id(id, title, status), creator:profiles!tasks_created_by_fkey(full_name)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const raw = data as unknown as Raw;
  return {
    ...mapRow(raw),
    description: (raw.description as string) ?? "",
    createdBy: raw.created_by as string | null,
    creatorName: one(raw.creator as { full_name: string } | null)?.full_name ?? null,
    waitingNote: (raw.waiting_note as string) ?? "",
    repeatNextId: (raw.repeat_next_id as string) ?? null,
    blocker: one(raw.blocker as { id: string; title: string; status: string } | null),
  };
});

export async function getTaskExtras(id: string) {
  const supabase = await createClient();
  const [checklist, comments, attachments, history, time, participants, activity] = await Promise.all([
    supabase.from("task_checklist_items").select("id, title, done_at, position").eq("task_id", id).order("position").order("created_at"),
    supabase.from("task_comments").select("id, body, created_at, author_id, profiles!task_comments_author_id_fkey(full_name)").eq("task_id", id).order("created_at"),
    supabase.from("task_attachments").select("id, kind, name, storage_path, url, mime_type, size_bytes, uploaded_by, created_at").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("task_stage_history").select("id, step_name, entered_at, left_at, assignee_id, profiles!task_stage_history_assignee_id_fkey(full_name)").eq("task_id", id).order("entered_at"),
    supabase.from("task_time_entries").select("id, started_at, ended_at, profile_id, profiles!task_time_entries_profile_id_fkey(full_name)").eq("task_id", id).order("started_at", { ascending: false }),
    supabase.from("task_participants").select("profile_id").eq("task_id", id),
    supabase.from("task_activity").select("id, title, created_at, profiles!task_activity_actor_id_fkey(full_name)").eq("task_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  return {
    checklist: checklist.data ?? [],
    comments: (comments.data ?? []).map((c) => ({ ...c, author: one(c.profiles)?.full_name ?? "" })),
    attachments: attachments.data ?? [],
    history: (history.data ?? []).map((h) => ({ ...h, assignee: one(h.profiles)?.full_name ?? null })),
    time: (time.data ?? []).map((t) => ({ ...t, person: one(t.profiles)?.full_name ?? "" })),
    participants: (participants.data ?? []).map((p) => p.profile_id),
    activity: (activity.data ?? []).map((a) => ({ ...a, actor: one(a.profiles)?.full_name ?? null })),
  };
}

export type Workflow = { id: string; taskType: string; name: string; boardSectorId: string | null; steps: { id: string; name: string; position: number; sectorId: string | null; status: string; waitsClient: boolean; color: string; isRework: boolean }[] };

export const listWorkflows = cache(async (): Promise<Workflow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflows")
    .select("id, task_type, name, board_sector_id, workflow_steps(id, name, position, sector_id, status, waits_client, color, is_rework, archived_at)")
    .order("name");
  if (error) throw error;
  return data.map((w) => ({
    id: w.id,
    taskType: w.task_type,
    name: w.name,
    boardSectorId: w.board_sector_id,
    steps: (w.workflow_steps ?? [])
      .filter((s) => !s.archived_at)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, name: s.name, position: s.position, sectorId: s.sector_id, status: s.status, waitsClient: s.waits_client, color: s.color, isRework: s.is_rework })),
  }));
});

export async function listTags() {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("id, name, color").order("name");
  return data ?? [];
}

export async function listBoards() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, name, sector_id, archived_at, created_at, board_columns(id)")
    .is("client_id", null)
    .order("archived_at", { nullsFirst: true })
    .order("name");
  if (error) throw error;
  return data;
}

export async function getBoard(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("boards").select("id, name, sector_id, archived_at, board_columns(id, name, position, color, is_done)").eq("id", id).maybeSingle();
  if (!data) return null;
  return { ...data, columns: [...(data.board_columns ?? [])].sort((a, b) => a.position - b.position) };
}

/** Tempo trabalhado (cronômetro aberto da pessoa). */
export async function myRunningTimer(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_time_entries")
    .select("id, task_id, started_at, tasks(title)")
    .eq("profile_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  return data ? { taskId: data.task_id, startedAt: data.started_at, title: one(data.tasks)?.title ?? "" } : null;
}

/** Modelos de demanda ativos (para o "Começar de um modelo"). */
export async function listTemplates(activeOnly = true) {
  const supabase = await createClient();
  let q = supabase.from("task_templates").select("id, name, category, type, description, due_days, priority, repeat_unit, repeat_every, position, is_active");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q.order("position").order("name");
  if (error) throw error;
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    type: t.type,
    description: t.description ?? "",
    dueDays: t.due_days,
    priority: t.priority,
    repeatUnit: t.repeat_unit,
    repeatEvery: t.repeat_every,
    position: t.position,
    isActive: t.is_active,
  }));
}
