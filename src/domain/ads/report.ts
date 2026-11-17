// Relatório de anúncios em texto de WhatsApp (RF-REL-01/02): por cliente, as contas e as campanhas que
// gastaram no período, com o resultado principal de cada uma. Puro, sem rede.
import { RESULT_LABEL, type Kpis, type ResultKind, type Totals } from ".";

export type ReportCampaign = { name: string; kind: ResultKind; totals: Totals; kpis: Kpis };
export type ReportAccount = { name: string; isPrepay: boolean | null; fundsCents: number | null; daysLeft: number | null; totals: Totals; campaigns: ReportCampaign[] };

const brl = (cents: number | null) => (cents === null ? "—" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const int = (n: number) => n.toLocaleString("pt-BR");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Semana anterior completa (segunda a domingo) a partir de hoje (dia de São Paulo). */
export function lastWeek(today: string): { start: string; end: string } {
  const d = new Date(`${today}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dow - 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

/** Texto do relatório. null quando não houve gasto no período (nada a relatar). */
export function buildAdsReport(input: { clientName: string; range: { start: string; end: string }; accounts: ReportAccount[] }): string | null {
  const spend = input.accounts.reduce((s, a) => s + a.totals.spend_cents, 0);
  if (spend <= 0) return null;
  const lines: string[] = [`📊 *Relatório de anúncios — ${input.clientName}*`, `Período: ${br(input.range.start)} a ${br(input.range.end)}`, ""];
  const impressions = input.accounts.reduce((s, a) => s + a.totals.impressions, 0);
  lines.push(`💰 Investimento: *${brl(spend)}*`, `👀 Impressões: ${int(impressions)}`);

  for (const a of input.accounts.filter((x) => x.totals.spend_cents > 0)) {
    if (input.accounts.length > 1) lines.push("", `*${a.name}* — ${brl(a.totals.spend_cents)}`);
    else lines.push("");
    for (const c of a.campaigns.filter((x) => x.totals.spend_cents > 0)) {
      const label = RESULT_LABEL[c.kind];
      const result = c.kind === "impressions" ? `${int(c.totals.impressions)} impressões` : `${int(c.kpis.results)} ${c.kpis.results === 1 ? label.one : label.many}`;
      const cost = c.kind !== "impressions" && c.kpis.costPerResultCents !== null ? ` · ${brl(c.kpis.costPerResultCents)} cada` : "";
      lines.push(`▪️ ${c.name}`, `   ${brl(c.totals.spend_cents)} · ${result}${cost} · CTR ${pct(c.kpis.ctr)}`);
    }
    if (a.isPrepay && a.fundsCents !== null) {
      lines.push(`💳 Saldo da conta: ${brl(a.fundsCents)}${a.daysLeft !== null ? ` (dá para ~${a.daysLeft} ${a.daysLeft === 1 ? "dia" : "dias"})` : ""}`);
    }
  }
  return lines.join("\n");
}
