"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert, FormField } from "@/components/app/form-field";
import { buildRows, guessMapping, type ImportField } from "@/domain/clients/import";
import { importClients } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { useHydrated } from "@/hooks/use-hydrated";

const IGNORE = "__ignorar";
const BASE_FIELDS: [ImportField, string][] = [
  ["name", "Nome do cliente"],
  ["segment", "Nicho / segmento"],
  ["document", "CNPJ/CPF"],
  ["contract_start", "Início do contrato"],
  ["contract_end", "Fim do contrato"],
  ["notes", "Observações"],
];

export function Importer({ services }: { services: { id: string; name: string; key: string }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportField | "">>({});
  const [mode, setMode] = useState<"ativo" | "onboarding">("ativo");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, startTransition] = useTransition();
  // Antes de a página ficar interativa, o arquivo escolhido se perderia.
  const hydrated = useHydrated();

  const result = useMemo(() => (records.length ? buildRows(records, mapping) : null), [records, mapping]);
  const hasName = Object.values(mapping).includes("name");

  const read = async (f: File) => {
    setError(null);
    setReading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false, dateNF: "dd/mm/yyyy" });
      if (!rows.length) throw new Error("vazia");
      const hs = Object.keys(rows[0]).filter((h) => !/^__EMPTY/.test(h));
      setFile(f.name);
      setHeaders(hs);
      setRecords(rows.slice(0, 1000));
      setMapping(guessMapping(hs, services));
    } catch {
      setError("Não foi possível ler a planilha. Use .xlsx, .xls ou .csv com os nomes das colunas na primeira linha.");
      setHeaders([]);
      setRecords([]);
    } finally {
      setReading(false);
    }
  };

  const run = () =>
    startTransition(async () => {
      if (!result?.rows.length) return;
      const res = await importClients({ fileName: file, mode, rows: result.rows });
      if (handleResult(res)) router.push("/clientes");
    });

  return (
    <div className="grid gap-6">
      <FormAlert>{error}</FormAlert>
      <FormField label="Planilha" hint="A primeira linha precisa ter os nomes das colunas. Até 1.000 clientes por vez.">
        <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} disabled={reading || pending || !hydrated} />
      </FormField>
      {reading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Lendo planilha…</p>}

      {headers.length > 0 && (
        <>
          <section aria-labelledby="map" className="grid gap-3">
            <h2 id="map" className="text-base font-semibold">1. Confira o que é cada coluna</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {headers.map((h) => (
                <li key={h} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <Label htmlFor={`map-${h}`} className="min-w-0 flex-1 truncate font-normal">{h}</Label>
                  <Select value={mapping[h] || IGNORE} onValueChange={(v) => setMapping({ ...mapping, [h]: v === IGNORE ? "" : (v as ImportField) })}>
                    <SelectTrigger id={`map-${h}`} className="w-52"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE}>Ignorar</SelectItem>
                      {BASE_FIELDS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                      {services.map((s) => <SelectItem key={s.id} value={`service:${s.id}`}>Serviço: {s.name} (qtd/mês)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
            {!hasName && <FormAlert>Indique qual coluna tem o nome do cliente.</FormAlert>}
          </section>

          {hasName && result && (
            <section aria-labelledby="prev" className="grid gap-3">
              <h2 id="prev" className="text-base font-semibold">2. Prévia: {result.rows.length} cliente(s) válido(s)</h2>
              {result.problems.length > 0 && (
                <FormAlert tone="info">
                  {result.problems.length} linha(s) com problema serão ajustadas ou ignoradas:{" "}
                  {result.problems.slice(0, 5).map((p) => `linha ${p.line} (${p.message})`).join("; ")}
                  {result.problems.length > 5 && "…"}
                </FormAlert>
              )}
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium">Nicho</th>
                      <th className="px-3 py-2 font-medium">Contrato</th>
                      <th className="px-3 py-2 font-medium">Serviços</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 15).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2">{r.segment || "—"}</td>
                        <td className="px-3 py-2 tabular">{[r.contract_start, r.contract_end].filter(Boolean).join(" a ") || "—"}</td>
                        <td className="px-3 py-2">
                          {r.services.map((s) => `${services.find((x) => x.id === s.service_id)?.name}${s.monthly_qty ? ` (${s.monthly_qty})` : ""}`).join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.rows.length > 15 && <p className="border-t px-3 py-2 text-xs text-muted-foreground">E mais {result.rows.length - 15}.</p>}
              </div>
            </section>
          )}

          {hasName && (
            <section aria-labelledby="modo" className="grid gap-3">
              <h2 id="modo" className="text-base font-semibold">3. Como os clientes entram</h2>
              <Select value={mode} onValueChange={(v) => setMode(v as "ativo" | "onboarding")}>
                <SelectTrigger className="w-full sm:w-[28rem]" aria-label="Como os clientes entram"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Já ativos (clientes antigos: onboarding marcado como legado)</SelectItem>
                  <SelectItem value="onboarding">Em onboarding (vão precisar preencher a ficha)</SelectItem>
                </SelectContent>
              </Select>
              <Button className="justify-self-start" size="lg" onClick={run} disabled={pending || !result?.rows.length}>
                {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
                Importar {result?.rows.length ?? 0} cliente(s)
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
