import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { listInvitations, listRoles, listSectors, listUsers } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/domain/shared/dates";
import { InviteDialog } from "./invite-dialog";
import { InvitationActions } from "./invitation-actions";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const me = await requirePermission("users.manage");
  const [users, invitations, roles, sectors] = await Promise.all([listUsers(), listInvitations(), listRoles(), listSectors()]);
  const active = users.filter((u) => u.is_active);
  const inactive = users.filter((u) => !u.is_active && u.deactivated_at);
  const invitableRoles = roles.filter((r) => me.isAdmin || r.key !== "admin").map((r) => ({ id: r.id, name: r.name }));

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Quem tem acesso ao sistema, com qual papel e em quais setores."
        actions={<InviteDialog roles={invitableRoles} sectors={sectors.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }))} />}
      />
      <PageBody className="grid gap-8">
        <section aria-labelledby="ativos" className="grid gap-3">
          <h2 id="ativos" className="text-base font-semibold">
            Com acesso <span className="font-normal text-muted-foreground tabular">({active.length})</span>
          </h2>
          {active.length === 0 ? (
            <EmptyState icon={Users} title="Ninguém por aqui ainda" description="Convide a equipe da Extend pelo botão “Convidar pessoa”." />
          ) : (
            <UserList users={active} meId={me.id} />
          )}
        </section>

        <section id="convites" aria-labelledby="convites-t" className="grid scroll-mt-20 gap-3">
          <h2 id="convites-t" className="text-base font-semibold">
            Convites aguardando aceite <span className="font-normal text-muted-foreground tabular">({invitations.length})</span>
          </h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum convite pendente. Convites aceitos viram usuários na lista acima.</p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {invitations.map((i) => {
                const expired = i.expired;
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <p className="truncate text-sm font-medium">{i.full_name || i.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {i.email} · {i.role?.name ?? "Sem papel"} · enviado {i.send_count}× ·{" "}
                        {expired ? <span className="text-danger">expirou em {formatDateTime(i.expires_at)}</span> : `vale até ${formatDateTime(i.expires_at)}`}
                      </p>
                    </div>
                    <InvitationActions id={i.id} email={i.email} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {inactive.length > 0 && (
          <section aria-labelledby="inativos" className="grid gap-3">
            <h2 id="inativos" className="text-base font-semibold">
              Desativados <span className="font-normal text-muted-foreground tabular">({inactive.length})</span>
            </h2>
            <UserList users={inactive} meId={me.id} />
          </section>
        )}
      </PageBody>
    </>
  );
}

function UserList({ users, meId }: { users: Awaited<ReturnType<typeof listUsers>>; meId: string }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {users.map((u) => (
        <li key={u.id}>
          <Link href={`/configuracoes/usuarios/${u.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-muted/50">
            <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
              <p className="truncate text-sm font-medium">
                {u.full_name || u.email}
                {u.id === meId && <span className="font-normal text-muted-foreground"> (você)</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{[u.email, u.job_title].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {u.roles.map((r) => (
                <Badge key={r.id} variant={r.key === "admin" ? "default" : "secondary"}>
                  {r.name}
                </Badge>
              ))}
              {u.sectors.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                  <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  {s.name}
                </span>
              ))}
              {!u.is_active && <Badge variant="outline">Desativado</Badge>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
