import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { deliveredPercent, journeyStage, contractWindow, clientCode } from "@/domain/clients";
import { dayLabel } from "@/domain/trainings";
import type { ClientCard } from "@/features/clients/queries";
import { ClientStatusBadge, ProgressBar } from "@/features/clients/components/bits";
import { cn } from "@/lib/utils";

const WINDOW_TONE = { vencido: "font-medium text-danger", termina_logo: "font-medium text-danger", termina: "font-medium text-warning", ok: "text-muted-foreground", sem: "text-muted-foreground" } as const;
const WINDOW_NOTE = { vencido: "Vencido", termina_logo: "Termina em até 7 dias", termina: "Termina em até 30 dias", ok: "", sem: "" } as const;

/** Tabela de clientes: no celular, cada linha vira um cartão. */
export function ClientTable({ clients, today }: { clients: ClientCard[]; today: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Clientes</caption>
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground max-md:sr-only">
          <tr>
            <th scope="col" className="w-16 px-4 py-2.5 font-medium">Nº</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Cliente</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Serviços</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Responsável</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Fim do contrato</th>
            <th scope="col" className="w-44 px-4 py-2.5 font-medium">Andamento</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clients.map((c) => {
            const onboarding = c.status === "onboarding";
            const pct = onboarding ? deliveredPercent(c.onboardingDone, c.onboardingTotal) : deliveredPercent(c.monthDone, c.monthTotal);
            const w = contractWindow(c.contract_end, today);
            return (
              <tr key={c.id} className="relative align-top hover:bg-muted/40 max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1.5 max-md:px-4 max-md:py-3">
                <td className="px-4 py-3 tabular text-muted-foreground max-md:hidden">{clientCode(c.code)}</td>
                <td className="px-4 py-3 max-md:col-start-1 max-md:p-0">
                  <Link href={`/clientes/${c.id}`} className="font-medium after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none">
                    <span className="tabular text-muted-foreground md:hidden">{clientCode(c.code)} · </span>
                    {c.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{[c.segment, journeyStage(c.status, c.onboardingDone, c.onboardingTotal)].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="px-4 py-3 max-md:col-span-2 max-md:p-0">
                  {c.services.length ? (
                    <ul className="flex flex-wrap gap-1" aria-label="Serviços">
                      {c.services.map((s) => (
                        <li key={s.id} className="rounded-md bg-muted px-1.5 py-0.5 text-xs whitespace-nowrap">{s.qty ? `${s.name} · ${s.qty}` : s.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem serviços vigentes</span>
                  )}
                </td>
                <td className="px-4 py-3 max-md:col-start-1 max-md:p-0 max-md:text-xs">
                  <span className="md:hidden text-muted-foreground">Responsável: </span>
                  {c.ownerName ?? <span className="text-muted-foreground">Sem responsável</span>}
                </td>
                <td className="px-4 py-3 tabular max-md:col-start-1 max-md:p-0 max-md:text-xs">
                  <span className="md:hidden text-muted-foreground">Fim do contrato: </span>
                  {c.contract_end ? dayLabel(c.contract_end) : "—"}
                  {WINDOW_NOTE[w] && <span className={cn("block text-xs", WINDOW_TONE[w])}>{WINDOW_NOTE[w]}</span>}
                </td>
                <td className="px-4 py-3 max-md:col-span-2 max-md:p-0">
                  <ProgressBar value={pct} label={onboarding ? `Onboarding ${c.onboardingDone}/${c.onboardingTotal}` : c.monthTotal ? `Mês ${c.monthDone}/${c.monthTotal}` : "Mês"} tone={onboarding ? "warning" : "info"} />
                  {c.overdue > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-danger">
                      <AlertTriangle className="size-3.5" aria-hidden="true" /> {c.overdue} atrasada{c.overdue > 1 ? "s" : ""}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 max-md:col-start-2 max-md:row-start-1 max-md:p-0">
                  <ClientStatusBadge status={c.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
