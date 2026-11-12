import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Clapperboard } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getClient, listTeam } from "@/features/clients/queries";
import { currentMonth, listClientMonths, listContents } from "@/features/media/queries";
import { ContentTable } from "@/features/media/components/content-table";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { periodLabel } from "@/domain/media";
import { cn } from "@/lib/utils";

/**
 * Controle de Mídias do cliente: os conteúdos contratados em cada mês DO CLIENTE
 * (o mês começa no dia de início do contrato), com quem grava, quem edita e o status.
 */
export default async function MidiasPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const user = await requirePermission("tasks.read");
  const { id } = await params;
  const client = (await getClient(id))!;
  if (client.status === "onboarding") redirect(`/clientes/${id}`);
  const sp = await searchParams;
  const months = await listClientMonths(id);
  const month = months.find((m) => String(m.number) === sp.mes) ?? currentMonth(months);

  if (!month) {
    return (
      <EmptyState
        icon={Clapperboard}
        title="Nenhum mês aberto ainda"
        description="O primeiro mês abre no dia de início do contrato, com um conteúdo para cada item contratado (vídeos, artes, posts). Confira a data de início em Visão geral → Dados do cliente e as quantidades em Serviços contratados."
        action={<Link href={`/clientes/${id}`} className={buttonVariants({ variant: "outline" })}>Abrir a visão geral</Link>}
      />
    );
  }

  const [rows, team] = await Promise.all([listContents(id, month.startsOn), listTeam()]);
  const live = rows.filter((r) => r.status !== "cancelado");
  const older = months.find((m) => m.number === month.number - 1);
  const newer = months.find((m) => m.number === month.number + 1);
  const stats: [string, number][] = [
    ["Contratado", live.length],
    ["Em produção", live.filter((r) => ["em_andamento", "aguardando_aprovacao"].includes(r.status)).length],
    ["Aprovado", live.filter((r) => ["aprovado", "concluido"].includes(r.status)).length],
    ["Entregue", live.filter((r) => r.status === "concluido").length],
  ];
  const nav = (m: typeof older, label: string, Icon: typeof ChevronLeft) =>
    m ? (
      <Link href={`?mes=${m.number}`} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={label}><Icon /></Link>
    ) : (
      <span className={cn(buttonVariants({ variant: "outline", size: "icon" }), "pointer-events-none opacity-40")} aria-hidden="true"><Icon /></span>
    );

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          {nav(older, "Mês anterior", ChevronLeft)}
          <h2 className="min-w-44 text-center">
            <span className="block text-base font-semibold">Mês {month.number}</span>
            <span className="block text-xs text-muted-foreground tabular">{periodLabel(month.startsOn, month.endsOn)}</span>
          </h2>
          {nav(newer, "Próximo mês", ChevronRight)}
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm tabular">
          {stats.map(([l, v]) => (
            <div key={l}><dt className="inline text-muted-foreground">{l} </dt><dd className="inline font-semibold">{v}</dd></div>
          ))}
        </dl>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="Sem conteúdos neste mês"
          description="Os conteúdos nascem dos serviços com quantidade mensal (vídeos, artes, posts). Ajuste as quantidades em Visão geral → Serviços contratados; a mudança vale a partir do próximo mês do cliente."
        />
      ) : (
        <ContentTable rows={rows} team={team.map((t) => ({ id: t.id, name: t.name }))} canEdit={Boolean(user.permissions["tasks.manage"])} canAssign={Boolean(user.permissions["tasks.assign"])} nowIso={new Date().toISOString()} />
      )}
    </div>
  );
}
