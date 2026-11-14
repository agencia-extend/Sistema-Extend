import "server-only";
import { createClient } from "@/lib/supabase/server";
import { LIST_SELECT, mapRow, type Raw, type TaskRow } from "@/features/tasks/queries";
import { todayKey, type Cycle } from "@/domain/media";
import type { ReportMonth, ReportSlot, ReportTask } from "@/domain/media/report";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/** Meses do cliente (ciclo pelo início do contrato), do mais novo para o mais antigo. */
export async function listClientMonths(clientId: string): Promise<Cycle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_months").select("number, starts_on, ends_on").eq("client_id", clientId).order("number", { ascending: false });
  if (error) throw error;
  return data.map((m) => ({ number: m.number, startsOn: m.starts_on, endsOn: m.ends_on }));
}

/** Mês do cliente em que hoje cai (ou o mais recente, se o contrato já acabou). */
export function currentMonth(months: Cycle[], today: string = todayKey()): Cycle | null {
  return months.find((m) => m.startsOn <= today && today <= m.endsOn) ?? months[0] ?? null;
}

export type ContentRow = {
  taskId: string;
  index: number | null;
  title: string;
  type: string;
  service: string;
  status: string;
  dueAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  step: { name: string; color: string } | null;
  format: string | null;
  objective: string;
  script: string;
  caption: string;
  recorderId: string | null;
  recorderName: string | null;
  recordingOn: string | null;
  editorId: string | null;
  editorName: string | null;
  finalUrl: string;
  rawUrl: string;
  postOn: string | null;
  postUrl: string;
  destination: string[];
  reworkCount: number;
};

const CONTENT_SELECT =
  "format, objective, script, caption, recorder_id, recording_on, editor_id, final_url, raw_url, post_on, post_url, destination, rework_count, editor:profiles!task_content_editor_id_fkey(full_name), recorder:profiles!task_content_recorder_id_fkey(full_name)";

type RawContent = {
  format: string | null;
  objective: string | null;
  script: string | null;
  caption: string | null;
  recorder_id: string | null;
  recording_on: string | null;
  editor_id: string | null;
  final_url: string | null;
  raw_url: string | null;
  post_on: string | null;
  post_url: string | null;
  destination: string[] | null;
  rework_count: number | null;
  editor: { full_name: string } | { full_name: string }[] | null;
  recorder: { full_name: string } | { full_name: string }[] | null;
};

/** Conteúdos de um mês do cliente (Controle de Mídias). */
export async function listContents(clientId: string, startsOn: string): Promise<ContentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `id, title, type, status, due_at, slot_index, service_id, assignee_id, profiles!tasks_assignee_id_fkey(full_name), service_catalog(name), workflow_steps(name, color), task_content(${CONTENT_SELECT})`,
    )
    .eq("client_id", clientId)
    .eq("slot_month", startsOn)
    .is("deleted_at", null)
    .order("service_id")
    .order("slot_index");
  if (error) throw error;
  return data.map((t) => {
    const c = one(t.task_content as unknown as RawContent | RawContent[] | null);
    return {
      taskId: t.id,
      index: t.slot_index,
      title: t.title,
      type: t.type,
      service: one(t.service_catalog)?.name ?? "Avulso",
      status: t.status,
      dueAt: t.due_at,
      assigneeId: t.assignee_id,
      assigneeName: one(t.profiles)?.full_name ?? null,
      step: one(t.workflow_steps),
      format: c?.format ?? null,
      objective: c?.objective ?? "",
      script: c?.script ?? "",
      caption: c?.caption ?? "",
      recorderId: c?.recorder_id ?? null,
      recorderName: one(c?.recorder)?.full_name ?? null,
      recordingOn: c?.recording_on ?? null,
      editorId: c?.editor_id ?? null,
      editorName: one(c?.editor)?.full_name ?? null,
      finalUrl: c?.final_url ?? "",
      rawUrl: c?.raw_url ?? "",
      postOn: c?.post_on ?? null,
      postUrl: c?.post_url ?? "",
      destination: c?.destination ?? [],
      reworkCount: c?.rework_count ?? 0,
    };
  });
}

/** Conteúdo de um card (página da demanda). */
export async function getContent(taskId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("task_content").select(CONTENT_SELECT).eq("task_id", taskId).maybeSingle();
  const c = data as unknown as RawContent | null;
  if (!c) return null;
  return {
    format: c.format,
    objective: c.objective ?? "",
    script: c.script ?? "",
    caption: c.caption ?? "",
    recorderId: c.recorder_id,
    recorderName: one(c.recorder)?.full_name ?? null,
    recordingOn: c.recording_on,
    editorId: c.editor_id,
    editorName: one(c.editor)?.full_name ?? null,
    finalUrl: c.final_url ?? "",
    rawUrl: c.raw_url ?? "",
    postOn: c.post_on,
    postUrl: c.post_url ?? "",
    destination: c.destination ?? [],
    reworkCount: c.rework_count ?? 0,
  };
}

export type BoardCard = TaskRow & { editorId: string; editorName: string | null; reworkCount: number; finalUrl: string };

/**
 * Quadro do setor: conteúdos que já têm quem edita/cria, dos tipos que o setor produz.
 * Finalizados somem depois de 30 dias.
 */
export async function listSectorBoard(types: string[]): Promise<BoardCard[]> {
  if (!types.length) return [];
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("tasks")
    .select(`${LIST_SELECT}, task_content!inner(editor_id, rework_count, final_url, editor:profiles!task_content_editor_id_fkey(full_name))`)
    .is("deleted_at", null)
    .in("type", types)
    .neq("status", "cancelado")
    .not("task_content.editor_id", "is", null)
    .or(`completed_at.is.null,completed_at.gte.${since}`)
    .order("position")
    .limit(1000);
  if (error) throw error;
  return (data as unknown as Raw[]).map((t) => {
    const c = one(t.task_content as RawContent | RawContent[] | null)!;
    return { ...mapRow(t), editorId: c.editor_id!, editorName: one(c.editor)?.full_name ?? null, reworkCount: c.rework_count ?? 0, finalUrl: c.final_url ?? "" };
  });
}

/**
 * Dados do Controle Geral: finalizados no período, em aberto agora, mês atual de
 * cada cliente e as demandas desses meses. A RLS decide o que entra.
 */
export async function productionData(fromKey: string, toKey: string): Promise<{ finished: ReportTask[]; open: ReportTask[]; months: ReportMonth[]; slots: ReportSlot[] }> {
  const supabase = await createClient();
  const from = new Date(`${fromKey}T00:00:00-03:00`).toISOString();
  const to = new Date(`${toKey}T23:59:59-03:00`).toISOString();
  const today = todayKey();
  const types = ["video", "design", "conteudo"];
  const sel =
    "id, title, type, status, due_at, client_id, clients(name), workflow_steps(name, color, position), task_content(editor_id, recorder_id, recording_on, rework_count, editor:profiles!task_content_editor_id_fkey(full_name), recorder:profiles!task_content_recorder_id_fkey(full_name))";
  const [finished, open, months] = await Promise.all([
    supabase.from("tasks").select(sel).is("deleted_at", null).eq("status", "concluido").gte("completed_at", from).lte("completed_at", to).in("type", types).limit(5000),
    supabase.from("tasks").select(sel).is("deleted_at", null).not("status", "in", "(concluido,cancelado)").in("type", types).limit(5000),
    supabase.from("client_months").select("client_id, number, starts_on, ends_on").lte("starts_on", today).gte("ends_on", today),
  ]);
  if (finished.error) throw finished.error;
  if (open.error) throw open.error;
  if (months.error) throw months.error;
  const starts = [...new Set(months.data.map((m) => m.starts_on))];
  const slots = starts.length
    ? await supabase.from("tasks").select("client_id, slot_month, status, due_at, clients(name)").is("deleted_at", null).in("slot_month", starts).not("client_id", "is", null).limit(10000)
    : { data: [], error: null };
  if (slots.error) throw slots.error;

  const map = (rows: unknown[]): ReportTask[] =>
    (rows as Raw[]).map((t) => {
      const c = one(t.task_content as RawContent | RawContent[] | null);
      const step = one(t.workflow_steps as { name: string; color: string; position: number } | null);
      return {
        id: t.id as string,
        title: (t.title as string) ?? "",
        type: t.type as string,
        status: t.status as string,
        dueAt: (t.due_at as string) ?? null,
        clientId: (t.client_id as string) ?? null,
        clientName: one(t.clients as { name: string } | null)?.name ?? null,
        stepName: step?.name ?? null,
        stepColor: step?.color ?? "#64748B",
        stepPosition: step?.position ?? 0,
        editorId: c?.editor_id ?? null,
        editorName: one(c?.editor)?.full_name ?? null,
        recorderId: c?.recorder_id ?? null,
        recorderName: one(c?.recorder)?.full_name ?? null,
        recordingOn: c?.recording_on ?? null,
        reworkCount: c?.rework_count ?? 0,
      };
    });
  return {
    finished: map(finished.data),
    open: map(open.data),
    months: months.data.map((m) => ({ clientId: m.client_id, number: m.number, startsOn: m.starts_on, endsOn: m.ends_on })),
    slots: (slots.data ?? []).map((s) => ({ clientId: s.client_id!, clientName: one(s.clients)?.name ?? "", slotMonth: s.slot_month!, status: s.status, dueAt: s.due_at })),
  };
}
