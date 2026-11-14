import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPermissionKey, type PermissionKey, type PermissionMap, type PermissionScope } from "@/domain/permissions";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  avatarPath: string | null;
  jobTitle: string | null;
  organizationId: string;
  organizationName: string;
  isAdmin: boolean;
  roles: { id: string; key: string; name: string }[];
  sectors: { id: string; key: string; name: string }[];
  permissions: PermissionMap;
  /** Usuário da área do cliente: o cliente dele (sem acesso ao sistema interno). */
  portalClientId: string | null;
};

type Session = { state: "anonymous" } | { state: "inactive"; userId: string } | { state: "active"; user: CurrentUser };
type Ref = { id: string; key: string; name: string };

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/** Sessão da requisição atual (memoizada por requisição). */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { state: "anonymous" };

  const [profileRes, permsRes, rolesRes, sectorsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, avatar_path, job_title, is_active, organization_id, portal_client_id, organizations(name)")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("my_permissions"),
    supabase.from("user_roles").select("roles(id, key, name)").eq("user_id", userId),
    supabase.from("profile_sectors").select("sectors(id, key, name)").eq("profile_id", userId),
  ]);

  const profile = profileRes.data;
  if (!profile || !profile.is_active) return { state: "inactive", userId };

  const permissions: PermissionMap = {};
  for (const row of (permsRes.data ?? []) as { permission_key: string; scope: PermissionScope }[]) {
    if (isPermissionKey(row.permission_key)) permissions[row.permission_key] = row.scope;
  }
  const roles = (rolesRes.data ?? []).map((r) => one(r.roles as Ref | Ref[] | null)).filter((r): r is Ref => Boolean(r));
  const sectors = (sectorsRes.data ?? []).map((r) => one(r.sectors as Ref | Ref[] | null)).filter((r): r is Ref => Boolean(r));

  return {
    state: "active",
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name || profile.email.split("@")[0],
      avatarPath: profile.avatar_path,
      jobTitle: profile.job_title,
      organizationId: profile.organization_id,
      organizationName: one(profile.organizations as { name: string } | { name: string }[] | null)?.name ?? "Agência Extend",
      isAdmin: roles.some((r) => r.key === "admin"),
      roles,
      sectors,
      permissions,
      portalClientId: profile.portal_client_id,
    },
  };
});

/** Usuário ativo da requisição, ou null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const s = await getSession();
  return s.state === "active" ? s.user : null;
}

/** Sessão ativa de qualquer tipo (equipe ou cliente); conta desativada é desconectada. */
async function requireAnyUser(): Promise<CurrentUser> {
  const s = await getSession();
  if (s.state === "anonymous") redirect("/login");
  if (s.state === "inactive") redirect("/sair?motivo=desativado");
  return s.user;
}

/** Exige sessão ativa da equipe; usuário do cliente vai para a área do cliente. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await requireAnyUser();
  if (user.portalClientId) redirect("/portal");
  return user;
}

export const PORTAL_PREVIEW_COOKIE = "ext_portal_previa";

export type PortalSession = { user: CurrentUser; clientId: string; preview: boolean };

/**
 * Área do cliente: o usuário do cliente vê o próprio cliente; a equipe que vê o cliente abre a prévia
 * (cliente escolhido em /portal/previa/[id]). O banco confere de novo em cada consulta (portal_*).
 */
export const requirePortal = cache(async (): Promise<PortalSession> => {
  const user = await requireAnyUser();
  if (user.portalClientId) return { user, clientId: user.portalClientId, preview: false };
  const id = (await cookies()).get(PORTAL_PREVIEW_COOKIE)?.value;
  if (!user.permissions["clients.read"] || !id || !/^[0-9a-f-]{36}$/.test(id)) redirect("/inicio");
  return { user, clientId: id, preview: true };
});

/** Exige uma das permissões; senão mostra a tela "Sem acesso". */
export async function requirePermission(key: PermissionKey | PermissionKey[]): Promise<CurrentUser> {
  const user = await requireUser();
  const keys = Array.isArray(key) ? key : [key];
  if (!keys.some((k) => user.permissions[k])) redirect(`/sem-acesso?p=${encodeURIComponent(keys[0])}`);
  return user;
}
