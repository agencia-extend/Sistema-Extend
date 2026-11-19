"use client";

import { LoaderCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { PlanOptions } from "@/features/ads/plan-queries";

/** Criativos do plano: da biblioteca (aprovados) ou pedidos em produção, do cliente escolhido. */
export function CreativePicker({ loading, hasClient, options, libraryIds, requestIds, onChange }: {
  loading: boolean; hasClient: boolean; options: PlanOptions | null; libraryIds: string[]; requestIds: string[];
  onChange: (libraryIds: string[], requestIds: string[]) => void;
}) {
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));
  const empty = options && !options.library.length && !options.requests.length;
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Criativos <span className="font-normal text-muted-foreground">(opcional)</span></legend>
      {!hasClient ? (
        <p className="text-sm text-muted-foreground">Escolha o cliente para ver os criativos dele.</p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Carregando os criativos…</p>
      ) : empty ? (
        <p className="text-sm text-muted-foreground">Nenhum criativo na biblioteca nem pedido em produção para este cliente. Peça em Criativos › Novo pedido.</p>
      ) : (
        <div className="grid max-h-56 gap-3 overflow-y-auto rounded-md border p-3">
          {[
            { title: "Biblioteca", items: options!.library, ids: libraryIds, set: (ids: string[]) => onChange(ids, requestIds) },
            { title: "Pedidos em produção", items: options!.requests, ids: requestIds, set: (ids: string[]) => onChange(libraryIds, ids) },
          ]
            .filter((g) => g.items.length)
            .map((g) => (
              <div key={g.title} className="grid gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">{g.title}</p>
                <ul className="grid gap-1" aria-label={g.title}>
                  {g.items.map((c) => (
                    <li key={c.id}>
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={g.ids.includes(c.id)} onCheckedChange={(on) => g.set(toggle(g.ids, c.id, on === true))} />
                        <span className="min-w-0 break-words">{c.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </fieldset>
  );
}
