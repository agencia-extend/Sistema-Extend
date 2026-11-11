import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { getUserAccess, listPermissions, listUsers } from "@/features/admin/queries";
import { visibleNavGroups, visibleSettingsPages } from "@/config/navigation";
import { isPermissionKey, SCOPE_LABEL, type PermissionMap } from "@/domain/permissions";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { SidebarNav } from "@/components/app/sidebar-nav";

export const metadata: Metadata = { title: "Ver como" };

// RF-PER-07: mostra exatamente o menu e as permissões efetivas da pessoa (somente leitura).
export default async function VerComoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("users.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [users, permissions] = await Promise.all([listUsers(), listPermissions()]);
  const user = users.find((u) => u.id === id);
  if (!user) notFound();

  const { effective } = await getUserAccess(id);
  const map: PermissionMap = {};
  for (const e of effective) if (isPermissionKey(e.permission_key)) map[e.permission_key] = e.scope;
  const groups = user.is_active ? visibleNavGroups(map) : [];
  const settings = user.is_active ? visibleSettingsPages(map) : [];
  const name = user.full_name || user.email;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Usuários", href: "/configuracoes/usuarios" },
          { label: name, href: `/configuracoes/usuarios/${id}` },
          { label: "Ver como" },
        ]}
        title={`Ver como ${name}`}
        description="Pré-visualização somente leitura do que esta pessoa vê. Nada aqui altera dados."
      />
      <PageBody className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-night-line bg-night">
          <div className="flex h-14 items-center px-5">
            <Image src="/brand/logo.png" alt="" width={120} height={23} className="h-6 w-auto" />
          </div>
          {user.is_active ? (
            <SidebarNav groups={groups} showSettings preview />
          ) : (
            <p className="px-5 pb-5 text-sm text-night-dim">Acesso desativado: esta pessoa não entra no sistema.</p>
          )}
        </div>
        <div className="grid content-start gap-6">
          <section className="grid gap-2">
            <h2 className="text-base font-semibold">Configurações que aparecem</h2>
            <p className="text-sm text-muted-foreground">{settings.map((s) => s.label).join(", ") || "Nenhuma"}</p>
          </section>
          <section className="grid gap-2">
            <h2 className="text-base font-semibold">O que pode fazer ({effective.length})</h2>
            {effective.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma permissão. A pessoa só vê o Início e o próprio perfil.</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {permissions
                  .filter((p) => map[p.key as keyof PermissionMap])
                  .map((p) => (
                    <li key={p.key} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
                      <span>
                        <span className="text-muted-foreground">{p.module} · </span>
                        {p.label}
                      </span>
                      {p.scoped && <span className="text-muted-foreground">{SCOPE_LABEL[map[p.key as keyof PermissionMap]!]}</span>}
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>
      </PageBody>
    </>
  );
}
