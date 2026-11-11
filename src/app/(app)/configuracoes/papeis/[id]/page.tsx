import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { getRolePermissions, listPermissions, listRoles, listUsers } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { FormAlert } from "@/components/app/form-field";
import { RoleDialog } from "../role-dialog";
import { PermissionMatrix } from "./permission-matrix";
import { RoleMenu } from "./role-menu";

export const metadata: Metadata = { title: "Papel" };

export default async function PapelPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("roles.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [roles, permissions, users] = await Promise.all([listRoles(), listPermissions(), listUsers()]);
  const role = roles.find((r) => r.id === id);
  if (!role) notFound();
  const perms = await getRolePermissions([id]);
  const people = users.filter((u) => u.is_active && u.roles.some((r) => r.id === id));
  const isAdminRole = role.key === "admin";
  const isMine = me.roles.some((r) => r.id === id);
  const editable = !isAdminRole && (me.isAdmin || !isMine);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Papéis e permissões", href: "/configuracoes/papeis" }, { label: role.name }]}
        title={role.name}
        description={role.description || undefined}
        actions={
          <>
            {!isAdminRole && <RoleDialog role={{ id: role.id, name: role.name, description: role.description }} />}
            <RoleMenu roleId={role.id} roleName={role.name} deletable={!role.is_system} />
          </>
        }
      />
      <PageBody className="grid max-w-4xl gap-6">
        {isAdminRole && <FormAlert tone="info">O Administrador tem todas as permissões e não pode ser alterado.</FormAlert>}
        {!isAdminRole && !editable && <FormAlert tone="info">Você não pode alterar as permissões do seu próprio papel.</FormAlert>}
        <p className="text-sm text-muted-foreground">
          {people.length ? `Usado por: ${people.map((p) => p.full_name || p.email).join(", ")}.` : "Ninguém usa este papel ainda."} Mudanças valem na hora.
        </p>
        <PermissionMatrix
          roleId={role.id}
          editable={editable}
          permissions={permissions}
          initial={Object.fromEntries(perms.map((p) => [p.permission_key, p.scope]))}
        />
      </PageBody>
    </>
  );
}
