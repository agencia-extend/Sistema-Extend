"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/app/form-field";
import { UNIT_LABEL } from "@/domain/clients";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { saveServiceGrid } from "./actions";
import type { GridRow, GridService } from "./queries";

const key = (c: string, s: string) => `${c}:${s}`;
const day = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Quantidade mensal de cada serviço, cliente a cliente, numa tabela só. */
export function ServiceGrid({ services, rows }: { services: GridService[]; rows: GridRow[] }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"proximo" | "agora">("proximo");
  const [q, setQ] = useState("");
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const shown = useMemo(() => (q.trim() ? rows.filter((r) => norm(r.name).includes(norm(q.trim()))) : rows), [rows, q]);
  const changes = Object.entries(edits).flatMap(([k, v]) => {
    const [clientId, serviceId] = k.split(":");
    const row = rows.find((r) => r.clientId === clientId);
    const cell = row?.cells[serviceId];
    if (v.trim() === "") return [];
    const qty = Number(v);
    if (!Number.isInteger(qty) || qty < 0 || qty > 200) return [{ clientId, serviceId, qty: Number.NaN }];
    return qty === (cell?.current ?? null) && !cell?.next ? [] : [{ clientId, serviceId, qty }];
  });
  const invalid = changes.some((c) => Number.isNaN(c.qty));

  const save = () => {
    if (invalid) return setAlert("Use números inteiros de 0 a 200.");
    setAlert(null);
    run(async () => {
      const res = await saveServiceGrid({ mode, changes });
      if (!res.ok) return setAlert(res.message);
      handleResult(res);
      setEdits({});
    });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Buscar cliente</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" autoComplete="off" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </label>
        <p className="text-sm text-muted-foreground">{rows.length} clientes ativos. Deixe em branco o que não muda.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Quantidade mensal por cliente e serviço</caption>
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 bg-card px-3 py-2 font-medium">Cliente</th>
              {services.map((s) => (
                <th key={s.id} scope="col" className="px-3 py-2 font-medium">
                  {s.name} <span className="font-normal">({UNIT_LABEL[s.unit] ?? `${s.unit}/mês`})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((r) => (
              <tr key={r.clientId}>
                <th scope="row" className="sticky left-0 max-w-56 bg-card px-3 py-2 text-left font-normal">
                  <Link href={`/clientes/${r.clientId}`} className="break-words hover:underline">{r.name}</Link>
                </th>
                {services.map((s) => {
                  const cell = r.cells[s.id];
                  const k = key(r.clientId, s.id);
                  const changed = edits[k] !== undefined && edits[k] !== "";
                  return (
                    <td key={s.id} className="px-3 py-2 align-top">
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={`${s.name} de ${r.name} por mês`}
                        placeholder={cell.current === null ? "—" : String(cell.current)}
                        value={edits[k] ?? ""}
                        onChange={(e) => setEdits((x) => ({ ...x, [k]: e.target.value.replace(/[^\d]/g, "").slice(0, 3) }))}
                        className={cn("h-8 w-20 tabular-nums", changed && "border-brand ring-1 ring-brand/30")}
                      />
                      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground tabular-nums">
                        {cell.current === null ? "não contratado" : `hoje: ${cell.current}`}
                        {cell.next && ` · ${day(cell.next.from)}: ${cell.next.qty}`}
                      </p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && <p className="text-sm text-muted-foreground">Nenhum cliente ativo com esse nome.</p>}

      <div className="sticky bottom-24 z-10 md:bottom-3 grid gap-3 rounded-xl border bg-surface p-3 shadow-sm sm:flex sm:items-center sm:justify-between">
        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-medium">As novas quantidades valem</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="modo" value="proximo" checked={mode === "proximo"} onChange={() => setMode("proximo")} className="accent-brand" />
              A partir do próximo mês de cada cliente
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="modo" value="agora" checked={mode === "agora"} onChange={() => setMode("agora")} className="accent-brand" />
              Já neste mês (cria as demandas do mês agora)
            </label>
          </div>
        </fieldset>
        <div className="grid gap-2 sm:justify-items-end">
          <FormAlert>{alert}</FormAlert>
          <Button onClick={save} disabled={pending || changes.length === 0}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {changes.length ? `Salvar ${changes.length} ${changes.length === 1 ? "alteração" : "alterações"}` : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
