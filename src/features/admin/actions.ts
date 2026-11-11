"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/domain/shared/result";
import {
  duplicateRoleSchema,
  overrideSchema,
  rolePermissionSchema,
  roleSchema,
  sectorSchema,
  setUserActiveSchema,
  updateUserAccessSchema,
  userIdSchema,
} from "./schemas";
import { z } from "zod";

const USERS = "/configuracoes/usuarios";
const ROLES = "/configuracoes/papeis";

// --- Usuários -------------------------------------------------------------------

export const setUserActive = defineAction({ schema: setUserActiveSchema, permission: "users.manage" }, async ({ userId, active }) => {
  const supabase = await createClient();
  // A RPC aplica as travas (não desativar a si mesmo, nem um admin sem ser admin, último admin).
  must(await supabase.rpc("admin_set_user_active", { p_user: userId, p_active: active }));
  // Derruba os tokens de atualização: a sessão cai também nos outros aparelhos.
  if (process.env.SUPABASE_SECRET_KEY) {
    await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  }
  revalidatePath(USERS);
  revalidatePath(`${USERS}/${userId}`);
  return ok(null, active ? "Acesso reativado." : "Acesso desativado. A pessoa foi desconectada.");
});

export const updateUserAccess = defineAction(
  { schema: updateUserAccessSchema, permission: "users.manage" },
  async ({ userId, roleId, sectorIds, jobTitle }) => {
    const supabase = await createClient();
    must(await supabase.rpc("admin_set_user_role", { p_user: userId, p_role: roleId }));

    const current = must(await supabase.from("profile_sectors").select("sector_id").eq("profile_id", userId)) as { sector_id: string }[];
    const have = new Set(current.map((r) => r.sector_id));
    const want = new Set(sectorIds);
    const toRemove = [...have].filter((id) => !want.has(id));
    const toAdd = [...want].filter((id) => !have.has(id));
    if (toRemove.length) must(await supabase.from("profile_sectors").delete().eq("profile_id", userId).in("sector_id", toRemove));
    if (toAdd.length) must(await supabase.from("profile_sectors").insert(toAdd.map((sector_id) => ({ profile_id: userId, sector_id }))));

    if (jobTitle !== undefined && process.env.SUPABASE_SECRET_KEY) {
      // Cargo é dado administrativo: a coluna não é liberada para outros usuários pela API.
      must(await createAdminClient().from("profiles").update({ job_title: jobTitle || null }).eq("id", userId));
    }
    revalidatePath(USERS);
    revalidatePath(`${USERS}/${userId}`);
    return ok(null, "Acesso atualizado.");
  },
);

export const setUserOverride = defineAction(
  { schema: overrideSchema, permission: "roles.manage" },
  async ({ userId, permissionKey, effect, scope }) => {
    const supabase = await createClient();
    if (effect === "none") {
      must(await supabase.from("user_permission_overrides").delete().eq("user_id", userId).eq("permission_key", permissionKey));
    } else {
      must(
        await supabase
          .from("user_permission_overrides")
          .upsert({ user_id: userId, permission_key: permissionKey, effect, scope }, { onConflict: "user_id,permission_key" }),
      );
    }
    revalidatePath(`${USERS}/${userId}`);
    return ok(null, effect === "none" ? "Exceção removida." : effect === "grant" ? "Permissão concedida." : "Permissão bloqueada.");
  },
);

export const sendTestNotification = defineAction({ schema: userIdSchema }, async ({ userId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("send_test_notification", { p_user: userId }));
  return ok(null, "Notificação de teste enviada.");
});

// --- Papéis ---------------------------------------------------------------------

const newRoleKey = () => `papel_${crypto.randomUUID().replace(/[^a-f]/g, "").slice(0, 10) || "novo"}`;

export const saveRole = defineAction({ schema: roleSchema, permission: "roles.manage" }, async ({ id, name, description }, { user }) => {
  const supabase = await createClient();
  if (id) {
    must(await supabase.from("roles").update({ name, description }).eq("id", id));
    revalidatePath(ROLES);
    revalidatePath(`${ROLES}/${id}`);
    return ok({ id }, "Papel salvo.");
  }
  const row = must(
    await supabase
      .from("roles")
      .insert({ organization_id: user.organizationId, key: newRoleKey(), name, description, is_system: false })
      .select("id")
      .single(),
  ) as { id: string };
  revalidatePath(ROLES);
  return ok({ id: row.id }, "Papel criado. Agora marque as permissões.");
});

export const deleteRole = defineAction({ schema: z.object({ roleId: z.uuid() }), permission: "roles.manage" }, async ({ roleId }) => {
  const supabase = await createClient();
  const { count } = await supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role_id", roleId);
  if (count) return fail("business_rule", `Há ${count} pessoa(s) com este papel. Troque o papel delas antes de excluir.`);
  const { count: inv } = await supabase.from("invitations").select("id", { count: "exact", head: true }).eq("role_id", roleId).eq("status", "pendente");
  if (inv) return fail("business_rule", "Há convites pendentes com este papel. Revogue-os antes de excluir.");
  must(await supabase.from("roles").delete().eq("id", roleId));
  revalidatePath(ROLES);
  return ok(null, "Papel excluído.");
});

export const setRolePermission = defineAction(
  { schema: rolePermissionSchema, permission: "roles.manage" },
  async ({ roleId, permissionKey, scope }) => {
    const supabase = await createClient();
    if (scope === null) {
      must(await supabase.from("role_permissions").delete().eq("role_id", roleId).eq("permission_key", permissionKey));
    } else {
      must(
        await supabase
          .from("role_permissions")
          .upsert({ role_id: roleId, permission_key: permissionKey, scope }, { onConflict: "role_id,permission_key" }),
      );
    }
    revalidatePath(`${ROLES}/${roleId}`);
    return ok(null);
  },
);

export const duplicateRole = defineAction({ schema: duplicateRoleSchema, permission: "roles.manage" }, async ({ roleId, name }) => {
  const supabase = await createClient();
  const id = must(await supabase.rpc("duplicate_role", { p_role: roleId, p_name: name })) as string;
  revalidatePath(ROLES);
  return ok({ id }, "Papel duplicado.");
});

// --- Setores --------------------------------------------------------------------

const sectorKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "setor";

export const saveSector = defineAction({ schema: sectorSchema, permission: "settings.manage" }, async (input, { user }) => {
  const supabase = await createClient();
  if (input.id) {
    must(
      await supabase
        .from("sectors")
        .update({ name: input.name, area: input.area, color: input.color, is_active: input.isActive })
        .eq("id", input.id),
    );
  } else {
    let key = sectorKey(input.name);
    if (key.length < 2) key = `${key}_s`;
    const { data: clash } = await supabase.from("sectors").select("id").eq("key", key).maybeSingle();
    if (clash) key = `${key.slice(0, 33)}_${Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 5) || "x"}`;
    const { count } = await supabase.from("sectors").select("id", { count: "exact", head: true });
    must(
      await supabase.from("sectors").insert({
        organization_id: user.organizationId,
        key,
        name: input.name,
        area: input.area,
        color: input.color,
        position: (count ?? 0) + 1,
      }),
    );
  }
  revalidatePath("/configuracoes/setores");
  return ok(null, input.id ? "Setor salvo." : "Setor criado.");
});
