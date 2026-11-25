import "server-only";
import { syncGoogleAccounts } from "./google-sync";
import { syncMetaAccounts } from "./meta-sync";

/**
 * Sincroniza Meta e Google Ads dentro do mesmo tempo (RF-ADS-03): a Meta primeiro, o Google com o que sobrar
 * (no mínimo 10 s). O que não couber fica para a próxima rodada; cada plataforma começa pelas contas mais atrasadas.
 */
export async function syncAdAccounts(opts: { trigger: "cron" | "manual"; accountIds?: string[]; budgetMs?: number }) {
  const budget = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const meta = await syncMetaAccounts({ ...opts, budgetMs: budget });
  const google = await syncGoogleAccounts({ ...opts, budgetMs: Math.max(10_000, budget - (Date.now() - started)) });
  return { total: meta.total + google.total, done: meta.done + google.done, results: [...meta.results, ...google.results] };
}
