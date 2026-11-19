import "server-only";
import type { CadenceStep, StepKind } from "@/domain/crm/cadence";
import { createClient } from "@/lib/supabase/server";

export type CadenceTemplate = { id: string; name: string; description: string; isActive: boolean; steps: CadenceStep[] };

export async function listCadences(onlyActive = false): Promise<CadenceTemplate[]> {
  const supabase = await createClient();
  let q = supabase.from("cadence_templates").select("id, name, description, is_active, cadence_steps(position, day_offset, time_of_day, kind, title, message, auto_send)").order("name");
  if (onlyActive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id, name: t.name, description: t.description, isActive: t.is_active,
    steps: [...(t.cadence_steps ?? [])].sort((a, b) => a.position - b.position).map((s) => ({
      day: s.day_offset, time: String(s.time_of_day).slice(0, 5), kind: s.kind as StepKind, title: s.title, message: s.message, auto: s.auto_send,
    })),
  }));
}

export type LeadCadence = { id: string; name: string; status: "ativa" | "pausada" | "concluida" | "cancelada"; reason: string | null; startedAt: string; done: number; total: number };

/** A cadência em andamento do lead (ou a última). */
export async function getLeadCadence(leadId: string): Promise<LeadCadence | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("cadence_enrollments").select("id, template_name, status, reason, started_at").eq("lead_id", leadId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const { data: acts } = await supabase.from("lead_activities").select("done_at").eq("enrollment_id", data.id);
  return {
    id: data.id, name: data.template_name, status: data.status as LeadCadence["status"], reason: data.reason, startedAt: data.started_at,
    done: (acts ?? []).filter((a) => a.done_at).length, total: (acts ?? []).length,
  };
}
