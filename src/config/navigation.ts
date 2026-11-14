import { canAny, type PermissionKey, type PermissionMap } from "@/domain/permissions";

export type NavIcon =
  | "home"
  | "tasks"
  | "clients"
  | "creatives"
  | "ads"
  | "reports"
  | "calendar"
  | "commercial"
  | "dashboard"
  | "boards"
  | "production"
  | "training"
  | "playbook"
  | "settings";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Basta ter uma destas permissões para ver o item. */
  anyOf?: PermissionKey[];
  /** Aparece na barra inferior do celular. */
  mobile?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

/**
 * Menu do sistema. Um item só entra aqui quando a tela existe e funciona
 * (regra nº 1 do CLAUDE.md): cada etapa acrescenta os seus.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Trabalho",
    items: [
      { href: "/inicio", label: "Início", icon: "home", mobile: true },
      { href: "/tarefas", label: "Minhas tarefas", icon: "tasks", anyOf: ["tasks.read"], mobile: true },
      { href: "/clientes", label: "Clientes", icon: "clients", anyOf: ["clients.read"], mobile: true },
      { href: "/agenda", label: "Agenda", icon: "calendar", anyOf: ["calendar.read"], mobile: true },
    ],
  },
  {
    label: "Produção",
    items: [
      { href: "/setores", label: "Visão do setor", icon: "dashboard", anyOf: ["sector.dashboard.read"] },
      { href: "/quadros", label: "Quadros", icon: "boards", anyOf: ["tasks.read"] },
      { href: "/criativos", label: "Criativos", icon: "creatives", anyOf: ["creatives.request.create", "creatives.produce", "creatives.review", "creatives.library.manage"] },
      { href: "/producao", label: "Controle geral", icon: "production", anyOf: ["dashboards.read"] },
      { href: "/playbooks", label: "Playbooks", icon: "playbook", anyOf: ["playbooks.apply", "playbooks.manage"] },
    ],
  },
  {
    label: "Equipe",
    items: [{ href: "/treinamentos", label: "Treinamentos", icon: "training", anyOf: ["trainings.read", "trainings.manage"] }],
  },
];

/** Menu que a pessoa vê (mesmo cálculo do layout e do "Ver como"). */
export function visibleNavGroups(permissions: PermissionMap): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.anyOf || canAny(permissions, i.anyOf)),
  })).filter((g) => g.items.length > 0);
}

export type SettingsPage = { href: string; label: string; description: string; perm?: PermissionKey };

/** Páginas de Configurações; sem perm = todo usuário. */
export const SETTINGS_PAGES: SettingsPage[] = [
  { href: "/configuracoes/perfil", label: "Meu perfil", description: "Nome, cargo, telefone, senha e privacidade" },
  { href: "/configuracoes/notificacoes", label: "Notificações", description: "O que avisar e em quais aparelhos" },
  { href: "/configuracoes/usuarios", label: "Usuários", description: "Convites, papéis, setores e desativação", perm: "users.manage" },
  { href: "/configuracoes/papeis", label: "Papéis e permissões", description: "O que cada papel pode ver e fazer", perm: "roles.manage" },
  { href: "/configuracoes/servicos", label: "Serviços", description: "Serviços vendidos, quantidades e abas que liberam", perm: "settings.manage" },
  { href: "/configuracoes/onboarding", label: "Onboarding", description: "Ficha, checklist e quem é avisado de cliente novo", perm: "settings.manage" },
  { href: "/configuracoes/rotinas", label: "Rotinas e modelos", description: "Prazos fixos da semana por serviço e modelos de demanda", perm: "tasks.boards.configure" },
  { href: "/configuracoes/fluxos", label: "Fluxos de produção", description: "Etapas de vídeo, design, post, gravação e site", perm: "tasks.boards.configure" },
  { href: "/configuracoes/setores", label: "Setores", description: "Setores da agência e quem faz parte", perm: "settings.manage" },
  { href: "/configuracoes/auditoria", label: "Auditoria", description: "Quem alterou o quê, com antes e depois", perm: "audit.read" },
  { href: "/configuracoes/privacidade", label: "Privacidade (LGPD)", description: "Pedidos sobre dados pessoais e dados do controlador", perm: "privacy.manage" },
];

export function visibleSettingsPages(permissions: PermissionMap): SettingsPage[] {
  return SETTINGS_PAGES.filter((p) => !p.perm || permissions[p.perm]);
}
