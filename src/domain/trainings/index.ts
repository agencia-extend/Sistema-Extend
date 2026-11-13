// Regras puras dos treinamentos: categorias, vídeo incorporado, progresso e prazo.

export const TRAINING_CATEGORIES = ["sistema", "processos", "trafego", "conteudo", "design", "video", "comercial", "atendimento", "geral"] as const;
export type TrainingCategory = (typeof TRAINING_CATEGORIES)[number];

export const TRAINING_CATEGORY_LABEL: Record<TrainingCategory, string> = {
  sistema: "Sistema Extend",
  processos: "Processos da agência",
  trafego: "Tráfego pago",
  conteudo: "Conteúdo e social media",
  design: "Design",
  video: "Vídeo e gravação",
  comercial: "Comercial",
  atendimento: "Atendimento",
  geral: "Geral",
};

export type VideoEmbed = { provider: "YouTube" | "Loom" | "Google Drive" | "Vimeo"; src: string };

/**
 * Converte o link de vídeo em endereço de incorporação. Links que não são de um
 * serviço conhecido viram só link (null), para não abrir qualquer site num iframe.
 */
export function videoEmbed(raw: string | null | undefined): VideoEmbed | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const id = (s: string | null | undefined) => (s && /^[\w-]{6,64}$/.test(s) ? s : null);

  if (host === "youtube.com" || host === "youtu.be") {
    const v = host === "youtu.be" ? u.pathname.slice(1) : u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : u.searchParams.get("v");
    return id(v) ? { provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${v}` } : null;
  }
  if (host === "loom.com") {
    const v = u.pathname.match(/^\/(?:share|embed)\/([\w-]+)/)?.[1];
    return id(v) ? { provider: "Loom", src: `https://www.loom.com/embed/${v}` } : null;
  }
  if (host === "drive.google.com") {
    const v = u.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] ?? u.searchParams.get("id");
    return id(v) ? { provider: "Google Drive", src: `https://drive.google.com/file/d/${v}/preview` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const v = u.pathname.match(/(\d{6,12})/)?.[1];
    return v ? { provider: "Vimeo", src: `https://player.vimeo.com/video/${v}` } : null;
  }
  return null;
}

export type Progress = { done: number; total: number; pct: number; complete: boolean };

/** Aulas concluídas × total. Treinamento sem aulas nunca conta como concluído. */
export function progressOf(lessonIds: readonly string[], doneIds: ReadonlySet<string>): Progress {
  const total = lessonIds.length;
  const done = lessonIds.filter((id) => doneIds.has(id)).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, complete: total > 0 && done === total };
}

export type AssignmentState = "concluido" | "atrasado" | "no_prazo" | "sem_prazo";

/** Situação de uma atribuição. `today` é a data (AAAA-MM-DD) em São Paulo. */
export function assignmentState(dueOn: string | null, complete: boolean, today: string): AssignmentState {
  if (complete) return "concluido";
  if (!dueOn) return "sem_prazo";
  return dueOn < today ? "atrasado" : "no_prazo";
}

export const ASSIGNMENT_STATE_LABEL: Record<AssignmentState, string> = {
  concluido: "Concluído",
  atrasado: "Atrasado",
  no_prazo: "No prazo",
  sem_prazo: "Sem prazo",
};

/** "12 min" / "1 h 30 min". */
export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "2026-11-13" → "13/11/2026" (data sem hora, sem conversão de fuso). */
export function dayLabel(day: string): string {
  return day.slice(0, 10).split("-").reverse().join("/");
}
