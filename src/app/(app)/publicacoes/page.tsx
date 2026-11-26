import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, Share2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { todayKey } from "@/domain/media";
import { getPublishTargets, listPosts, listReadyToSchedule } from "@/features/posts/queries";
import { ReadyList } from "@/features/posts/components/ready-list";
import { listClientProfiles } from "@/features/social/queries";
import { PostList } from "@/features/posts/components/post-list";
import { CreateButtons } from "@/features/posts/components/create-buttons";
import { Planner, ProfileAvatar, ProfileRail, monthTitle, spDay } from "@/features/posts/components/studio";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Publicações" };

const UUID = /^[0-9a-f-]{36}$/i;
const shiftIso = (date: string, days: number) => new Date(Date.parse(`${date}T03:00:00Z`) + days * 86_400_000).toISOString();

/**
 * Estúdio de publicações (RF-CON-03), como no HubSystem: perfis dos clientes à esquerda; no perfil, os números e os
 * botões Post, Vídeo, Reels e Stories; o planejador do mês; o que não publicou e o que saiu por último.
 */
export default async function PublicacoesPage({ searchParams }: { searchParams: Promise<{ perfil?: string; mes?: string; dia?: string }> }) {
  const user = await requirePermission(["content.publish", "content.read"]);
  const sp = await searchParams;
  const today = todayKey(new Date());
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes ?? "") ? sp.mes! : today.slice(0, 7);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? "") && sp.dia!.startsWith(month) ? sp.dia! : null;
  const profiles = await listClientProfiles();
  const current = sp.perfil && UUID.test(sp.perfil) ? (profiles.find((p) => p.id === sp.perfil) ?? null) : null;
  const canPublish = Boolean(user.permissions["content.publish"]);

  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const [monthPosts, recent, targets, ready] = await Promise.all([
    listPosts({ from: shiftIso(monthStart, 0), to: shiftIso(monthEnd, 1) }),
    listPosts({ from: shiftIso(today, -30), to: shiftIso(today, 1) }),
    current?.clientId && canPublish ? getPublishTargets(current.clientId) : Promise.resolve([]),
    current && !current.clientId ? Promise.resolve([]) : listReadyToSchedule(current?.clientId ?? null),
  ]);
  const mine = <T extends { profileId: string }>(rows: T[]) => (current ? rows.filter((r) => r.profileId === current.id) : rows);
  const posts = mine(monthPosts);
  const lastMonth = mine(recent);
  const scheduled = posts.filter((p) => p.status === "agendado" || p.status === "publicando").length;
  const published = posts.filter((p) => p.status === "publicado").length;
  const errors = lastMonth.filter((p) => p.status === "erro");
  const latest = lastMonth.filter((p) => p.status === "publicado").reverse().slice(0, 6);
  const dayPosts = day ? posts.filter((p) => spDay(p.scheduledAt) === day) : [];

  const href = (patch: { perfil?: string | null; mes?: string; dia?: string | null }) => {
    const q = new URLSearchParams();
    const perfil = patch.perfil === undefined ? current?.id : patch.perfil;
    const mes = patch.mes ?? month;
    const dia = patch.dia === undefined ? day : patch.dia;
    if (perfil) q.set("perfil", perfil);
    if (mes !== today.slice(0, 7)) q.set("mes", mes);
    if (dia) q.set("dia", dia);
    return `/publicacoes${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Estúdio de publicações" description="Programe posts, vídeos, reels e stories no Facebook e no Instagram dos clientes, e acompanhe o que saiu e o que não publicou." />
      <PageBody className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {profiles.length === 0 ? (
          <EmptyState icon={Share2} title="Nenhum perfil ligado a cliente"
            description="Ligue as páginas do Facebook e os Instagram aos clientes em Configurações › Integrações › Páginas e Instagram. Depois, eles aparecem aqui para programar."
            action={user.permissions["ads.connect"] ? <Link href="/configuracoes/integracoes" className={buttonVariants({ variant: "outline" })}>Abrir Integrações</Link> : undefined} />
        ) : null}
        {profiles.length === 0 && ready.length > 0 && (
          <section aria-labelledby="prontos-sem-perfil" className="grid gap-2">
            <h2 id="prontos-sem-perfil" className="text-sm font-semibold">Prontos para programar <span className="font-normal text-muted-foreground tabular-nums">({ready.length})</span></h2>
            <p className="-mt-1 text-xs text-muted-foreground">Aprovados pelo cliente. Para programar pelo sistema, ligue antes a página ou o Instagram do cliente.</p>
            <ReadyList rows={ready} showClient canPublish={canPublish} />
          </section>
        )}
        {profiles.length === 0 ? null : (
          <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <ProfileRail profiles={profiles} current={current?.id ?? null} href={(perfil) => href({ perfil, dia: null })} />
            <div className="grid min-w-0 content-start gap-4">
              <section aria-label="Resumo" className="grid gap-3 rounded-xl border bg-surface p-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {current ? <ProfileAvatar profile={current} size="lg" /> : null}
                  <div className="grid min-w-0">
                    <h2 className="truncate text-lg font-semibold">{current ? (current.username ? `@${current.username}` : current.name) : "Todos os perfis"}</h2>
                    <p className="text-sm text-muted-foreground">{current ? (current.clientName ?? "Sem cliente") : `${profiles.length} ${profiles.length === 1 ? "perfil" : "perfis"} dos clientes`}</p>
                  </div>
                </div>
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Agendadas em {monthTitle(month).split(" ")[0]}</dt><dd className="text-lg font-semibold tabular-nums">{scheduled}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Publicadas</dt><dd className="text-lg font-semibold tabular-nums">{published}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Não publicaram (30 dias)</dt><dd className={cn("text-lg font-semibold tabular-nums", errors.length && "text-danger")}>{errors.length}</dd></div>
                </dl>
                {current && current.clientId && canPublish && (
                  targets.some((t) => t.profileId === current.id && t.missing.length === 0)
                    ? <div className="sm:basis-full"><CreateButtons clientId={current.clientId} targets={targets} profileId={current.id} /></div>
                    : <p className="text-sm text-warning sm:basis-full">Este perfil ainda não pode publicar pelo sistema: {targets.find((t) => t.profileId === current.id)?.missing.join(", ") || "falta a permissão de publicação na Meta"}.</p>
                )}
                {!current && canPublish && <p className="text-sm text-muted-foreground sm:basis-full">Escolha um perfil à esquerda para programar um post, vídeo, reels ou stories.</p>}
              </section>

              {ready.length > 0 && (
                <section aria-labelledby="prontos" className="grid gap-2">
                  <h2 id="prontos" className="text-sm font-semibold">Prontos para programar <span className="font-normal text-muted-foreground tabular-nums">({ready.length})</span></h2>
                  <p className="-mt-1 text-xs text-muted-foreground">Aprovados pelo cliente e ainda sem programação. Programar abre o perfil do cliente com a legenda e a data do conteúdo.</p>
                  <ReadyList rows={ready} showClient={!current} canPublish={canPublish} />
                </section>
              )}

              {errors.length > 0 && (
                <section aria-labelledby="erros" className="grid gap-2">
                  <h2 id="erros" className="flex items-center gap-1.5 text-sm font-semibold text-danger"><CircleAlert className="size-4" aria-hidden="true" /> Não publicaram</h2>
                  <PostList rows={errors} showClient={!current} canManage={canPublish} />
                </section>
              )}

              <Planner month={month} posts={posts} today={today} selectedDay={day} dayHref={(d) => href({ dia: d === day ? null : d })} monthHref={(mes) => href({ mes, dia: null })} />

              {day && (
                <section aria-labelledby="do-dia" className="grid gap-2">
                  <h2 id="do-dia" className="text-sm font-semibold first-letter:uppercase">
                    {new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                  </h2>
                  {dayPosts.length ? <PostList rows={dayPosts} showClient={!current} canManage={canPublish} /> : <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">Nada programado neste dia.</p>}
                </section>
              )}

              <section aria-labelledby="recentes" className="grid gap-2">
                <h2 id="recentes" className="text-sm font-semibold">Publicadas recentemente</h2>
                {latest.length ? <PostList rows={latest} showClient={!current} canManage={false} /> : <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">Nenhuma publicação nos últimos 30 dias{current ? " neste perfil" : ""}.</p>}
              </section>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
