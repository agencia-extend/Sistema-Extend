/**
 * Dias úteis no Brasil: sem sábado, domingo, feriados nacionais e Sexta-feira Santa.
 * Espelha private.add_business_days no banco (supabase/migrations/20261113000700_onboarding_miro.sql).
 * Datas como "AAAA-MM-DD".
 */

const FIXED = new Set(["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"]);

const key = (d: Date) => d.toISOString().slice(0, 10);
const parse = (day: string) => new Date(`${day}T00:00:00Z`);

export function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isHoliday(day: string): boolean {
  if (FIXED.has(day.slice(5))) return true;
  const goodFriday = parse(easter(Number(day.slice(0, 4))));
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  return key(goodFriday) === day;
}

export function isBusinessDay(day: string): boolean {
  const dow = parse(day).getUTCDay();
  return dow !== 0 && dow !== 6 && !isHoliday(day);
}

/** N dias úteis depois de `start` (0 = o próprio dia). */
export function addBusinessDays(start: string, days: number): string {
  const d = parse(start);
  let left = Math.max(0, days);
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isBusinessDay(key(d))) left--;
  }
  return key(d);
}
