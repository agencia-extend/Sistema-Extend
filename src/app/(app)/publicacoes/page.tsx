import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { listPosts } from "@/features/posts/queries";
import { PostList } from "@/features/posts/components/post-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Publicações" };

const VIEWS = { proximas: "Próximas", erros: "Com erro", publicadas: "Publicadas" } as const;
type View = keyof typeof VIEWS;

const dayKey = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
const dayLabel = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });

/** RF-CON-03: agenda das publicações programadas de todos os clientes que a pessoa vê. */
export default async function PublicacoesPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const user = await requirePermission(["content.publish", "content.read"]);
  const ver = ((await searchParams).ver ?? "proximas") as View;
  const view: View = ver in VIEWS ? ver : "proximas";
  const now = Date.now();
  const rows = await listPosts({ from: new Date(now - 30 * 86_400_000).toISOString(), to: new Date(now + 76 * 86_400_000).toISOString() });
  const shown =
    view === "proximas" ? rows.filter((r) => r.status === "agendado" || r.status === "publicando")
    : view === "erros" ? rows.filter((r) => r.status === "erro").reverse()
    : rows.filter((r) => r.status === "publicado").reverse();
  const errors = rows.filter((r) => r.status === "erro").length;
  const days = [...new Set(shown.map((r) => dayKey(r.scheduledAt)))];

  return (
    <>
      <PageHeader title="Publicações" description="O que está programado para sair no Facebook e no Instagram dos clientes, o que já saiu e o que deu erro. Para programar, abra o cliente › Redes sociais." />
      <PageBody className="grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-5">
        <nav aria-label="Situação" className="flex flex-wrap gap-1 text-sm">
          {(Object.keys(VIEWS) as View[]).map((k) => (
            <Link key={k} href={`/publicacoes?ver=${k}`} aria-current={k === view ? "page" : undefined}
              className={cn("rounded-md px-3 py-1.5", k === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {VIEWS[k]}{k === "erros" && errors > 0 && <span className="ml-1.5 tabular">{errors}</span>}
            </Link>
          ))}
        </nav>
        {shown.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={view === "proximas" ? "Nada programado para sair" : view === "erros" ? "Nenhuma publicação com erro" : "Nenhuma publicação nos últimos 30 dias"}
            description="Programe pelo cliente › Redes sociais › Programar publicação, ou pelo cronograma do mês de cada conteúdo."
          />
        ) : (
          days.map((d) => (
            <section key={d} aria-labelledby={`dia-${d}`} className="grid gap-2">
              <h2 id={`dia-${d}`} className="text-sm font-semibold first-letter:uppercase">{dayLabel(d)}</h2>
              <PostList rows={shown.filter((r) => dayKey(r.scheduledAt) === d)} showClient canManage={Boolean(user.permissions["content.publish"])} />
            </section>
          ))
        )}
      </PageBody>
    </>
  );
}
