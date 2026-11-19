import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { LEVEL_LABEL, type NamingLevel } from "@/domain/ads/naming";
import { parseAdsFilters } from "@/domain/ads/filters";
import { todayKey } from "@/domain/media";
import { getModuleAccounts } from "@/features/ads/module-queries";
import { getNamingReport } from "@/features/ads/naming-queries";
import { NameGenerator } from "@/features/ads/components/name-generator";
import { StatusDot } from "@/features/ads/components/panel-table";
import { FiltersRow, NoAccounts } from "../filters-row";

export const metadata: Metadata = { title: "Nomenclatura" };

const LEVELS: NamingLevel[] = ["campaign", "adset", "ad"];
const PLURAL: Record<NamingLevel, string> = { campaign: "campanhas", adset: "conjuntos", ad: "anúncios" };

/** Verificador da nomenclatura (RF-PLA-03): o que está fora do padrão nas contas, com o motivo, e o gerador de nome. */
export default async function AnunciosNomenclaturaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(["ads.read"]);
  const today = todayKey(new Date());
  const sp = await searchParams;
  // Por padrão, só o que está no ar (o que importa corrigir agora).
  const filters = parseAdsFilters({ status: "ativas", ...sp }, today);
  const all = await getModuleAccounts(today);
  if (!all.length) return <NoAccounts canConnect={Boolean(user.permissions["ads.connect"])} />;
  const { templates, issues, totals } = await getNamingReport(filters, today);

  return (
    <>
      <FiltersRow filters={filters} accounts={all} />
      <section aria-label="Padrão" className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-surface p-4">
        <dl className="grid gap-1 text-sm">
          {LEVELS.map((l) => (
            <div key={l} className="flex flex-wrap gap-x-2"><dt className="w-20 text-muted-foreground">{LEVEL_LABEL[l]}</dt><dd className="font-mono text-xs leading-5">{templates[l]}</dd></div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          <NameGenerator templates={templates} month={today.slice(0, 7)} />
          {user.permissions["ads.connect"] && <Link href="/configuracoes/nomenclatura" className="inline-flex h-9 items-center rounded-md px-3 text-sm text-primary hover:underline">Mudar o padrão</Link>}
        </div>
      </section>
      <ul aria-label="Resumo da nomenclatura" className="grid grid-cols-3 gap-3">
        {LEVELS.map((l) => {
          const bad = issues.filter((i) => i.level === l).length;
          return (
            <li key={l} className="grid gap-0.5 rounded-xl border bg-surface p-3">
              <span className="text-xs text-muted-foreground first-letter:uppercase">{PLURAL[l]}</span>
              <span className="text-lg font-semibold tabular-nums">{totals[l] - bad} de {totals[l]}</span>
              <span className="text-xs text-muted-foreground">no padrão</span>
            </li>
          );
        })}
      </ul>
      {issues.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border bg-success-soft px-4 py-4 text-sm text-success"><CheckCircle2 className="size-4" aria-hidden="true" /> Tudo no padrão nestes filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-surface">
          <table className="w-full text-sm" aria-label="Fora do padrão">
            <thead className="border-b bg-muted/40 text-left text-xs whitespace-nowrap text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Nome</th>
                <th scope="col" className="px-2.5 py-2.5 font-medium">Nível</th>
                <th scope="col" className="px-4 py-2.5 font-medium">O que está fora</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {issues.map((i) => (
                <tr key={`${i.level}-${i.id}`} className="align-top">
                  <th scope="row" className="max-w-md min-w-60 px-4 py-2.5 text-left font-normal">
                    <span className="block font-mono text-xs break-all">{i.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <StatusDot status={i.status} />
                      {i.clientId ? <Link href={`/clientes/${i.clientId}/anuncios`} className="hover:underline">{i.clientName}</Link> : null}
                      <span>{i.accountName}</span>
                      {i.parent && <span className="truncate">em {i.parent}</span>}
                    </span>
                  </th>
                  <td className="px-2.5 py-2.5 whitespace-nowrap">{LEVEL_LABEL[i.level]}</td>
                  <td className="min-w-56 px-4 py-2.5 text-danger first-letter:uppercase">{i.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
