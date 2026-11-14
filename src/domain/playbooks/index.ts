import { addBusinessDays } from "@/domain/shared/business-days";

/** Playbooks: áreas, prazo relativo de cada etapa e prévia dos marcos antes de aplicar. */

export const PLAYBOOK_AREAS = ["trafego", "conteudo", "design", "video", "site", "comercial", "atendimento", "geral"] as const;
export type PlaybookArea = (typeof PLAYBOOK_AREAS)[number];
export const PLAYBOOK_AREA_LABEL: Record<PlaybookArea, string> = {
  trafego: "Tráfego",
  conteudo: "Conteúdo",
  design: "Design",
  video: "Vídeo",
  site: "Sites",
  comercial: "Comercial",
  atendimento: "Atendimento",
  geral: "Geral",
};

export const STEP_TASK_TYPES = ["geral", "video", "design", "conteudo", "gravacao", "site"] as const;
export type StepTaskType = (typeof STEP_TASK_TYPES)[number];

export type StepLike = { offsetDays: number; dayKind: "uteis" | "corridos"; milestone: string | null; title: string };

/** "D0", "D+2 úteis", "D+7". */
export function offsetLabel(days: number, kind: "uteis" | "corridos"): string {
  if (days === 0) return "D0";
  return kind === "uteis" ? `D+${days} úteis` : `D+${days}`;
}

export function stepDue(start: string, s: Pick<StepLike, "offsetDays" | "dayKind">): string {
  if (s.dayKind === "uteis") return addBusinessDays(start, s.offsetDays);
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + s.offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Marcos na ordem em que aparecem, com quantas demandas e a data da última. Etapas sem marco ficam em "Outras". */
export function previewMilestones(start: string, steps: StepLike[]): { title: string; count: number; dueOn: string }[] {
  const out = new Map<string, { title: string; count: number; dueOn: string }>();
  for (const s of steps) {
    const key = s.milestone ?? "";
    const due = stepDue(start, s);
    const cur = out.get(key) ?? { title: s.milestone ?? "Outras etapas", count: 0, dueOn: due };
    cur.count++;
    if (due > cur.dueOn) cur.dueOn = due;
    out.set(key, cur);
  }
  const list = [...out.entries()];
  return [...list.filter(([k]) => k), ...list.filter(([k]) => !k)].map(([, v]) => v);
}

/** Duração aproximada em dias corridos (até a última etapa). */
export function durationDays(start: string, steps: StepLike[]): number {
  if (!steps.length) return 0;
  const last = steps.map((s) => stepDue(start, s)).sort().at(-1)!;
  return Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}
