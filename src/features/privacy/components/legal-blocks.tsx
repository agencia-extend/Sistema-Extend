import type { ReactNode } from "react";

/** Peças de texto das páginas legais (política e termos): seção numerada, tabela e lista. */

export function Section({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="grid scroll-mt-20 gap-3">
      <h2 id={`${id}-t`} className="font-heading text-lg font-semibold text-balance sm:text-xl">
        <span className="tabular text-muted-foreground">{n}.</span> {title}
      </h2>
      <div className="grid gap-3 text-[0.9375rem] leading-7 text-foreground/85">{children}</div>
    </section>
  );
}

export function Table({ head, rows, caption }: { head: [string, string]; rows: [ReactNode, ReactNode][]; caption: string }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground max-sm:sr-only">
          <tr>
            <th scope="col" className="w-2/5 px-4 py-2.5 font-medium">{head[0]}</th>
            <th scope="col" className="px-4 py-2.5 font-medium">{head[1]}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(([a, b], i) => (
            <tr key={i} className="align-top max-sm:grid max-sm:gap-1 max-sm:px-4 max-sm:py-3">
              <th scope="row" className="px-4 py-3 text-left font-medium max-sm:p-0">{a}</th>
              <td className="px-4 py-3 leading-6 text-foreground/80 max-sm:p-0">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="grid list-disc gap-1.5 pl-5 marker:text-muted-foreground">{children}</ul>;
}
