import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { getRolePermissions, listPermissions, listRoles, listUsers } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { SCOPE_SHORT } from "@/domain/permissions";
import { RoleDialog } from "./role-dialog";
import { CompareForm } from "./compare-form";

export const metadata: Metadata = { title: "Papéis e permissões" };

export default async function PapeisPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  await requirePermission("roles.manage");
  const { a, b } = await searchParams;
  const [roles, users, permissions] = await Promise.all([listRoles(), listUsers(), listPermissions()]);
  const members = new Map<string, number>();
  for (const u of users.filter((x) => x.is_active)) for (const r of u.roles) members.set(r.id, (members.get(r.id) ?? 0) + 1);

  const roleA = roles.find((r) => r.id === a);
  const roleB = roles.find((r) => r.id === b);
  const comparePerms = roleA && roleB ? await getRolePermissions([roleA.id, roleB.id]) : [];
  const scopeOf = (roleId: string, key: string) => comparePerms.find((p) => p.role_id === roleId && p.permission_key === key)?.scope;

  return (
    <>
      <PageHeader title="Papéis e permissões" description="Cada pessoa tem um papel. O papel define o que ela vê e faz, e em quais clientes." actions={<RoleDialog />} />
      <PageBody className="grid gap-10">
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {roles.map((r) => (
            <li key={r.id}>
              <Link href={`/configuracoes/papeis/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50">
                <div className="grid min-w-0 flex-1 basis-64 gap-0.5">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{r.description || "Sem descrição"}</p>
                </div>
                <span className="text-xs text-muted-foreground tabular">
                  {members.get(r.id) ?? 0} {(members.get(r.id) ?? 0) === 1 ? "pessoa" : "pessoas"}
                </span>
                {r.is_system ? <Badge variant="secondary">Padrão</Badge> : <Badge variant="outline">Personalizado</Badge>}
              </Link>
            </li>
          ))}
        </ul>

        <section aria-labelledby="comparar" className="grid gap-3">
          <h2 id="comparar" className="text-base font-semibold">
            Comparar dois papéis
          </h2>
          <CompareForm roles={roles.map((r) => ({ id: r.id, name: r.name }))} a={a} b={b} />
          {roleA && roleB && (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-2 font-medium">Permissão</th>
                    <th className="w-36 px-4 py-2 font-medium">{roleA.name}</th>
                    <th className="w-36 px-4 py-2 font-medium">{roleB.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p) => {
                    const sa = scopeOf(roleA.id, p.key);
                    const sb = scopeOf(roleB.id, p.key);
                    if (!sa && !sb) return null;
                    const differs = sa !== sb;
                    return (
                      <tr key={p.key} className={differs ? "bg-warning-soft/60" : undefined}>
                        <td className="border-t px-4 py-2">
                          <span className="text-muted-foreground">{p.module} · </span>
                          {p.label}
                        </td>
                        <td className="border-t px-4 py-2">{sa ? (p.scoped ? SCOPE_SHORT[sa] : "Sim") : "—"}</td>
                        <td className="border-t px-4 py-2">{sb ? (p.scoped ? SCOPE_SHORT[sb] : "Sim") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">Linhas destacadas são diferentes entre os dois papéis.</p>
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}
