import { TZDate } from "@date-fns/tz";
import { format, formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export const TIMEZONE = "America/Sao_Paulo";

const inSp = (value: string | Date) => new TZDate(new Date(value), TIMEZONE);

/** 10/11/2026 14:30 no fuso de São Paulo. */
export function formatDateTime(value: string | Date): string {
  return format(inSp(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function formatDate(value: string | Date): string {
  return format(inSp(value), "dd/MM/yyyy", { locale: ptBR });
}

/** "agora", "há 5 minutos", "há 2 dias". */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const date = new Date(value);
  if (now.getTime() - date.getTime() < 60_000) return "agora";
  return `há ${formatDistanceStrict(date, now, { locale: ptBR })}`;
}

/** "2026-11" do mês atual em São Paulo. */
export function currentMonthKey(now: Date = new Date()): string {
  const sp = new Date(now.getTime() - 3 * 3600_000);
  return `${sp.getUTCFullYear()}-${String(sp.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Instante (ms) de N dias atrás. */
export function daysAgoMs(days: number, now: Date = new Date()): number {
  return now.getTime() - days * 86_400_000;
}
