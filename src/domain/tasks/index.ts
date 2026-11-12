// Regras puras de produção: posição no quadro, tempo, prazos e menções.

/** Posição entre dois vizinhos (ordenação fracionária). */
export function positionBetween(before: number | null | undefined, after: number | null | undefined): number {
  if (before == null && after == null) return 1000;
  if (before == null) return (after as number) - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}

/** Duração em ms de intervalos (aberto = até agora). */
export function totalMs(entries: { started_at: string; ended_at: string | null }[], now: Date = new Date()): number {
  return entries.reduce((sum, e) => sum + Math.max(0, (e.ended_at ? new Date(e.ended_at) : now).getTime() - new Date(e.started_at).getTime()), 0);
}

/** "1h30", "45 min", "2 dias 3h". */
export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} dia${d > 1 ? "s" : ""} ${rh}h` : `${d} dia${d > 1 ? "s" : ""}`;
}

export type DueState = "none" | "late" | "today" | "soon" | "later" | "done";

const DONE = new Set(["concluido", "aprovado", "cancelado"]);

/** Situação do prazo para cor e filtros (RF-TAR-09). "today" = vence até o fim do dia em São Paulo. */
export function dueState(dueAt: string | null, status: string, now: Date = new Date()): DueState {
  if (DONE.has(status)) return "done";
  if (!dueAt) return "none";
  const due = new Date(dueAt).getTime();
  if (due < now.getTime()) return "late";
  const sp = new Date(now.getTime() - 3 * 3600_000);
  const endOfDay = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 23, 59, 59) + 3 * 3600_000;
  if (due <= endOfDay) return "today";
  if (due <= now.getTime() + 7 * 86_400_000) return "soon";
  return "later";
}

/** Extrai menções "@Nome" do texto comparando com a equipe (nome completo ou primeiro nome). */
export function findMentions(text: string, team: { id: string; name: string }[]): string[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const body = norm(text);
  const found = new Set<string>();
  for (const p of [...team].sort((a, b) => b.name.length - a.name.length)) {
    const full = norm(p.name).trim();
    const first = full.split(/\s+/)[0];
    for (const candidate of [full, first]) {
      if (!candidate) continue;
      const re = new RegExp(`(^|\\s)@${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[\\s.,!?:;])`);
      if (re.test(body)) {
        found.add(p.id);
        break;
      }
    }
  }
  return [...found];
}

export const TASK_TYPE_LABEL: Record<string, string> = {
  video: "Vídeo",
  design: "Arte",
  conteudo: "Post",
  gravacao: "Gravação",
  site: "Site",
  criativo: "Criativo",
  roteiro: "Roteiro",
  post: "Post",
  geral: "Geral",
};

export const PRIORITY_LABEL: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
