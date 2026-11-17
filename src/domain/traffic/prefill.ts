// Checklist diário já preenchido com os números da sincronização (RF-OTI-01): o sistema sugere a situação e o
// comentário de cada item; o gestor confere e salva. Mesmos limites dos alertas (RF-ALE-01).
import { daysLeft } from "@/domain/ads";
import type { CheckStatus } from "@/domain/traffic";
import { formatBRL } from "@/domain/shared/money";

export type PrefillAccount = { name: string; isPrepay: boolean | null; fundsCents: number | null; statusCode: number | null; last7SpendCents: number[]; yesterdayCents: number };
export type PrefillCampaign = { name: string; dailyBudgetCents: number | null; yesterdayCents: number; startedBeforeYesterday: boolean };
export type PrefillInput = {
  accounts: PrefillAccount[];
  campaigns: PrefillCampaign[];
  rejectedAds: string[];
  limits: { fundsDays: number; fundsMinCents: number | null; dailySpendMaxCents: number | null };
};
export type Hint = { status: CheckStatus; note: string };
export type Prefill = Record<"saldo" | "reprovados" | "gasto" | "entrega", Hint>;

/** Lista curta: "A, B e mais 3". */
export function shortList(names: string[], max = 3): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} e mais ${names.length - max}`;
}

const clip = (s: string) => (s.length > 500 ? `${s.slice(0, 497)}…` : s);

export function dailyPrefill(input: PrefillInput): Prefill | null {
  if (!input.accounts.length) return null;
  const { limits } = input;

  // Saldo e cobrança
  const parts: string[] = [];
  let saldoProblem = false;
  for (const a of input.accounts) {
    if (a.statusCode !== null && a.statusCode !== 1) {
      saldoProblem = true;
      parts.push(`${a.name}: conta com restrição`);
      continue;
    }
    if (a.isPrepay && a.fundsCents !== null) {
      const days = daysLeft(a.fundsCents, a.last7SpendCents);
      const low = (limits.fundsDays > 0 && days !== null && days <= limits.fundsDays) || (limits.fundsMinCents !== null && a.fundsCents < limits.fundsMinCents);
      if (low) saldoProblem = true;
      parts.push(`${a.name}: saldo de ${formatBRL(a.fundsCents)}${days !== null ? ` (cerca de ${days} ${days === 1 ? "dia" : "dias"})` : ""}`);
    } else {
      parts.push(`${a.name}: ${a.isPrepay ? "pré-paga, saldo não informado" : "pós-paga"}`);
    }
  }
  const saldo: Hint = { status: saldoProblem ? "problema" : "ok", note: clip(parts.join("; ")) };

  // Anúncios reprovados em campanha ativa
  const n = input.rejectedAds.length;
  const reprovados: Hint = n
    ? { status: "problema", note: clip(`${n} ${n === 1 ? "anúncio reprovado" : "anúncios reprovados"} em campanha ativa: ${shortList(input.rejectedAds)}`) }
    : { status: "ok", note: "Nenhum anúncio reprovado em campanha ativa." };

  // Gasto de ontem x orçamento diário das campanhas ativas
  const spent = input.accounts.reduce((s, a) => s + a.yesterdayCents, 0);
  const budget = input.campaigns.reduce((s, c) => s + (c.dailyBudgetCents ?? 0), 0);
  const over = limits.dailySpendMaxCents !== null && spent > limits.dailySpendMaxCents;
  const gasto: Hint = {
    status: over ? "problema" : "ok",
    note: clip(
      `Ontem: ${formatBRL(spent)}` +
        (budget > 0 ? ` de ${formatBRL(budget)} de orçamento diário das campanhas ativas (${Math.round((spent / budget) * 100)}%)` : "") +
        (over ? `, acima do limite de ${formatBRL(limits.dailySpendMaxCents)}` : "") + ".",
    ),
  };

  // Entrega: campanha ativa (desde antes de ontem) sem gasto ontem
  const stopped = input.campaigns.filter((c) => c.startedBeforeYesterday && c.yesterdayCents <= 0).map((c) => c.name);
  const entrega: Hint = !input.campaigns.length
    ? { status: "na", note: "Nenhuma campanha ativa." }
    : stopped.length
      ? { status: "problema", note: clip(`Sem gasto ontem: ${shortList(stopped)}`) }
      : { status: "ok", note: `${input.campaigns.length} ${input.campaigns.length === 1 ? "campanha ativa entregando" : "campanhas ativas entregando"}.` };

  return { saldo, reprovados, gasto, entrega };
}
