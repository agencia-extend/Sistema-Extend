import "server-only";
import { createClient } from "@/lib/supabase/server";
import { progressOf, type Progress, type TrainingCategory } from "@/domain/trainings";

export type TrainingCard = {
  id: string;
  title: string;
  summary: string | null;
  category: TrainingCategory;
  isPublished: boolean;
  lessons: number;
  minutes: number;
  progress: Progress;
  assignment: { dueOn: string | null; completedAt: string | null } | null;
};

/** Lista de treinamentos com o progresso da pessoa. A RLS esconde rascunhos de quem não gerencia. */
export async function listTrainings(userId: string): Promise<TrainingCard[]> {
  const supabase = await createClient();
  const [trainings, mine, assigned] = await Promise.all([
    supabase.from("trainings").select("id, title, summary, category, is_published, position, training_lessons(id, duration_min)").order("position").order("created_at"),
    supabase.from("training_progress").select("lesson_id").eq("profile_id", userId),
    supabase.from("training_assignments").select("training_id, due_on, completed_at").eq("profile_id", userId),
  ]);
  for (const r of [trainings, mine, assigned]) if (r.error) throw r.error;
  const done = new Set((mine.data ?? []).map((p) => p.lesson_id));
  const byTraining = new Map((assigned.data ?? []).map((a) => [a.training_id, a]));

  return (trainings.data ?? []).map((t) => {
    const lessons = t.training_lessons ?? [];
    const a = byTraining.get(t.id);
    return {
      id: t.id,
      title: t.title,
      summary: t.summary,
      category: t.category as TrainingCategory,
      isPublished: t.is_published,
      lessons: lessons.length,
      minutes: lessons.reduce((s, l) => s + (l.duration_min ?? 0), 0),
      progress: progressOf(lessons.map((l) => l.id), done),
      assignment: a ? { dueOn: a.due_on, completedAt: a.completed_at } : null,
    };
  });
}

export type Lesson = {
  id: string;
  position: number;
  title: string;
  body: string | null;
  videoUrl: string | null;
  filePath: string | null;
  fileName: string | null;
  durationMin: number | null;
};

export type TeamRow = {
  assignmentId: string;
  profileId: string;
  name: string;
  dueOn: string | null;
  assignedAt: string;
  progress: Progress;
};

/** Um treinamento com as aulas, o progresso da pessoa e (para a gestão) o da equipe. */
export async function getTraining(id: string, userId: string, withTeam: boolean) {
  const supabase = await createClient();
  const { data: t, error } = await supabase
    .from("trainings")
    .select("id, title, summary, category, is_published, training_lessons(id, position, title, body, video_url, file_path, file_name, duration_min)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!t) return null;

  const lessons: Lesson[] = [...(t.training_lessons ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((l) => ({ id: l.id, position: l.position, title: l.title, body: l.body, videoUrl: l.video_url, filePath: l.file_path, fileName: l.file_name, durationMin: l.duration_min }));
  const ids = lessons.map((l) => l.id);

  const [mine, myAssignment] = await Promise.all([
    ids.length ? supabase.from("training_progress").select("lesson_id").eq("profile_id", userId).in("lesson_id", ids) : Promise.resolve({ data: [], error: null }),
    supabase.from("training_assignments").select("due_on").eq("training_id", id).eq("profile_id", userId).maybeSingle(),
  ]);
  if (mine.error) throw mine.error;
  if (myAssignment.error) throw myAssignment.error;
  const done = new Set((mine.data ?? []).map((p) => p.lesson_id));

  let team: TeamRow[] = [];
  if (withTeam) {
    const [assignments, progress] = await Promise.all([
      supabase.from("training_assignments").select("id, profile_id, due_on, created_at, profiles!training_assignments_profile_id_fkey(full_name)").eq("training_id", id),
      ids.length ? supabase.from("training_progress").select("lesson_id, profile_id").in("lesson_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);
    if (assignments.error) throw assignments.error;
    if (progress.error) throw progress.error;
    const per = new Map<string, Set<string>>();
    for (const p of progress.data ?? []) {
      const s = per.get(p.profile_id) ?? new Set<string>();
      s.add(p.lesson_id);
      per.set(p.profile_id, s);
    }
    team = (assignments.data ?? [])
      .map((a) => {
        const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        return {
          assignmentId: a.id,
          profileId: a.profile_id,
          name: prof?.full_name ?? "—",
          dueOn: a.due_on,
          assignedAt: a.created_at,
          progress: progressOf(ids, per.get(a.profile_id) ?? new Set()),
        };
      })
      .sort((a, b) => Number(a.progress.complete) - Number(b.progress.complete) || a.name.localeCompare(b.name, "pt-BR"));
  }

  return {
    id: t.id,
    title: t.title,
    summary: t.summary,
    category: t.category as TrainingCategory,
    isPublished: t.is_published,
    lessons,
    done,
    progress: progressOf(ids, done),
    myDueOn: myAssignment.data?.due_on ?? null,
    team,
  };
}

/** Pessoas ativas que podem receber um treinamento. */
export async function listTeamOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, job_title").eq("is_active", true).order("full_name");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name, jobTitle: p.job_title }));
}
