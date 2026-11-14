import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ContentFormat } from "@/domain/media";

const arr = <T,>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

export type PostRow = {
  taskId: string;
  title: string;
  status: string;
  format: ContentFormat | null;
  caption: string | null;
  postOn: string | null;
  postUrl: string | null;
  finalUrl: string | null;
  coverUrl: string | null;
};

type RawContent = { format: string | null; caption: string | null; post_on: string | null; post_url: string | null; final_url: string | null; cover_path: string | null; destination: string[] };

/**
 * Posts do cronograma no mês: conteúdos com data de post no mês e os marcados para o cronograma
 * ainda sem data. As capas vêm com link assinado (10 minutos).
 */
export async function listSchedule(clientId: string, start: string, end: string): Promise<PostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, task_content!inner(format, caption, post_on, post_url, final_url, cover_path, destination)")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .neq("status", "cancelado")
    .or(`and(post_on.gte.${start},post_on.lte.${end}),and(post_on.is.null,destination.cs.{cronograma})`, { referencedTable: "task_content" });
  if (error) throw error;

  const rows = data.map((t) => ({ t, c: arr(t.task_content as RawContent | RawContent[])[0] })).filter((r) => r.c);
  const paths = rows.map((r) => r.c.cover_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("anexos").createSignedUrls(paths, 600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return rows
    .map(({ t, c }) => ({
      taskId: t.id,
      title: t.title,
      status: t.status,
      format: c.format as ContentFormat | null,
      caption: c.caption,
      postOn: c.post_on,
      postUrl: c.post_url,
      finalUrl: c.final_url,
      coverUrl: c.cover_path ? (signed.get(c.cover_path) ?? null) : null,
    }))
    .sort((a, b) => (a.postOn ?? "9999").localeCompare(b.postOn ?? "9999") || a.title.localeCompare(b.title));
}

export type RecordingRow = {
  id: string;
  recordedOn: string;
  location: string | null;
  rawUrl: string | null;
  notes: string | null;
  createdBy: string | null;
  people: { id: string; name: string }[];
  contents: { id: string; title: string }[];
};

export async function listRecordings(clientId: string): Promise<RecordingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recording_sessions")
    .select("id, recorded_on, location, raw_url, notes, created_by, recording_people(profile_id, profiles(full_name, email)), recording_contents(task_id, tasks(title))")
    .eq("client_id", clientId)
    .order("recorded_on", { ascending: false });
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    recordedOn: s.recorded_on,
    location: s.location,
    rawUrl: s.raw_url,
    notes: s.notes,
    createdBy: s.created_by,
    people: arr(s.recording_people).map((p) => {
      const pr = arr(p.profiles)[0];
      return { id: p.profile_id, name: pr?.full_name || pr?.email || "" };
    }),
    contents: arr(s.recording_contents).map((c) => ({ id: c.task_id, title: arr(c.tasks)[0]?.title ?? "" })),
  }));
}

/** Conteúdos de vídeo/gravação do cliente ainda abertos, para marcar o que foi gravado na diária. */
export async function listRecordableContents(clientId: string): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .in("type", ["video", "gravacao"])
    .not("status", "in", "(concluido,cancelado)")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return data;
}
