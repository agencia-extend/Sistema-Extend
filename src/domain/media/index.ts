// Regras puras do Controle de Mídias: mês do cliente, formatos e colunas do quadro do setor.

export const CONTENT_FORMATS = ["video_curto", "video_premium", "reels", "estatico", "carrossel", "stories", "anuncio"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  video_curto: "Vídeo curto",
  video_premium: "Vídeo premium",
  reels: "Reels",
  estatico: "Estático",
  carrossel: "Carrossel",
  stories: "Sequência de stories",
  anuncio: "Anúncio",
};

export const DESTINATIONS = ["cronograma", "trafego", "drive"] as const;
export type Destination = (typeof DESTINATIONS)[number];
export const DESTINATION_LABEL: Record<Destination, string> = { cronograma: "Cronograma", trafego: "Tráfego", drive: "Drive" };

// --- Mês do cliente ------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Soma meses a uma data; dia 31 em mês curto cai no último dia (igual ao Postgres). */
export function addMonths(dateKey: string, months: number): string {
  const d = parse(dateKey);
  const day = d.getUTCDate();
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return key(first);
}

export type Cycle = { number: number; startsOn: string; endsOn: string };

/**
 * Mês do cliente que contém `dateKey`: começa no dia de início do contrato
 * (ex.: 14 → Mês 1 = 14/08 a 13/09, virando no dia 14). Antes do início → null.
 */
export function cycleOf(startKey: string, dateKey: string): Cycle | null {
  if (dateKey < startKey) return null;
  const s = parse(startKey);
  const d = parse(dateKey);
  let n = (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + (d.getUTCMonth() - s.getUTCMonth());
  if (addMonths(startKey, n) > dateKey) n -= 1;
  const next = parse(addMonths(startKey, n + 1));
  next.setUTCDate(next.getUTCDate() - 1);
  return { number: n + 1, startsOn: addMonths(startKey, n), endsOn: key(next) };
}

/** "14/08 a 14/09": do dia de início até o dia da virada, como a equipe fala. */
export function periodLabel(startsOn: string, endsOn: string): string {
  const turn = parse(endsOn);
  turn.setUTCDate(turn.getUTCDate() + 1);
  const f = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
  return `${f(parse(startsOn))} a ${f(turn)}`;
}

/** Hoje em São Paulo (AAAA-MM-DD). */
export function todayKey(now: Date = new Date()): string {
  return key(new Date(now.getTime() - 3 * 3600_000));
}

// --- Quadro do setor -------------------------------------------------------------

/** Colunas do quadro do setor, nas cores do Trello da Extend. */
export const BOARD_GROUPS = [
  { id: "nao_iniciado", name: "Não iniciado", color: "#EF4444" },
  { id: "em_andamento", name: "Em andamento", color: "#3B82F6" },
  { id: "aprovacao_interna", name: "Aprovação interna", color: "#8B5CF6" },
  { id: "aprovacao_cliente", name: "Aprovação cliente", color: "#A855F7" },
  { id: "cronograma", name: "Inserir no cronograma", color: "#F97316" },
  { id: "finalizado", name: "Finalizado", color: "#22C55E" },
] as const;
export type BoardGroup = (typeof BOARD_GROUPS)[number]["id"];

export type FlowStep = { id: string; position: number; sectorId: string | null; status: string; waitsClient: boolean; isRework: boolean };

const sorted = (steps: FlowStep[]) => [...steps].sort((a, b) => a.position - b.position);

/**
 * Em qual coluna do quadro do setor a etapa aparece. Tudo que vem antes da primeira
 * etapa do setor que produz (roteiro, gravação…) é "Não iniciado" para quem edita.
 */
export function boardGroupOf(steps: FlowStep[], stepId: string | null, boardSectorId: string | null): BoardGroup {
  const list = sorted(steps);
  const idx = list.findIndex((s) => s.id === stepId);
  if (idx < 0) return "nao_iniciado";
  const firstProd = list.findIndex((s) => s.sectorId && s.sectorId === boardSectorId);
  if (firstProd >= 0 && idx < firstProd) return "nao_iniciado";
  const s = list[idx];
  if (s.status === "concluido") return "finalizado";
  if (s.status === "aprovado") return "cronograma";
  if (s.status === "aguardando_aprovacao") return s.waitsClient ? "aprovacao_cliente" : "aprovacao_interna";
  return "em_andamento";
}

/**
 * Etapa de destino ao soltar o card numa coluna do quadro do setor.
 * Voltar de uma aprovação para "Em andamento" é pedido de alteração: vai para a etapa de retrabalho.
 */
export function targetStep(steps: FlowStep[], boardSectorId: string | null, group: BoardGroup, currentStepId: string | null): string | null {
  const list = sorted(steps);
  const inGroup = list.filter((s) => boardGroupOf(list, s.id, boardSectorId) === group);
  if (!inGroup.length) return null;
  if (inGroup.some((s) => s.id === currentStepId)) return currentStepId;
  const order = BOARD_GROUPS.map((g) => g.id);
  const from = order.indexOf(boardGroupOf(list, currentStepId, boardSectorId));
  if (group === "em_andamento") {
    const rework = inGroup.find((s) => s.isRework);
    if (rework && from > order.indexOf("em_andamento")) return rework.id;
    return (inGroup.find((s) => !s.isRework) ?? inGroup[0]).id;
  }
  if (group === "nao_iniciado") return inGroup[inGroup.length - 1].id;
  return inGroup[0].id;
}
