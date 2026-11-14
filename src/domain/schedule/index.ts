/** Cronograma de posts do cliente: mês do calendário, semanas e ordem do grid do Instagram. */

const pad = (n: number) => String(n).padStart(2, "0");

/** "AAAA-MM" válido ou o mês de hoje. */
export function monthParam(value: string | undefined, today: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : today.slice(0, 7);
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${pad(last)}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** Semana (segunda a domingo) de uma data, rotulada pela segunda-feira "DD/MM". */
export function weekOf(day: string): { key: string; label: string } {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  const f = (x: Date) => `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}`;
  return { key: d.toISOString().slice(0, 10), label: `Semana de ${f(d)} a ${f(end)}` };
}

export type PostState = "postado" | "programado" | "sem_data";
export function postState(postOn: string | null, postUrl: string | null): PostState {
  if (postUrl) return "postado";
  return postOn ? "programado" : "sem_data";
}
export const POST_STATE_LABEL: Record<PostState, string> = { postado: "Postado", programado: "Programado", sem_data: "Sem data" };

/** Grid do Instagram: o post mais novo fica no canto de cima, à esquerda. */
export function gridOrder<T extends { postOn: string | null }>(posts: T[]): T[] {
  return posts.filter((p) => p.postOn).sort((a, b) => (b.postOn! < a.postOn! ? -1 : b.postOn! > a.postOn! ? 1 : 0));
}
