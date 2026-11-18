import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, ExternalLink, ImageOff } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { MEDIA_TYPE_LABEL } from "@/domain/social";
import { formatDate, formatDateTime } from "@/domain/shared/dates";
import { getClientSocial } from "@/features/social/queries";
import { RefreshSocialButton } from "@/features/social/components/refresh-social-button";
import { PLATFORM_LABEL } from "@/features/social/components/social-profiles-table";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFromContent } from "@/domain/posts";
import { getClientPosts, getContentForPost, getPublishTargets } from "@/features/posts/queries";
import { PostList } from "@/features/posts/components/post-list";
import { ScheduleDialog, type Prefill } from "@/features/posts/components/schedule-dialog";

export const metadata: Metadata = { title: "Redes sociais do cliente" };
export const maxDuration = 60;

const int = new Intl.NumberFormat("pt-BR");
const plural = (n: number, one: string, many: string) => `${int.format(n)} ${n === 1 ? one : many}`;

/** RF-CON-02: páginas do Facebook e Instagram do cliente, com os números do perfil e as últimas publicações. */
export default async function RedesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ programar?: string }> }) {
  const user = await requirePermission(["clients.read"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const canPublish = Boolean(user.permissions["content.publish"]);
  const seesPosts = canPublish || Boolean(user.permissions["content.read"]);
  const [items, posts, targets, content] = await Promise.all([
    getClientSocial(id),
    seesPosts ? getClientPosts(id) : Promise.resolve([]),
    canPublish ? getPublishTargets(id) : Promise.resolve([]),
    canPublish && sp.programar ? getContentForPost(sp.programar, id) : Promise.resolve(null),
  ]);
  // RF-CON-04: conteúdo do cronograma chega pronto para programar.
  const prefill: Prefill | null = content
    ? { taskId: content.taskId, title: content.title, format: formatFromContent(content.format), caption: content.caption, date: content.postOn }
    : null;
  const upcoming = posts.filter((p) => p.status === "agendado" || p.status === "publicando");
  const done = posts.filter((p) => !(p.status === "agendado" || p.status === "publicando")).reverse();

  const programacao = seesPosts && (
    <section id="programacao" aria-labelledby="programacao-h" className="grid scroll-mt-20 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="programacao-h" className="text-base font-semibold">Programação</h2>
        {canPublish && targets.length > 0 && (
          <ScheduleDialog clientId={id} targets={targets} prefill={prefill} defaultOpen={Boolean(prefill)}
            trigger={<Button size="sm"><CalendarPlus aria-hidden="true" /> Programar publicação</Button>} />
        )}
      </div>
      {canPublish && targets.length === 0 && (
        <p className="text-sm text-muted-foreground">Para programar, a página ou o Instagram do cliente precisa estar ligado a ele em Configurações › Integrações › Páginas e Instagram.</p>
      )}
      {upcoming.length > 0 ? <PostList rows={upcoming} canManage={canPublish} /> : <p className="text-sm text-muted-foreground">Nada programado para sair.</p>}
      {done.length > 0 && (
        <details className="grid gap-2">
          <summary className="cursor-pointer text-sm font-medium text-primary">Publicadas, com erro e canceladas nos últimos 30 dias ({done.length})</summary>
          <div className="pt-2"><PostList rows={done} canManage={canPublish} /></div>
        </details>
      )}
    </section>
  );

  if (!items.length)
    return (
      <div className="grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8">
      {programacao}
      <EmptyState
        icon={AtSign}
        title="Nenhuma página ou Instagram ligado a este cliente"
        description={
          user.permissions["ads.connect"]
            ? "Ligue a página e o Instagram do cliente em Configurações › Integrações › Páginas e Instagram. Se não estiverem na lista, inclua-os ao autorizar a Meta ou conecte o Facebook do cliente na aba Tráfego."
            : "Peça ao admin ou à gerência de tráfego para ligar a página e o Instagram do cliente em Configurações › Integrações."
        }
        action={user.permissions["ads.connect"] ? <Link href="/configuracoes/integracoes#paginas" className={buttonVariants({ variant: "outline" })}>Abrir Integrações</Link> : undefined}
      />
      </div>
    );

  return (
    <div className="grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8">
      {programacao}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">As publicações são atualizadas às 8h e às 16h.</p>
        <RefreshSocialButton clientId={id} label="Atualizar agora" />
      </div>
      {items.map(({ profile: p, posts }) => {
        const handle = p.username ? `@${p.username}` : p.name;
        const profileUrl = p.platform === "instagram" && p.username ? `https://www.instagram.com/${p.username}` : p.platform === "facebook" ? `https://www.facebook.com/${p.externalId}` : null;
        return (
          <section key={p.id} aria-labelledby={`perfil-${p.id}`} className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {p.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto servida pela Meta (endereço temporário)
                <img src={p.pictureUrl} alt="" width={44} height={44} className="size-11 rounded-full border object-cover" />
              ) : (
                <span className="grid size-11 place-items-center rounded-full border bg-muted text-muted-foreground"><AtSign className="size-5" aria-hidden="true" /></span>
              )}
              <div className="grid min-w-0 flex-1 gap-0.5">
                <h2 id={`perfil-${p.id}`} className="truncate text-base font-semibold">{handle}</h2>
                <p className="text-xs text-muted-foreground tabular">
                  {PLATFORM_LABEL[p.platform]}
                  {p.followers !== null ? ` · ${plural(p.followers, "seguidor", "seguidores")}` : ""}
                  {p.mediaCount !== null ? ` · ${plural(p.mediaCount, "publicação", "publicações")}` : ""}
                  {p.postsSyncedAt ? ` · atualizado em ${formatDateTime(p.postsSyncedAt)}` : ""}
                </p>
              </div>
              {profileUrl && (
                <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  Abrir <ExternalLink className="size-3.5" aria-hidden="true" /><span className="sr-only"> {handle} (abre em nova aba)</span>
                </a>
              )}
            </div>
            {p.syncError && <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft/40 px-3 py-2 text-sm break-words text-danger">{p.syncError}</p>}
            {posts.length === 0 ? (
              !p.syncError && <p className="text-sm text-muted-foreground">{p.postsSyncedAt ? "Nenhuma publicação encontrada." : "As publicações chegam na próxima atualização (ou clique em \"Atualizar agora\")."}</p>
            ) : (
              <ul aria-label={`Últimas publicações de ${handle}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {posts.map((post) => (
                  <li key={post.externalId} className="grid content-start overflow-hidden rounded-xl border bg-card">
                    <div className="grid aspect-square place-items-center overflow-hidden bg-muted">
                      {post.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- imagem servida pela Meta (endereço temporário)
                        <img src={post.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                    <div className="grid gap-1 p-2.5">
                      <p className="text-xs text-muted-foreground tabular">
                        {formatDate(post.publishedAt)}{post.mediaType && MEDIA_TYPE_LABEL[post.mediaType] ? ` · ${MEDIA_TYPE_LABEL[post.mediaType]}` : ""}
                      </p>
                      {post.caption && <p className="line-clamp-3 text-sm break-words">{post.caption}</p>}
                      <p className="text-xs text-muted-foreground tabular">
                        {[
                          post.likes !== null ? plural(post.likes, "curtida", "curtidas") : null,
                          post.comments !== null ? plural(post.comments, "comentário", "comentários") : null,
                          post.shares !== null ? plural(post.shares, "compartilhamento", "compartilhamentos") : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                      {post.permalink && (
                        <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          Ver publicação<span className="sr-only"> de {formatDate(post.publishedAt)} (abre em nova aba)</span>
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
