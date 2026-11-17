/** Histórico de reprovações da Meta (RF-T2-02): motivos, desfechos e o resumo "o que evitar". */
import type { CreativeFormat } from "./index";

export const REJECTION_REASONS = [
  "atributos_pessoais",
  "antes_depois",
  "promessa",
  "saude",
  "financeiro",
  "sensacionalista",
  "adulto",
  "marca",
  "destino",
  "funcionalidade",
  "tema_social",
  "outro",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/** Rótulo e exemplo de cada motivo, nas palavras que a equipe usa (a política da Meta é a referência). */
export const REJECTION_REASON: Record<RejectionReason, { label: string; hint: string }> = {
  atributos_pessoais: { label: "Atributos pessoais", hint: "Texto que afirma algo sobre a pessoa: “Você está acima do peso?”, “Endividado?”." },
  antes_depois: { label: "Antes e depois / imagem corporal", hint: "Comparação de antes e depois, foco em partes do corpo." },
  promessa: { label: "Promessa de resultado", hint: "Resultado garantido, números irreais, “perca 10 kg em 1 semana”." },
  saude: { label: "Saúde e procedimentos", hint: "Remédios, procedimentos estéticos, alegações de saúde." },
  financeiro: { label: "Serviços financeiros", hint: "Crédito, empréstimo, investimento sem as informações exigidas." },
  sensacionalista: { label: "Conteúdo sensacionalista", hint: "Imagem chocante, violenta ou exagerada para chamar atenção." },
  adulto: { label: "Conteúdo adulto ou sugestivo", hint: "Nudez, poses ou roupas sugestivas." },
  marca: { label: "Marca ou direitos autorais", hint: "Logo, música ou imagem de terceiros sem autorização." },
  destino: { label: "Página de destino", hint: "Site fora do ar, diferente do anúncio ou sem política de privacidade." },
  funcionalidade: { label: "Funcionalidade falsa", hint: "Botão de play, notificação ou caixa de mensagem falsos na imagem." },
  tema_social: { label: "Tema social ou político", hint: "Assunto social, eleitoral ou político sem autorização." },
  outro: { label: "Outro motivo", hint: "Descreva no campo do que a Meta disse." },
};

export const REJECTION_OUTCOMES = ["corrigido", "contestado_aprovado", "contestado_negado", "descartado"] as const;
export type RejectionOutcome = (typeof REJECTION_OUTCOMES)[number];
export const REJECTION_OUTCOME_LABEL: Record<RejectionOutcome, string> = {
  corrigido: "Corrigido e reenviado",
  contestado_aprovado: "Contestado: aprovado",
  contestado_negado: "Contestado: mantida",
  descartado: "Descartado",
};

export type RejectionLike = { reason: string; format: string | null; angle: string; lesson: string | null; rejectedOn: string };

export type AvoidItem = { reason: RejectionReason; count: number; formats: CreativeFormat[]; angles: string[]; lessons: string[]; lastOn: string };

/**
 * Consolidado por motivo (o mais frequente primeiro; empate, o mais recente): formatos e ângulos que
 * levaram a reprovação e o que a equipe anotou para evitar. Sem repetir texto.
 */
export function avoidSummary(rows: RejectionLike[], max = 5): AvoidItem[] {
  const map = new Map<RejectionReason, AvoidItem>();
  for (const r of rows) {
    const reason = (REJECTION_REASONS as readonly string[]).includes(r.reason) ? (r.reason as RejectionReason) : "outro";
    const it = map.get(reason) ?? { reason, count: 0, formats: [], angles: [], lessons: [], lastOn: r.rejectedOn };
    it.count += 1;
    if (r.rejectedOn > it.lastOn) it.lastOn = r.rejectedOn;
    // Reprovação detectada na sincronização não tem formato (a Meta não informa).
    if (r.format && !it.formats.includes(r.format as CreativeFormat)) it.formats.push(r.format as CreativeFormat);
    const angle = r.angle.trim();
    if (angle && !it.angles.some((a) => a.toLowerCase() === angle.toLowerCase())) it.angles.push(angle);
    const lesson = r.lesson?.trim();
    if (lesson && !it.lessons.some((l) => l.toLowerCase() === lesson.toLowerCase())) it.lessons.push(lesson);
    map.set(reason, it);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.lastOn.localeCompare(a.lastOn)).slice(0, max);
}
