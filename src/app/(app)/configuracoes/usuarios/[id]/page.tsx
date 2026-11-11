import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getRolePermissions, getUserAccess, listPermissions, listRoles, listSectors, listUsers } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/domain/shared/dates";
import { AccessForm } from "./access-form";
import { OverridesTable } from "./overrides-table";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "Usuário" };

export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("users.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [users, roles, sectors, permissions] = await Promise.all([listUsers(), listRoles(), listSectors(), listPermissions()]);
  const user = users.find((u) => u.id === id);
  if (!user) notFound();
  const access = await getUserAccess(id);
  const rolePerms = await getRolePermissions(user.roles.map((r) => r.id));

  const isSelf = user.id === me.id;
  const targetIsAdmin = user.roles.some((r) => r.key === "admin");
  const locked = isSelf || (targetIsAdmin && !me.isAdmin);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Usuários", href: "/configuracoes/usuarios" }, { label: user.full_name || user.email }]}
        title={user.full_name || user.email}
        description={
          <>
            {user.email} · no sistema desde {formatDateTime(user.created_at)}
            {!user.is_active && user.deactivated_at && <> · desativado em {formatDateTime(user.deactivated_at)}</>}
          </>
        }
        actions={
          <>
            <Link href={`/configuracoes/usuarios/${id}/ver-como`} className={buttonVariants({ variant: "outline" })}>
              <Eye aria-hidden="true" /> Ver como
            </Link>
            <UserActions userId={id} name={user.full_name || user.email} active={user.is_active} canToggle={!locked} />
          </>
        }
      />
      <PageBody className="grid max-w-4xl gap-10">
        {!user.is_active && <Badge variant="outline" className="justify-self-start">Acesso desativado</Badge>}
        <section aria-labelledby="acesso" className="grid gap-3">
          <h2 id="acesso" className="text-base font-semibold">
            Papel e setores
          </h2>
          {locked && (
            <p className="text-sm text-muted-foreground">
              {isSelf ? "Você não pode alterar o seu próprio acesso. Peça a outro administrador." : "Somente um administrador altera o acesso de outro administrador."}
            </p>
          )}
          <AccessForm
            userId={id}
            disabled={locked}
            roles={roles.filter((r) => me.isAdmin || r.key !== "admin").map((r) => ({ id: r.id, name: r.name }))}
            sectors={sectors.map((s) => ({ id: s.id, name: s.name }))}
            defaults={{ roleId: user.roles[0]?.id ?? "", sectorIds: user.sectors.map((s) => s.id), jobTitle: user.job_title ?? "" }}
          />
        </section>

        <section aria-labelledby="excecoes" className="grid gap-3">
          <div className="grid gap-1">
            <h2 id="excecoes" className="text-base font-semibold">
              Permissões desta pessoa
            </h2>
            <p className="text-sm text-muted-foreground">
              Vem do papel. Use uma exceção para liberar ou bloquear algo só para esta pessoa. Vale na hora.
            </p>
          </div>
          <OverridesTable
            userId={id}
            editable={Boolean(me.permissions["roles.manage"]) && !locked}
            permissions={permissions}
            roleScopes={Object.fromEntries(rolePerms.map((r) => [r.permission_key, r.scope]))}
            overrides={Object.fromEntries(access.overrides.map((o) => [o.permission_key, { effect: o.effect, scope: o.scope }]))}
            effective={Object.fromEntries(access.effective.map((e) => [e.permission_key, e.scope]))}
          />
        </section>
      </PageBody>
    </>
  );
}
