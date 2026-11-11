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
    items: [{ href: "/inicio", label: "Início", icon: "home", mobile: true }],
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
  { href: "/configuracoes/perfil", label: "Meu perfil", description: "Nome, cargo, telefone e senha" },
  { href: "/configuracoes/notificacoes", label: "Notificações", description: "O que avisar e em quais aparelhos" },
  { href: "/configuracoes/usuarios", label: "Usuários", description: "Convites, papéis, setores e desativação", perm: "users.manage" },
  { href: "/configuracoes/papeis", label: "Papéis e permissões", description: "O que cada papel pode ver e fazer", perm: "roles.manage" },
  { href: "/configuracoes/setores", label: "Setores", description: "Setores da agência e quem faz parte", perm: "settings.manage" },
  { href: "/configuracoes/auditoria", label: "Auditoria", description: "Quem alterou o quê, com antes e depois", perm: "audit.read" },
];

export function visibleSettingsPages(permissions: PermissionMap): SettingsPage[] {
  return SETTINGS_PAGES.filter((p) => !p.perm || permissions[p.perm]);
}
