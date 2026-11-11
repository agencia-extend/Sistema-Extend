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
