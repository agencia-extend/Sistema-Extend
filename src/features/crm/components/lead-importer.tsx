"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert, FormField } from "@/components/app/form-field";
import { LEAD_IMPORT_FIELDS, SOURCE_LABEL, buildLeadRows, formatPhone, guessLeadMapping, type LeadImportField } from "@/domain/crm";
import { formatBRL } from "@/domain/shared/money";
import { importLeads } from "@/features/crm/actions";
import { handleResult } from "@/lib/action-feedback";
import { useHydrated } from "@/hooks/use-hydrated";

const IGNORE = "__ignorar";

/** Importar planilha de leads: confere colunas, mostra a prévia e pula quem já existe (RF-CRM-01). */
export function LeadImporter({ pipelineId, pipelineName }: { pipelineId: string; pipelineName: string }) {
  const router = useRouter();
  const [file, setFile] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, LeadImportField | "">>({});
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, start] = useTransition();
  const hydrated = useHydrated();

  const result = useMemo(() => (records.length ? buildLeadRows(records, mapping) : null), [records, mapping]);
  const mapped = Object.values(mapping);
  const hasName = mapped.includes("name") || mapped.includes("company");
  const hasContact = mapped.includes("phone") || mapped.includes("email");

  const read = async (f: File) => {
    setError(null);
    setReading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
      if (!rows.length) throw new Error("vazia");
      const hs = Object.keys(rows[0]).filter((h) => !/^__EMPTY/.test(h));
      setFile(f.name);
      setHeaders(hs);
      setRecords(rows.slice(0, 2000));
      setMapping(guessLeadMapping(hs));
      if (rows.length > 2000) setError("A planilha tem mais de 2.000 linhas: só as 2.000 primeiras entram nesta importação.");
    } catch {
      setError("Não foi possível ler a planilha. Use .xlsx, .xls ou .csv com os nomes das colunas na primeira linha.");
      setHeaders([]);
      setRecords([]);
    } finally {
      setReading(false);
    }
  };

  const run = () =>
    start(async () => {
      if (!result?.rows.length) return;
      const res = await importLeads({ fileName: file, pipelineId, rows: result.rows });
      if (handleResult(res)) {
        setHeaders([]);
        setRecords([]);
        router.refresh();
      }
    });

  return (
    <div className="grid gap-6">
      <FormAlert>{error}</FormAlert>
      <FormField label="Planilha de leads" hint={`Entram na primeira etapa do funil “${pipelineName}”. Até 2.000 por vez. Telefone ou e-mail já cadastrado é pulado.`}>
        <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} disabled={reading || pending || !hydrated} />
      </FormField>
      {reading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Lendo planilha…</p>}

      {headers.length > 0 && (
        <>
          <section aria-labelledby="map" className="grid gap-3">
            <h2 id="map" className="text-base font-semibold">Confira o que é cada coluna</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {headers.map((h) => (
                <li key={h} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <Label htmlFor={`map-${h}`} className="min-w-0 flex-1 truncate font-normal">{h}</Label>
                  <Select value={mapping[h] || IGNORE} onValueChange={(v) => setMapping({ ...mapping, [h]: v === IGNORE ? "" : (v as LeadImportField) })}>
                    <SelectTrigger id={`map-${h}`} className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE}>Ignorar</SelectItem>
                      {LEAD_IMPORT_FIELDS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
            {!hasName && <FormAlert>Indique a coluna com o nome do contato ou da empresa.</FormAlert>}
            {hasName && !hasContact && <FormAlert tone="info">Sem coluna de telefone ou e-mail, o sistema não consegue evitar leads repetidos.</FormAlert>}
          </section>

          {hasName && result && (
            <section aria-labelledby="prev" className="grid gap-3">
              <h2 id="prev" className="text-base font-semibold">Prévia: {result.rows.length} lead(s)</h2>
              {result.problems.length > 0 && (
                <FormAlert tone="info">
                  {result.problems.length} linha(s) ficam de fora: {result.problems.slice(0, 6).map((p) => `linha ${p.line} (${p.message})`).join("; ")}
                  {result.problems.length > 6 && "…"}
                </FormAlert>
              )}
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th scope="col" className="px-3 py-2 font-medium">Lead</th>
                      <th scope="col" className="px-3 py-2 font-medium">Telefone</th>
                      <th scope="col" className="px-3 py-2 font-medium">E-mail</th>
                      <th scope="col" className="px-3 py-2 font-medium">Origem</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 15).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{r.name}{r.company && r.company !== r.name && <span className="block text-xs text-muted-foreground">{r.company}</span>}</td>
                        <td className="px-3 py-2 tabular">{r.phone ? formatPhone(r.phone) : "—"}</td>
                        <td className="px-3 py-2 break-all">{r.email ?? "—"}</td>
                        <td className="px-3 py-2">{SOURCE_LABEL[r.source]}</td>
                        <td className="px-3 py-2 text-right tabular">{r.value_cents != null ? formatBRL(r.value_cents) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.rows.length > 15 && <p className="border-t px-3 py-2 text-xs text-muted-foreground">E mais {result.rows.length - 15}.</p>}
              </div>
              <Button className="justify-self-start" size="lg" onClick={run} disabled={pending || !result.rows.length}>
                {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
                Importar {result.rows.length} lead(s)
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
