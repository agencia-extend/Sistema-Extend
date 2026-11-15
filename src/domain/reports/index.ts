// Relatório semanal ao cliente e o retorno dele (briefing de mídias 3.9).

export const REPORT_AREAS = ["trafego", "conteudo"] as const;
export type ReportArea = (typeof REPORT_AREAS)[number];
export const REPORT_AREA_LABEL: Record<ReportArea, string> = { trafego: "Tráfego", conteudo: "Conteúdo" };

export const FEEDBACKS = ["positivo", "negativo", "sem_retorno"] as const;
export type Feedback = (typeof FEEDBACKS)[number];
export const FEEDBACK_LABEL: Record<Feedback, string> = { positivo: "Positivo", negativo: "Negativo", sem_retorno: "Sem retorno" };

/** O que a equipe faz depois do retorno (fluxo do briefing). */
export function nextStep(area: ReportArea, feedback: Feedback): string {
  if (feedback === "sem_retorno") return "Vira uma demanda de ligação para o responsável pela comunicação do cliente.";
  if (feedback === "negativo")
    return area === "trafego" ? "A equipe de tráfego é avisada para estudar e ajustar as campanhas." : "A equipe de conteúdo é avisada para rever o conteúdo.";
  return area === "trafego" ? "Manter as campanhas e avaliar aumento de orçamento." : "Manter a linha do conteúdo.";
}

/** Serviço que liga a área no cliente: tráfego = anúncios; conteúdo = gerenciamento. */
export function reportAreas(serviceTabs: string[]): ReportArea[] {
  const areas: ReportArea[] = [];
  if (serviceTabs.includes("anuncios")) areas.push("trafego");
  if (serviceTabs.includes("gerenciamento")) areas.push("conteudo");
  return areas;
}
