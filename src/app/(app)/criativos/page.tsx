import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { listCreatives, type CreativeCard } from "@/features/creatives/queries";
import { EmptyState } from "@/components/app/states";
import { CREATIVE_FORMAT_LABEL, CREATIVE_STEPS } from "@/domain/creatives";
import { PRIORITY_LABEL } from "@/domain/tasks";
import { formatDate } from "@/domain/shared/dates";
import { cn } from "@/lib/utils";
import { CreativeFilters } from "./creative-filters";

export const metadata: Metadata = { title: "Criativos" };

type Search = { visao?: string; cliente?: string; formato?: string; pessoa?: string; prioridade?: string };

/** Quadro (por etapa), lista com filtros e "meus pedidos" do gestor. */
export default async function CriativosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  const all = await listCreatives();
  const view = sp.visao === "lista" || sp.visao === "meus" ? sp.visao : "quadro";
  const items = all.filter(
    (c) =>
      (view !== "meus" || c.requestedBy === user!.id) &&
      (!sp.cliente || c.clientId === sp.cliente) &&
      (!sp.formato || c.format === sp.formato) &&
      (!sp.pessoa || c.assigneeId === sp.pessoa || c.requestedBy === sp.pessoa) &&
      (!sp.prioridade || c.priority === sp.prioridade),
  );
  const clients = [...new Map(all.map((c) => [c.clientId, c.clientName])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const people = [
    ...new Map(all.flatMap((c) => [[c.assigneeId, c.assigneeName], [c.requestedBy, c.requesterName]]).filter(([id, n]) => id && n) as [string, string][]).entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (all.length === 0) {
    return <EmptyState icon={Megaphone} title="Nenhum criativo pedido ainda" description="O gestor de tráfego pede pelo botão “Pedir criativo”. O pedido vai para a mídia do cliente e aparece aqui." />;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <CreativeFilters clients={clients} people={people} />
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhum criativo com estes filtros.</p>
      ) : view === "quadro" ? (
        <Board items={items} />
      ) : (
        <List items={items} />
      )}
    </div>
  );
}

function Board({ items }: { items: CreativeCard[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {CREATIVE_STEPS.map((step) => {
        const cards = items.filter((c) => c.step === step);
        return (
          <section key={step} aria-label={step} className="grid w-72 shrink-0 content-start gap-2 rounded-xl bg-muted/50 p-2">
            <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
              {step} <span className="tabular text-muted-foreground">{cards.length}</span>
            </h2>
            {cards.map((c) => <Card key={c.id} c={c} />)}
          </section>
        );
      })}
    </div>
  );
}

function Card({ c }: { c: CreativeCard }) {
  const late = c.dueAt && c.dueAt < new Date().toISOString() && c.step !== "No ar" && c.step !== "Entregue" && c.step !== "Aprovado";
  return (
    <Link href={`/criativos/${c.id}`} className="grid gap-1 rounded-lg border bg-card p-3 hover:border-brand/50" style={{ borderLeftWidth: 3, borderLeftColor: c.stepColor }}>
      <span className="text-sm font-medium break-words">{c.angle}</span>
      <span className="text-xs text-muted-foreground">{c.clientName} · {CREATIVE_FORMAT_LABEL[c.format]}</span>
      <span className="flex flex-wrap justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{c.assigneeName ?? "Sem responsável"}</span>
        {c.dueAt && <span className={cn("tabular", late ? "font-medium text-danger" : "text-muted-foreground")}>{formatDate(c.dueAt)}</span>}
      </span>
    </Link>
  );
}

function List({ items }: { items: CreativeCard[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[760px] text-sm">
        <caption className="sr-only">Criativos</caption>
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            {["Criativo", "Cliente", "Formato", "Etapa", "Quem produz", "Quem pediu", "Prazo", "Prioridade"].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40">
              <td className="px-3 py-2.5"><Link href={`/criativos/${c.id}`} className="font-medium hover:underline">{c.angle}</Link><span className="block text-xs text-muted-foreground">{c.campaign}</span></td>
              <td className="px-3 py-2.5">{c.clientName}</td>
              <td className="px-3 py-2.5">{CREATIVE_FORMAT_LABEL[c.format]}</td>
              <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: c.stepColor }} aria-hidden="true" />{c.step}</span></td>
              <td className="px-3 py-2.5 text-muted-foreground">{c.assigneeName ?? "—"}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{c.requesterName ?? "—"}</td>
              <td className="px-3 py-2.5 tabular text-muted-foreground">{c.dueAt ? formatDate(c.dueAt) : "—"}</td>
              <td className="px-3 py-2.5">{PRIORITY_LABEL[c.priority] ?? c.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
