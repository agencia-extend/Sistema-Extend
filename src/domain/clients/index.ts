// Regras puras do módulo de clientes (abas, progresso, rótulos).
import type { PermissionMap } from "@/domain/permissions";

export type ClientStatus = "onboarding" | "ativo" | "pausado" | "encerrado";

export const STATUS_LABEL: Record<ClientStatus, string> = {
  onboarding: "Em onboarding",
  ativo: "Ativo",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

/** Cor de status padronizada (docs/07): andamento = azul, aguardando = âmbar, pausado = cinza. */
export const STATUS_TONE: Record<ClientStatus, "info" | "success" | "neutral" | "warning"> = {
  onboarding: "warning",
  ativo: "success",
  pausado: "neutral",
  encerrado: "neutral",
};

export type ClientTab = { key: string; label: string };

const ALWAYS: ClientTab[] = [
  { key: "", label: "Visão geral" },
  { key: "ficha", label: "Ficha" },
  { key: "reunioes", label: "Reuniões" },
];

/**
 * Abas do ambiente do cliente (RF-CLI-06, RF-ONB-03).
 * Em onboarding: só Visão geral, Ficha, Reuniões e Arquivos.
 * Depois: abas conforme os serviços contratados E a permissão da pessoa.
 * Abas de módulos que ainda não existem não entram (regra nº 1).
 */
export function clientTabs(status: ClientStatus, serviceTabs: string[], perms: PermissionMap): ClientTab[] {
  if (status === "onboarding") return [...ALWAYS, { key: "arquivos", label: "Arquivos" }];
  const tabs = [...ALWAYS];
  const hasProduction = serviceTabs.some((t) => ["videos", "design", "conteudo", "gerenciamento", "gravacao", "site"].includes(t));
  if (hasProduction && perms["tasks.read"]) tabs.push({ key: "demanda", label: "Demanda do mês" }, { key: "quadros", label: "Quadros" });
  tabs.push({ key: "ideias", label: "Ideias e referências" }, { key: "arquivos", label: "Arquivos" }, { key: "historico", label: "Histórico" });
  return tabs;
}

/** % entregue (concluídas / total), inteiro de 0 a 100. Sem demandas → null. */
export function deliveredPercent(done: number, total: number): number | null {
  if (!total) return null;
  return Math.round((Math.min(done, total) / total) * 100);
}

/** Etapa da jornada mostrada no card (RF-CLI-05). */
export function journeyStage(status: ClientStatus, onboardingDone: number, onboardingTotal: number): string {
  if (status === "onboarding") {
    return onboardingTotal ? `Onboarding ${onboardingDone}/${onboardingTotal}` : "Onboarding";
  }
  if (status === "ativo") return "Execução";
  return STATUS_LABEL[status];
}

export const ACCOUNT_KINDS: { key: string; label: string; placeholder: string }[] = [
  { key: "bm", label: "Business Manager (BM)", placeholder: "ID do BM…" },
  { key: "ad_account_meta", label: "Conta de anúncio Meta", placeholder: "act_123456…" },
  { key: "ad_account_google", label: "Google Ads (customer ID)", placeholder: "123-456-7890…" },
  { key: "page", label: "Página do Facebook", placeholder: "https://facebook.com/…" },
  { key: "instagram", label: "Instagram", placeholder: "@perfil…" },
  { key: "pixel", label: "Pixel / dataset", placeholder: "ID do pixel…" },
  { key: "whatsapp", label: "WhatsApp do cliente", placeholder: "41 99999-0000…" },
  { key: "site", label: "Site", placeholder: "https://…" },
  { key: "drive_folder", label: "Pasta do Drive", placeholder: "https://drive.google.com/…" },
  { key: "tiktok", label: "TikTok", placeholder: "@perfil…" },
  { key: "outro", label: "Outro", placeholder: "…" },
];

export const MEETING_KINDS: Record<string, string> = {
  briefing: "Briefing",
  planejamento: "Planejamento",
  alinhamento: "Alinhamento",
  resultados: "Resultados",
  outro: "Outra",
};

export const UNIT_LABEL: Record<string, string> = {
  videos: "vídeos/mês",
  artes: "artes/mês",
  posts: "posts/mês",
  gravacoes: "gravações/mês",
  nenhuma: "",
};
