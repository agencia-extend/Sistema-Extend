import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listUsers } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState, ErrorState } from "@/components/app/states";
import { formatDateTime } from "@/domain/shared/dates";
import { AuditFilters } from "./audit-filters";
import { ChangeList } from "./change-list";
import { ENTITY_LABEL, ACTION_LABEL, PERIODS, periodStart } from "./labels";

export const metadata: Metadata = { title: "Auditoria" };

const PAGE = 50;

type Search = { usuario?: string; tabela?: string; periodo?: string; pagina?: string };

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("audit.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const period = sp.periodo && sp.periodo in PERIODS ? sp.periodo : "30d";

  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, changes, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.usuario && /^[0-9a-f-]{36}$/.test(sp.usuario)) query = query.eq("actor_id", sp.usuario);
  if (sp.tabela && sp.tabela in ENTITY_LABEL) query = query.eq("entity_type", sp.tabela);
  const start = periodStart(period);
  if (start) query = query.gte("created_at", start.toISOString());

  const [{ data, count, error }, users] = await Promise.all([query, listUsers()]);
  const names = new Map(users.map((u) => [u.id, u.full_name || u.email]));
  const rows = (data ?? []) as { id: number; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; changes: Record<string, unknown>; created_at: string }[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (sp.usuario) u.set("usuario", sp.usuario);
    if (sp.tabela) u.set("tabela", sp.tabela);
    u.set("periodo", period);
    u.set("pagina", String(p));
    return `?${u}`;
  };

  return (
    <>
      <PageHeader title="Auditoria" description="Registro de quem criou, alterou ou excluiu o quê. Somente leitura." />
      <PageBody className="grid gap-4">
        <AuditFilters users={users.map((u) => ({ id: u.id, name: u.full_name || u.email }))} usuario={sp.usuario ?? ""} tabela={sp.tabela ?? ""} periodo={period} />
        {error ? (
          <ErrorState description="Não foi possível carregar a auditoria. Recarregue a página." />
        ) : rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="Nada registrado com esses filtros" description="Tente um período maior ou limpe os filtros." />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {rows.map((r) => (
              <li key={r.id} className="grid gap-1.5 px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{r.actor_id ? (names.get(r.actor_id) ?? "Usuário removido") : "Sistema"}</span>
                  <span className="text-muted-foreground">{ACTION_LABEL[r.action] ?? r.action}</span>
                  <span>{ENTITY_LABEL[r.entity_type] ?? r.entity_type}</span>
                  {r.entity_type === "profiles" && r.entity_id && names.get(r.entity_id) && <span className="text-muted-foreground">({names.get(r.entity_id)})</span>}
                  <time className="ml-auto text-xs text-muted-foreground tabular" dateTime={r.created_at}>
                    {formatDateTime(r.created_at)}
                  </time>
                </div>
                <ChangeList action={r.action} changes={r.changes} names={Object.fromEntries(names)} />
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Páginas" className="flex items-center justify-between text-sm">
            {page > 1 ? <Link href={qs(page - 1)} className="font-medium text-primary hover:underline">Anteriores</Link> : <span />}
            <span className="text-muted-foreground tabular">
              Página {page} de {pages}
            </span>
            {page < pages ? <Link href={qs(page + 1)} className="font-medium text-primary hover:underline">Seguintes</Link> : <span />}
          </nav>
        )}
      </PageBody>
    </>
  );
}
