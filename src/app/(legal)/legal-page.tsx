import type { ReactNode } from "react";
import { PRIVACY_UPDATED_LABEL } from "@/domain/privacy";

/** Cabeçalho, sumário (lateral no computador) e corpo de um documento legal. */
export function LegalPage({ title, intro, sections, children }: { title: string; intro: string; sections: readonly (readonly [string, string])[]; children: ReactNode }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
      <header className="grid content-start gap-3 lg:col-span-2">
        <h1 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">{title}</h1>
        <p className="max-w-prose text-base leading-7 text-muted-foreground">{intro}</p>
        <p className="text-sm text-muted-foreground">Atualizada em {PRIVACY_UPDATED_LABEL}.</p>
      </header>
      <nav aria-label="Nesta página" className="hidden lg:block">
        <ol className="sticky top-6 grid gap-1 border-l text-sm">
          {sections.map(([id, label], i) => (
            <li key={id}>
              <a href={`#${id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-muted-foreground outline-none hover:border-brand hover:text-foreground focus-visible:border-brand focus-visible:text-foreground focus-visible:underline">
                <span className="tabular">{i + 1}.</span> {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <article className="max-w-prose min-w-0">{children}</article>
    </div>
  );
}
