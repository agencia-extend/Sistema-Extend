import "server-only";
import { manageErrorMessage } from "@/domain/ads/manage";
import { graph } from "@/lib/integrations/meta";

// Alterações nas campanhas da Meta (exigem ads_management). Valem na hora na conta de anúncios do cliente.

export class MetaManageError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

async function post<T>(path: string, token: string, params: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(graph(path), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      // locale: a Meta explica o motivo em português (ex.: orçamento abaixo do mínimo).
      body: new URLSearchParams({ ...params, locale: "pt_BR", access_token: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MetaManageError("Sem resposta da Meta (rede). Confira no Gerenciador se a alteração entrou antes de tentar de novo.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { code?: number; error_subcode?: number; error_user_msg?: string; message?: string } };
  if (!res.ok || data.error) {
    const e = data.error;
    throw new MetaManageError(manageErrorMessage(e?.code, e?.error_subcode, e?.error_user_msg), e?.code);
  }
  return data;
}

/** Campanha, conjunto ou anúncio: status, nome ou orçamento diário (em centavos, como a Meta usa para BRL). */
export async function metaUpdate(token: string, externalId: string, changes: { status?: "ACTIVE" | "PAUSED"; name?: string; dailyBudgetCents?: number }) {
  const params: Record<string, string> = {};
  if (changes.status) params.status = changes.status;
  if (changes.name) params.name = changes.name;
  if (changes.dailyBudgetCents != null) params.daily_budget = String(changes.dailyBudgetCents);
  await post(`/${externalId}`, token, params);
}

/** Duplica campanha (com conjuntos e anúncios) ou conjunto; a cópia nasce pausada. Devolve o id da cópia. */
export async function metaDuplicate(token: string, level: "campaign" | "adset", externalId: string): Promise<string | null> {
  const r = await post<{ copied_campaign_id?: string; copied_adset_id?: string }>(`/${externalId}/copies`, token, { deep_copy: "true", status_option: "PAUSED" });
  return level === "campaign" ? (r.copied_campaign_id ?? null) : (r.copied_adset_id ?? null);
}
