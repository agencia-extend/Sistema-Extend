/** Área do cliente (etapa 12): navegação, progresso do mês e textos de situação. */

export type PortalNavItem = { href: string; label: string; short: string };

/** Seções do portal. Relatórios e materiais aparecem sempre (com estado vazio que explica). */
export const PORTAL_NAV: PortalNavItem[] = [
  { href: "/portal", label: "Início", short: "Início" },
  { href: "/portal/aprovacoes", label: "Aprovações", short: "Aprovar" },
  { href: "/portal/cronograma", label: "Cronograma", short: "Posts" },
  { href: "/portal/relatorios", label: "Relatórios", short: "Relatórios" },
  { href: "/portal/materiais", label: "Materiais", short: "Arquivos" },
  { href: "/portal/estrategia", label: "Estratégia", short: "Estratégia" },
  { href: "/portal/ajuda", label: "Ajuda", short: "Ajuda" },
];

/** Item ativo: o mais específico que casa com o caminho atual. */
export function activePortalHref(pathname: string): string {
  const hit = PORTAL_NAV.filter((i) => pathname === i.href || (i.href !== "/portal" && pathname.startsWith(`${i.href}/`)));
  return hit.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "/portal";
}

export type MonthService = { name: string; total: number; done: number };

/** Total do mês (soma dos serviços) e % entregue, inteiro de 0 a 100. Sem itens → null. */
export function monthProgress(services: MonthService[]): { total: number; done: number; percent: number | null } {
  const total = services.reduce((s, x) => s + x.total, 0);
  const done = services.reduce((s, x) => s + Math.min(x.done, x.total), 0);
  return { total, done, percent: total ? Math.round((done / total) * 100) : null };
}

export type MilestoneState = "feito" | "atrasado" | "previsto" | "sem_data";

/** Situação de um marco do projeto em relação a hoje (AAAA-MM-DD, São Paulo). */
export function milestoneState(m: { due_on: string | null; done_at: string | null }, today: string): MilestoneState {
  if (m.done_at) return "feito";
  if (!m.due_on) return "sem_data";
  return m.due_on < today ? "atrasado" : "previsto";
}

export const MILESTONE_LABEL: Record<MilestoneState, string> = { feito: "Concluído", atrasado: "Em andamento", previsto: "Previsto", sem_data: "A combinar" };

const pad = (n: number) => String(n).padStart(2, "0");

/** "14/11" a partir de AAAA-MM-DD (sem fuso: é uma data de calendário). */
export function shortDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${pad(d)}/${pad(m)}`;
}

/** Tamanho legível: "820 KB", "2,4 MB". */
export function fileSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Quantidade contratada por mês, ex.: "8 por mês". */
export function monthlyQty(qty: number | null): string | null {
  return qty && qty > 0 ? `${qty} por mês` : null;
}
