// Intervalos da agenda no fuso de São Paulo (UTC-3, sem horário de verão).
const OFFSET = 3 * 3600_000;

export type CalendarView = "dia" | "semana" | "mes";

/** "2026-11-10" → Date UTC da meia-noite em São Paulo. */
export function spMidnight(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + OFFSET);
}

export function spDayKey(date: Date | string): string {
  return new Date(new Date(date).getTime() - OFFSET).toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Dias visíveis e intervalo [start, end) da visão. Semana começa na segunda. */
export function calendarRange(view: CalendarView, day: string) {
  const [y, m, d] = day.split("-").map(Number);
  let first: string;
  let count: number;
  if (view === "dia") {
    first = day;
    count = 1;
  } else if (view === "semana") {
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    first = addDays(day, -dow);
    count = 7;
  } else {
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const dow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    first = addDays(start, -dow);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    count = Math.ceil((dow + daysInMonth) / 7) * 7;
  }
  const days = Array.from({ length: count }, (_, i) => addDays(first, i));
  return { days, start: spMidnight(days[0]), end: spMidnight(addDays(days[days.length - 1], 1)) };
}

/** Próximo/anterior período. */
export function shiftDay(view: CalendarView, day: string, dir: 1 | -1): string {
  if (view === "dia") return addDays(day, dir);
  if (view === "semana") return addDays(day, 7 * dir);
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
}

/** Próxima hora cheia (ISO) — sugestão de início de evento. */
export function nextFullHourIso(now: Date = new Date()): string {
  return new Date(Math.ceil(now.getTime() / 3_600_000) * 3_600_000).toISOString();
}
