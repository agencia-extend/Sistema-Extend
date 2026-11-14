import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PlaybookArea, StepTaskType } from "@/domain/playbooks";

const arr = <T,>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

export type Step = {
  id: string;
  position: number;
  title: string;
  guidance: string | null;
  offsetDays: number;
  dayKind: "uteis" | "corridos";
  sectorId: string | null;
  sectorName: string | null;
  taskType: StepTaskType;
  milestone: string | null;
};

export type Playbook = { id: string; name: string; area: PlaybookArea; description: string | null; isActive: boolean; steps: Step[] };

type RawStep = { id: string; position: number; title: string; guidance: string | null; offset_days: number; day_kind: string; sector_id: string | null; task_type: string; milestone: string | null; sectors: { name: string } | { name: string }[] | null };

const toStep = (s: RawStep): Step => ({
  id: s.id,
  position: s.position,
  title: s.title,
  guidance: s.guidance,
  offsetDays: s.offset_days,
  dayKind: s.day_kind as Step["dayKind"],
  sectorId: s.sector_id,
  sectorName: arr(s.sectors)[0]?.name ?? null,
  taskType: s.task_type as StepTaskType,
  milestone: s.milestone,
});

const SELECT = "id, name, area, description, is_active, playbook_steps(id, position, title, guidance, offset_days, day_kind, sector_id, task_type, milestone, sectors(name))";

export async function listPlaybooks(): Promise<Playbook[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("playbooks").select(SELECT).order("name");
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    area: p.area as PlaybookArea,
    description: p.description,
    isActive: p.is_active,
    steps: arr(p.playbook_steps as RawStep[]).map(toStep).sort((a, b) => a.position - b.position),
  }));
}

export async function getPlaybook(id: string): Promise<Playbook | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("playbooks").select(SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    area: data.area as PlaybookArea,
    description: data.description,
    isActive: data.is_active,
    steps: arr(data.playbook_steps as RawStep[]).map(toStep).sort((a, b) => a.position - b.position),
  };
}

/** Clientes em que dá para aplicar (ativos ou em onboarding, que a pessoa vê). */
export async function listApplicableClients(): Promise<{ id: string; name: string; code: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name, code").is("deleted_at", null).in("status", ["ativo", "onboarding"]).order("name");
  if (error) throw error;
  return data;
}

export type RunRow = { id: string; name: string; startOn: string; milestones: { id: string; title: string; dueOn: string | null; doneAt: string | null }[] };

/** Playbooks aplicados ao cliente, com os marcos. */
export async function listClientRuns(clientId: string): Promise<RunRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playbook_runs")
    .select("id, playbook_name, start_on, run_milestones(id, title, position, due_on, done_at)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    name: r.playbook_name,
    startOn: r.start_on,
    milestones: arr(r.run_milestones)
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ id: m.id, title: m.title, dueOn: m.due_on, doneAt: m.done_at })),
  }));
}
