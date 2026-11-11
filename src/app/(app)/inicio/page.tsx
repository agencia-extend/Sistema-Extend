import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, ClipboardCheck, ShieldCheck, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { FormAlert } from "@/components/app/form-field";
import { EmptyState } from "@/components/app/states";
import { formatDate, formatDateTime, TIMEZONE } from "@/domain/shared/dates";
import { myPending, onboardingsInProgress, promisesDueSoon } from "@/features/home/queries";
import { ProgressBar } from "@/features/clients/components/bits";
import { deliveredPercent } from "@/domain/clients";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: TIMEZONE }).format(new Date()));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

export default async function InicioPage({ searchParams }: { searchParams: Promise<{ senha?: string; "bem-vindo"?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const firstName = user.fullName.split(" ")[0];
  const canUsers = Boolean(user.permissions["users.manage"]);
  const seesOnboarding = Boolean(user.permissions["clients.onboarding.read"]);

  const supabase = await createClient();
  const [pending, onboardings, promises, setup] = await Promise.all([
    myPending(user),
    seesOnboarding ? onboardingsInProgress() : Promise.resolve([]),
    seesOnboarding || user.permissions["commercial.handoff.create"] ? promisesDueSoon() : Promise.resolve([]),
    canUsers
      ? Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("invitations").select("id", { count: "exact", head: true }).eq("status", "pendente"),
          supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
        ]).then(([m, p, d]) => ({ members: m.count ?? 0, pending: p.count ?? 0, devices: d.count ?? 0 }))
      : Promise.resolve(null),
  ]);
  const nowIso = new Date().toISOString();

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}`} description={user.sectors.map((s) => s.name).join(" · ") || undefined} />
      <PageBody className="grid gap-8">
        {params.senha === "ok" && <FormAlert tone="success">Senha atualizada.</FormAlert>}
        {params["bem-vindo"] && <FormAlert tone="success">Acesso ativado. Ative as notificações neste aparelho para receber suas demandas.</FormAlert>}

        <section aria-labelledby="pendencias" className="grid gap-3">
          <h2 id="pendencias" className="text-lg font-semibold">
            Minhas pendências {pending.length > 0 && <span className="font-normal text-muted-foreground tabular">({pending.length})</span>}
          </h2>
          {pending.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Nenhuma pendência por enquanto"
              description="As demandas atribuídas a você (vídeos, artes, criativos, itens de onboarding) aparecem aqui com prazo e cliente. Ative as notificações para ser avisado no celular."
              action={
                <Link href="/configuracoes/notificacoes" className="inline-flex min-h-10 items-center gap-2 rounded-md border bg-surface px-3 text-sm font-medium hover:bg-muted">
                  <BellRing className="size-4" aria-hidden="true" /> Ativar notificações
                </Link>
              }
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {pending.slice(0, 12).map((p) => {
                const late = p.dueAt && p.dueAt < nowIso;
                return (
                  <li key={`${p.kind}-${p.id}`}>
                    <Link href={p.href} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-muted/50">
                      <span className="min-w-0 flex-1 basis-56 truncate text-sm">{p.title}</span>
                      <span className="text-xs text-muted-foreground">{p.client}</span>
                      {p.dueAt && <span className={cn("text-xs tabular", late ? "font-medium text-danger" : "text-muted-foreground")}>{late ? "Atrasada · " : ""}{formatDate(p.dueAt)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {(onboardings.length > 0 || promises.length > 0) && (
          <div className="grid gap-6 lg:grid-cols-2">
            {onboardings.length > 0 && (
              <section aria-labelledby="onb" className="grid content-start gap-3">
                <h2 id="onb" className="text-lg font-semibold">Onboardings em andamento <span className="font-normal text-muted-foreground tabular">({onboardings.length})</span></h2>
                <ul className="divide-y rounded-xl border bg-card">
                  {onboardings.map((o) => (
                    <li key={o.id}>
                      <Link href={`/clientes/${o.id}/ficha`} className="grid gap-2 px-4 py-3 hover:bg-muted/50">
                        <span className="flex justify-between gap-2 text-sm"><span className="font-medium">{o.name}</span><span className="text-xs text-muted-foreground">desde {formatDate(o.createdAt)}</span></span>
                        <ProgressBar value={deliveredPercent(o.done, o.total)} label={`Checklist ${o.done}/${o.total}`} tone="warning" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {promises.length > 0 && (
              <section aria-labelledby="prom" className="grid content-start gap-3">
                <h2 id="prom" className="text-lg font-semibold">Promessas comerciais vencendo</h2>
                <ul className="divide-y rounded-xl border bg-card">
                  {promises.map((p) => (
                    <li key={p.id}>
                      <Link href={`/clientes/${p.clientId}`} className="grid gap-0.5 px-4 py-3 hover:bg-muted/50">
                        <span className="text-sm">{p.description}</span>
                        <span className={cn("text-xs", p.dueAt < nowIso ? "font-medium text-danger" : "text-muted-foreground")}>
                          {p.client} · {p.dueAt < nowIso ? "atrasada desde " : "vence "}{formatDateTime(p.dueAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {setup && (
          <section aria-labelledby="equipe" className="grid gap-3">
            <h2 id="equipe" className="text-lg font-semibold">Equipe no sistema</h2>
            <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
              <Stat label="Pessoas com acesso" value={setup.members} href="/configuracoes/usuarios" action="Convidar" icon={UserPlus} />
              <Stat label="Convites aguardando aceite" value={setup.pending} href="/configuracoes/usuarios#convites" action="Ver convites" icon={ClipboardCheck} />
              <Stat label="Meus aparelhos com notificação" value={setup.devices} href="/configuracoes/notificacoes" action="Gerenciar aparelhos" icon={ShieldCheck} />
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}

function Stat({ label, value, href, action, icon: Icon }: { label: string; value: number; href: string; action: string; icon: typeof UserPlus }) {
  return (
    <div className="grid gap-2 bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-3xl font-semibold tabular">{value}</p>
      <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <Icon className="size-4" aria-hidden="true" /> {action}
      </Link>
    </div>
  );
}
