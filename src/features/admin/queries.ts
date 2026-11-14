import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PermissionScope } from "@/domain/permissions";

export type RoleRow = { id: string; key: string; name: string; description: string; is_system: boolean };
export type SectorRow = { id: string; key: string; name: string; area: "gestao" | "trafego" | "criacao"; color: string; position: number; is_active: boolean };
export type PermissionRow = { key: string; module: string; label: string; scoped: boolean; position: number };
export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  created_at: string;
  roles: { id: string; key: string; name: string }[];
  sectors: { id: string; name: string; color: string }[];
};
export type InvitationRow = {
  id: string;
  email: string;
  full_name: string;
  status: "pendente" | "aceito" | "cancelado";
  expires_at: string;
  send_count: number;
  last_sent_at: string;
  expired: boolean;
  role: { name: string } | null;
};

function arr<T>(v: T | T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

export async function listRoles(): Promise<RoleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").select("id, key, name, description, is_system").order("is_system", { ascending: false }).order("name");
  if (error) throw error;
  // Administrador primeiro.
  return ((data ?? []) as RoleRow[]).sort((a, b) => Number(b.key === "admin") - Number(a.key === "admin"));
}

export async function listSectors(): Promise<SectorRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sectors").select("id, key, name, area, color, position, is_active").order("position");
  if (error) throw error;
  return (data ?? []) as SectorRow[];
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("permissions").select("key, module, label, scoped, position").order("position");
  if (error) throw error;
  return (data ?? []) as PermissionRow[];
}

export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, job_title, is_active, deactivated_at, created_at, user_roles(roles(id, key, name)), profile_sectors(sectors(id, name, color))")
    .is("portal_client_id", null)
    .order("full_name");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    job_title: p.job_title,
    is_active: p.is_active,
    deactivated_at: p.deactivated_at,
    created_at: p.created_at,
    roles: arr(p.user_roles as unknown as { roles: UserRow["roles"][number] | null }[]).flatMap((r) => arr(r.roles)),
    sectors: arr(p.profile_sectors as unknown as { sectors: UserRow["sectors"][number] | null }[]).flatMap((s) => arr(s.sectors)),
  }));
}

export async function listInvitations(): Promise<InvitationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, full_name, status, expires_at, send_count, last_sent_at, roles(name)")
    .eq("status", "pendente")
    .is("portal_client_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return (data ?? []).map((i) => ({
    ...i,
    expired: new Date(i.expires_at).getTime() < now,
    role: arr(i.roles as { name: string } | { name: string }[] | null)[0] ?? null,
  })) as InvitationRow[];
}

export async function getUserAccess(userId: string) {
  const supabase = await createClient();
  const [overrides, effective] = await Promise.all([
    supabase.from("user_permission_overrides").select("permission_key, effect, scope").eq("user_id", userId),
    supabase.rpc("user_effective_permissions", { p_user: userId }),
  ]);
  if (overrides.error) throw overrides.error;
  if (effective.error) throw effective.error;
  return {
    overrides: (overrides.data ?? []) as { permission_key: string; effect: "grant" | "deny"; scope: PermissionScope }[],
    effective: (effective.data ?? []) as { permission_key: string; scope: PermissionScope }[],
  };
}

export async function getRolePermissions(roleIds: string[]) {
  if (!roleIds.length) return [] as { role_id: string; permission_key: string; scope: PermissionScope }[];
  const supabase = await createClient();
  const { data, error } = await supabase.from("role_permissions").select("role_id, permission_key, scope").in("role_id", roleIds);
  if (error) throw error;
  return (data ?? []) as { role_id: string; permission_key: string; scope: PermissionScope }[];
}
