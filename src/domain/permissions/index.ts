// Espelho tipado do catálogo em supabase/migrations/*_fundacao.sql (tabela public.permissions).
// A autorização de verdade acontece na RLS; isto serve para a interface e para
// checagens antecipadas nas Server Actions.

export const PERMISSION_KEYS = [
  "clients.read",
  "clients.manage",
  "clients.onboarding.read",
  "clients.onboarding.manage",
  "clients.import",
  "commercial.handoff.create",
  "crm.leads.read",
  "crm.leads.manage",
  "crm.pipeline.configure",
  "prospector.use",
  "proposals.read",
  "proposals.manage",
  "proposals.templates.manage",
  "tasks.read",
  "tasks.manage",
  "tasks.assign",
  "tasks.boards.configure",
  "sector.dashboard.read",
  "calendar.read",
  "calendar.manage",
  "creatives.request.create",
  "creatives.produce",
  "creatives.review",
  "creatives.performance.read",
  "creatives.library.manage",
  "ads.read",
  "ads.connect",
  "ads.access.manage",
  "ads.manage",
  "campaigns.plan",
  "reports.manage",
  "alerts.read",
  "optimization.manage",
  "content.read",
  "content.publish",
  "inbox.read",
  "inbox.reply",
  "inbox.manage",
  "dashboards.read",
  "trainings.read",
  "trainings.manage",
  "users.manage",
  "roles.manage",
  "settings.manage",
  "integrations.manage",
  "tags.manage",
  "audit.read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionScope = "own" | "clients" | "sector" | "all";
export type PermissionMap = Partial<Record<PermissionKey, PermissionScope>>;

export const SCOPES: readonly PermissionScope[] = ["own", "clients", "sector", "all"];

export const SCOPE_LABEL: Record<PermissionScope, string> = {
  own: "Só os meus",
  clients: "Clientes em que estou marcado",
  sector: "Do meu setor",
  all: "Todos",
};

export const SCOPE_SHORT: Record<PermissionScope, string> = {
  own: "Meus",
  clients: "Clientes",
  sector: "Setor",
  all: "Todos",
};

const RANK: Record<PermissionScope, number> = { own: 1, clients: 2, sector: 3, all: 4 };

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export function isScope(value: string): value is PermissionScope {
  return (SCOPES as readonly string[]).includes(value);
}

export function canAny(perms: PermissionMap, keys: readonly PermissionKey[]): boolean {
  return keys.some((k) => perms[k] !== undefined);
}

export function scopeAtLeast(scope: PermissionScope | undefined | null, min: PermissionScope): boolean {
  return scope ? RANK[scope] >= RANK[min] : false;
}

export type PermissionOrigin = "papel" | "excecao" | "bloqueio";
export type Override = { effect: "grant" | "deny"; scope: PermissionScope };

/**
 * Permissão efetiva e de onde ela vem. Espelha private.user_perm_scope:
 * "negar" anula tudo; senão vale o maior escopo entre o papel e a exceção "conceder".
 */
export function effectivePermission(
  role: PermissionScope | undefined,
  override: Override | undefined,
): { scope: PermissionScope | null; origin: PermissionOrigin | null } {
  if (override?.effect === "deny") return { scope: null, origin: "bloqueio" };
  const grant = override?.effect === "grant" ? override.scope : undefined;
  if (grant && (!role || RANK[grant] > RANK[role])) return { scope: grant, origin: "excecao" };
  return role ? { scope: role, origin: "papel" } : { scope: null, origin: null };
}

/** Pode repassar a permissão neste escopo? Espelha private.can_delegate. */
export function canDelegate(mine: PermissionMap, isAdmin: boolean, key: PermissionKey, scope: PermissionScope): boolean {
  return isAdmin || scopeAtLeast(mine[key], scope);
}
