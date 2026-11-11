import type { ReactNode } from "react";

/** Bloco com título (h2) e ação opcional à direita. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3" aria-label={title}>
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
