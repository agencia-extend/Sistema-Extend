/** Marcos do onboarding (passos do fluxograma do Miro). */

export const MILESTONE_KEYS = ["abertura", "briefing", "combinados"] as const;
export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export const MILESTONE_LABEL: Record<MilestoneKey | "conclusao", string> = {
  abertura: "Abertura",
  briefing: "Briefing",
  combinados: "Combinados com o cliente",
  conclusao: "Onboarding concluído",
};

export type MilestoneState = "concluido" | "atrasado" | "no_prazo" | "sem_prazo";

export function milestoneState(dueOn: string | null, doneAt: string | null, today: string): MilestoneState {
  if (doneAt) return "concluido";
  if (!dueOn) return "sem_prazo";
  return dueOn < today ? "atrasado" : "no_prazo";
}

export const MILESTONE_STATE_LABEL: Record<MilestoneState, string> = {
  concluido: "Concluído",
  atrasado: "Atrasado",
  no_prazo: "No prazo",
  sem_prazo: "Sem prazo",
};
