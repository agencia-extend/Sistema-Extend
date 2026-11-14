import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { currentServices, getClient, getHandoff, listCatalog, listMonthTasks, listTeam, listTimeline, upcomingServices } from "@/features/clients/queries";
import { listSectors } from "@/features/admin/queries";
import { deliveredPercent, type ClientStatus } from "@/domain/clients";
import { formatDate, formatDateTime, formatRelative } from "@/domain/shared/dates";
import { formatBRL } from "@/domain/shared/money";
import { ProgressBar } from "@/features/clients/components/bits";
import { ServicesCard } from "@/features/clients/components/services-card";
import { TeamCard } from "@/features/clients/components/team-card";
import { DataCard } from "@/features/clients/components/data-card";
import { AccountsCard } from "@/features/clients/components/accounts-card";
import { PromisesCard } from "@/features/clients/components/promises-card";
import { Section } from "@/features/clients/components/section";
import { currentMonth, listClientMonths } from "@/features/media/queries";
import { periodLabel } from "@/domain/media";
import { todayKey } from "@/domain/media";
import { listClientRuns } from "@/features/playbooks/queries";
import { ClientRuns } from "@/features/playbooks/components/client-runs";

export default async function ClientOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  const client = (await getClient(id))!;
  const now = new Date();
  const month = currentMonth(await listClientMonths(id));
  const [catalog, team, sectors, tasks, timeline, handoff, runs] = await Promise.all([
    listCatalog(),
    listTeam(),
    listSectors(),
    month ? listMonthTasks(id, month.startsOn) : Promise.resolve([]),
    listTimeline(id),
    user.permissions["clients.onboarding.read"] ? getHandoff(id) : Promise.resolve(null),
    listClientRuns(id),
  ]);
  const canManage = Boolean(user.permissions["clients.manage"] || user.permissions["clients.onboarding.manage"]);
  const status = client.status as ClientStatus;
  const live = tasks.filter((t) => t.status !== "cancelado");
  const done = live.filter((t) => t.status === "concluido" || t.status === "aprovado").length;
  const overdue = live.filter((t) => t.status !== "concluido" && t.status !== "aprovado" && t.due_at && new Date(t.due_at) < now);
  const next = live
    .filter((t) => t.status !== "concluido" && t.status !== "aprovado" && t.due_at && new Date(t.due_at) >= now)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!))
    .slice(0, 5);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 content-start gap-6">
        {status !== "onboarding" && (
          <Section title={month ? `Mês ${month.number} (${periodLabel(month.startsOn, month.endsOn)})` : "Este mês"}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ProgressBar value={deliveredPercent(done, live.length)} label={`Entregue (${done}/${live.length})`} />
              <div className="grid min-w-0 content-start gap-2 text-sm">
                {overdue.length > 0 ? (
                  <Link href={`/clientes/${id}/midias`} className="inline-flex items-center gap-1.5 font-medium text-danger hover:underline">
                    <AlertTriangle className="size-4" aria-hidden="true" /> {overdue.length} demanda(s) atrasada(s)
                  </Link>
                ) : (
                  <p className="text-muted-foreground">Nenhuma demanda atrasada.</p>
                )}
                {next.length > 0 && (
                  <ul className="grid gap-1">
                    {next.map((t) => (
                      <li key={t.id} className="flex min-w-0 items-center gap-2">
                        <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <Link href={`/tarefas/${t.id}`} className="min-w-0 truncate py-1 hover:underline">{t.title}</Link>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular">{formatDate(t.due_at!)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>
        )}

        <ServicesCard
          clientId={id}
          status={status}
          canManage={canManage}
          current={currentServices(client).map((s) => ({ serviceId: s.service_id, qty: s.monthly_qty, priceCents: s.price_cents, startsOn: s.starts_on }))}
          upcoming={upcomingServices(client).map((s) => ({ serviceId: s.service_id, qty: s.monthly_qty, startsOn: s.starts_on }))}
          catalog={catalog.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, unit: s.unit }))}
          showPrices={Boolean(user.permissions["clients.onboarding.read"])}
        />

        <TeamCard
          clientId={id}
          canManage={canManage}
          sectors={sectors.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          team={team}
          members={(client.client_members ?? []).map((m) => ({
            sectorId: m.sector_id,
            profileId: m.profile_id,
            name: (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)?.full_name ?? "",
          }))}
        />

        <AccountsCard clientId={id} canManage={canManage} accounts={client.client_accounts ?? []} contacts={client.client_contacts ?? []} />
      </div>

      <div className="grid min-w-0 content-start gap-6">
        <ClientRuns runs={runs} today={todayKey(now)} canApply={Boolean(user.permissions["playbooks.apply"])} />
        <PromisesCard clientId={id} canManage={canManage} promises={client.handoff_promises ?? []} />
        <DataCard
          canManage={canManage}
          client={{
            id: client.id,
            code: client.code,
            name: client.name,
            owner_id: client.owner_id,
            owner_name: team.find((t) => t.id === client.owner_id)?.name ?? null,
            scope_text: client.scope_text ?? "",
            legal_name: client.legal_name ?? "",
            document: client.document ?? "",
            segment: client.segment ?? "",
            contract_start: client.contract_start ?? "",
            contract_end: client.contract_end ?? "",
            renewal_date: client.renewal_date ?? "",
            media_budget_cents: client.media_budget_cents,
            monthly_fee_cents: client.monthly_fee_cents,
            payment_method: client.payment_method ?? "",
            communication_channel: client.communication_channel ?? "",
            notes: client.notes ?? "",
          }}
          showValues={Boolean(user.permissions["clients.onboarding.read"])}
          team={team.map((t) => ({ id: t.id, name: t.name }))}
        />
        {handoff && (
          <Section title="Fechamento comercial">
            <dl className="grid gap-1.5 rounded-xl border bg-card p-4 text-sm">
              <Row label="Fechado em" value={formatDate(handoff.closed_on)} />
              <Row label="Vendido por" value={(Array.isArray(handoff.profiles) ? handoff.profiles[0] : handoff.profiles)?.full_name ?? "—"} />
              <Row label="Mensalidade" value={formatBRL(handoff.monthly_fee_cents)} />
              <Row label="Implantação" value={formatBRL(handoff.setup_fee_cents)} />
              <Row label="Duração" value={handoff.contract_months ? `${handoff.contract_months} meses` : "—"} />
              {handoff.notes && <p className="mt-2 border-t pt-2 whitespace-pre-line text-muted-foreground">{handoff.notes}</p>}
            </dl>
          </Section>
        )}
        <Section title="Últimas atividades" action={<Link href={`/clientes/${id}/historico`} className="text-sm font-medium text-primary hover:underline">Ver histórico</Link>}>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
          ) : (
            <ol className="grid gap-2 text-sm">
              {timeline.slice(0, 6).map((t) => (
                <li key={t.id} className="grid gap-0.5 border-l-2 border-border pl-3">
                  <span>{t.title}</span>
                  <span className="text-xs text-muted-foreground" title={formatDateTime(t.created_at)}>
                    {[t.actor, formatRelative(t.created_at)].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular">{value}</dd>
    </div>
  );
}
