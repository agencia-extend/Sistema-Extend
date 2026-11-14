import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { clientContext, listRequestableClients } from "@/features/creatives/queries";
import { RequestForm } from "@/features/creatives/components/request-form";
import { CREATIVE_FORMAT_LABEL, LIBRARY_STATUS_LABEL, LIBRARY_STATUS_TONE, type CreativeFormat, type LibraryStatus } from "@/domain/creatives";
import { cn } from "@/lib/utils";
import { ClientPicker } from "./client-picker";

export const metadata: Metadata = { title: "Pedir criativo" };

/** Pedido de criativo: escolhe o cliente, vê o resumo do onboarding e o histórico, preenche o pedido. */
export default async function NovoCriativoPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  await requirePermission("creatives.request.create");
  const sp = await searchParams;
  const clients = await listRequestableClients();
  const client = clients.find((c) => c.id === sp.cliente);
  const ctx = client ? await clientContext(client.id) : null;
  const sections = ctx ? [...new Set(ctx.summary.map((s) => s.section))] : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid content-start gap-5">
        <h2 className="text-base font-semibold">Pedir criativo</h2>
        <ClientPicker clients={clients} value={client?.id ?? ""} />
        {client ? <RequestForm key={client.id} clientId={client.id} /> : <p className="text-sm text-muted-foreground">Escolha o cliente para preencher o pedido. O resumo do onboarding dele aparece ao lado.</p>}
      </div>
      {ctx && (
        <aside aria-label="Sobre o cliente" className="grid content-start gap-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Sobre {client!.name}</h2>
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">A ficha de onboarding ainda não foi preenchida.</p>
          ) : (
            sections.map((s) => (
              <div key={s} className="grid gap-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">{s}</h3>
                <dl className="grid gap-1.5">
                  {ctx.summary.filter((x) => x.section === s).map((x) => (
                    <div key={x.label}><dt className="text-xs text-muted-foreground">{x.label}</dt><dd className="text-sm break-words whitespace-pre-line">{x.answer}</dd></div>
                  ))}
                </dl>
              </div>
            ))
          )}
          <div className="grid gap-1.5 border-t pt-3">
            <h3 className="text-xs font-semibold text-muted-foreground">Últimos criativos com resultado</h3>
            {ctx.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum criativo marcado como vencedor ou reprovado ainda.</p>
            ) : (
              <ul className="grid gap-1.5">
                {ctx.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{h.angle} <span className="text-xs text-muted-foreground">· {CREATIVE_FORMAT_LABEL[h.format as CreativeFormat]}</span></span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", LIBRARY_STATUS_TONE[h.status as LibraryStatus])}>{LIBRARY_STATUS_LABEL[h.status as LibraryStatus]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
