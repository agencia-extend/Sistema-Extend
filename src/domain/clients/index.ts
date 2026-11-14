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
  { key: "materiais", label: "Materiais" },
  { key: "reunioes", label: "Reuniões" },
];

/**
 * Abas do ambiente do cliente (RF-CLI-06, RF-ONB-03).
 * Em onboarding: só Visão geral, Ficha, Reuniões e Arquivos.
 * Depois: abas conforme os serviços contratados E a permissão da pessoa.
 * Abas de módulos que ainda não existem não entram (regra nº 1).
 */
export function clientTabs(status: ClientStatus, serviceTabs: string[], perms: PermissionMap): ClientTab[] {
  if (status === "onboarding") return [...ALWAYS, { key: "contratos", label: "Contratos" }, { key: "arquivos", label: "Documentos" }];
  const tabs = [...ALWAYS];
  const hasProduction = serviceTabs.some((t) => ["videos", "design", "conteudo", "gerenciamento", "gravacao", "site"].includes(t));
  if (hasProduction && perms["tasks.read"]) tabs.push({ key: "midias", label: "Controle de Mídias" }, { key: "quadros", label: "Quadros" });
  // Cronograma só para quem tem Gerenciamento (briefing: cliente sem gerenciamento não tem cronograma).
  if (serviceTabs.includes("gerenciamento") && perms["tasks.read"]) tabs.push({ key: "cronograma", label: "Cronograma" });
  if (serviceTabs.some((t) => t === "videos" || t === "gravacao") && perms["tasks.read"]) tabs.push({ key: "gravacoes", label: "Gravações" });
  tabs.push({ key: "contratos", label: "Contratos" }, { key: "ideias", label: "Ideias e referências" }, { key: "arquivos", label: "Documentos" }, { key: "historico", label: "Histórico" });
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

/** Nº do cliente como na planilha (001, 002…). */
export function clientCode(code: number): string {
  return String(code).padStart(3, "0");
}

export type ContractWindow = "sem" | "vencido" | "termina_logo" | "termina" | "ok";

/** Situação do fim do contrato em relação a hoje ("AAAA-MM-DD"). */
export function contractWindow(endsOn: string | null, today: string): ContractWindow {
  if (!endsOn) return "sem";
  if (endsOn < today) return "vencido";
  const days = (Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  if (days <= 7) return "termina_logo";
  if (days <= 30) return "termina";
  return "ok";
}

export const MATERIAL_CATEGORIES = ["identidade", "catalogo", "perfil", "imagens", "referencias", "acessos", "outros"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/** Materiais do cliente (briefing de mídias, item 3.2): o que é e o que guardar em cada um. */
export const MATERIAL_CATEGORY: Record<MaterialCategory, { label: string; hint: string }> = {
  identidade: { label: "Identidade visual", hint: "Logo em alta, manual de marca, cores e fontes." },
  catalogo: { label: "Catálogo", hint: "Produtos, serviços, preços e tabelas." },
  perfil: { label: "Instruções de perfil", hint: "Tom de voz, o que pode e o que não pode postar, bio." },
  imagens: { label: "Banco de imagens", hint: "Fotos profissionais, do espaço e da equipe (de preferência pasta do Drive)." },
  referencias: { label: "Referências", hint: "Perfis, vídeos e anúncios que o cliente gosta." },
  acessos: { label: "Acessos", hint: "Links e instruções de acesso. Nunca escreva senhas aqui." },
  outros: { label: "Outros", hint: "O que não se encaixa nas categorias acima." },
};

export const FILE_FOLDERS = ["geral", "midias", "trafego"] as const;
export type FileFolder = (typeof FILE_FOLDERS)[number];
export const FILE_FOLDER_LABEL: Record<FileFolder, string> = { geral: "Geral", midias: "Mídias", trafego: "Tráfego" };

/** Seção da ficha vale para o cliente? Sem "show_for" vale sempre; com, basta um serviço que tenha a aba. */
export function sectionApplies(showFor: readonly string[] | undefined, clientTabs: readonly string[]): boolean {
  return !showFor?.length || showFor.some((t) => clientTabs.includes(t));
}

export const SECTION_TAB_LABEL: Record<string, string> = {
  anuncios: "Tráfego (Meta/Google)",
  videos: "Vídeos",
  gravacao: "Gravação",
  design: "Design",
  conteudo: "Conteúdo",
  gerenciamento: "Gerenciamento de redes",
  site: "Site",
};
