import { Skeleton } from "@/components/ui/skeleton";

/** Aparece na hora ao trocar de tela, enquanto os dados chegam. */
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando…" className="grid gap-6 px-4 py-6 sm:px-6">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
