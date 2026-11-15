import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Feedback, ReportArea } from "@/domain/reports";

export type ReportRow = {
  id: string;
  clientId: string;
  clientName: string | null;
  area: ReportArea;
  weekOn: string;
  sentOn: string;
  link: string | null;
  notes: string | null;
  sentBy: string | null;
  sentByName: string | null;
  feedback: Feedback | null;
  feedbackNote: string | null;
  feedbackByName: string | null;
  feedbackAt: string | null;
  callTaskId: string | null;
};

export type ReportRoutineRow = {
  clientId: string;
  clientName: string;
  clientCode: number | null;
  area: ReportArea;
  canSend: boolean;
  report: { id: string; sentOn: string; link: string | null; by: string | null; feedback: Feedback | null; feedbackNote: string | null } | null;
  lastSentOn: string | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

const SELECT =
  "id, client_id, area, week_on, sent_on, link, notes, sent_by, feedback, feedback_note, feedback_at, call_task_id, clients(name), sender:profiles!client_reports_sent_by_fkey(full_name), responder:profiles!client_reports_feedback_by_fkey(full_name)";

type Raw = {
  id: string; client_id: string; area: string; week_on: string; sent_on: string; link: string | null; notes: string | null; sent_by: string | null;
  feedback: string | null; feedback_note: string | null; feedback_at: string | null; call_task_id: string | null;
  clients: { name: string } | { name: string }[] | null;
  sender: { full_name: string } | { full_name: string }[] | null;
  responder: { full_name: string } | { full_name: string }[] | null;
};

const map = (r: Raw): ReportRow => ({
  id: r.id,
  clientId: r.client_id,
  clientName: one(r.clients)?.name ?? null,
  area: r.area as ReportArea,
  weekOn: r.week_on,
  sentOn: r.sent_on,
  link: r.link,
  notes: r.notes,
  sentBy: r.sent_by,
  sentByName: one(r.sender)?.full_name ?? null,
  feedback: r.feedback as Feedback | null,
  feedbackNote: r.feedback_note,
  feedbackByName: one(r.responder)?.full_name ?? null,
  feedbackAt: r.feedback_at,
  callTaskId: r.call_task_id,
});

export async function listReports(clientId: string): Promise<ReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_reports").select(SELECT).eq("client_id", clientId).order("week_on", { ascending: false }).limit(104);
  if (error) throw error;
  return ((data ?? []) as Raw[]).map(map);
}

/** Relatórios enviados há até 30 dias que ainda esperam o retorno do cliente. */
export async function listWaiting(since: string): Promise<ReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_reports").select(SELECT).is("feedback", null).gte("sent_on", since).order("sent_on").limit(200);
  if (error) throw error;
  return ((data ?? []) as Raw[]).map(map);
}

export async function getReportRoutine(): Promise<ReportRoutineRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_routine");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    clientCode: r.client_code,
    area: r.area as ReportArea,
    canSend: r.can_send,
    report: r.report_id
      ? { id: r.report_id, sentOn: r.sent_on, link: r.link, by: r.sent_by, feedback: r.feedback as Feedback | null, feedbackNote: r.feedback_note }
      : null,
    lastSentOn: r.last_sent_on,
  }));
}
