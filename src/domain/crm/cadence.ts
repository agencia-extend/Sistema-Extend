// Cadências de follow-up (RF-CRM-06): passos, textos e o calendário que a cadência cria. Sem rede.

export const STEP_KINDS = ["mensagem", "ligacao", "tarefa"] as const;
export type StepKind = (typeof STEP_KINDS)[number];
export const STEP_KIND_LABEL: Record<StepKind, string> = { mensagem: "Mensagem", ligacao: "Ligação", tarefa: "Tarefa" };

export type CadenceStep = { day: number; time: string; kind: StepKind; title: string; message: string; auto: boolean };

/** {nome} vira o primeiro nome e {empresa} a empresa (como no banco, private.cadence_text). */
export const fillCadenceText = (text: string, lead: { name: string; company?: string | null }) =>
  text.replaceAll("{nome}", lead.name.trim().split(/\s+/)[0] ?? "").replaceAll("{empresa}", lead.company ?? "");

/** Datas dos passos a partir do dia de início (dia de São Paulo, "AAAA-MM-DD"). */
export function cadenceSchedule(start: string, steps: Pick<CadenceStep, "day" | "time">[]): string[] {
  return steps.map((s) => {
    const d = new Date(Date.parse(`${start}T12:00:00Z`) + s.day * 86_400_000).toISOString().slice(0, 10);
    return `${d} ${s.time}`;
  });
}

/** "D+0", "D+3"… */
export const dayLabel = (d: number) => `D+${d}`;
