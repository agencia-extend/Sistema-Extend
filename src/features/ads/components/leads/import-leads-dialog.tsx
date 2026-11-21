"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { FileUp, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert } from "@/components/app/form-field";
import { CLIENT_LEAD_FIELDS, buildClientLeadRows, decodeCsv, guessClientLeadMapping, type ClientLeadField } from "@/domain/ads/client-leads";
import { importClientLeads } from "@/features/ads/leads/actions";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__ignorar";
const MAX = 5000;

/**
 * Importar a planilha de leads do cliente: a exportação da Central de leads da Meta (CSV ou Excel) ou a planilha do
 * CRM do cliente. Leads que já estão no sistema não entram de novo.
 */
export function ImportLeadsDialog({ clientId }: { clientId: string }) {
  const router = useRouter();
  const fileId = useId();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ClientLeadField | "">>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, run] = useTransition();

  const built = useMemo(() => (records.length ? buildClientLeadRows(records, mapping) : null), [records, mapping]);

  const reset = () => { setFileName(""); setHeaders([]); setRecords([]); setMapping({}); setAlert(null); };

  const read = async (f: File | undefined) => {
    reset();
    if (!f) return;
    setFileName(f.name);
    setReading(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      // CSV como texto (acentos em UTF-8 ou UTF-16; ids da Meta passam de 15 dígitos e perderiam precisão como número).
      // No Excel, data vem como data.
      const wb = /.csv$/i.test(f.name) || f.type === "text/csv"
        ? XLSX.read(decodeCsv(buf), { type: "string", raw: true })
        : XLSX.read(buf, { type: "array", cellDates: true });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
      if (!rows.length) throw new Error("vazia");
      const hs = Object.keys(rows[0]).filter((h) => !/^__EMPTY/.test(h));
      setHeaders(hs);
      setRecords(rows.slice(0, MAX));
      setMapping(guessClientLeadMapping(hs));
      if (rows.length > MAX) setAlert(`A planilha tem mais de ${MAX.toLocaleString("pt-BR")} linhas: só as primeiras ${MAX.toLocaleString("pt-BR")} entram nesta importação.`);
    } catch {
      setAlert("Não foi possível ler a planilha. Use .csv, .xlsx ou .xls com os nomes das colunas na primeira linha.");
    } finally {
      setReading(false);
    }
  };

  const save = () => {
    if (!built?.rows.length) return setAlert("Nenhum lead válido. Confira as colunas de data e de nome, telefone ou e-mail.");
    setAlert(null);
    run(async () => {
      const res = await importClientLeads({ clientId, rows: built.rows });
      if (!res.ok) return setAlert(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };

  const mapped = (f: ClientLeadField) => Object.values(mapping).includes(f);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending && !o) return; setOpen(o); if (o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Upload aria-hidden="true" /> Importar leads</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar leads do cliente</DialogTitle>
          <DialogDescription>
            Use a planilha da Central de leads da Meta (Gerenciador de Negócios › Central de leads › Baixar) ou a do CRM do cliente. Leads que já estão
            aqui não entram de novo; a campanha se liga pelo nome ou pelo ID.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Planilha</span>
            <div className="flex flex-wrap items-center gap-3">
              <input id={fileId} type="file" accept=".csv,.xlsx,.xls" className="peer sr-only" aria-label="Planilha de leads" disabled={reading || pending}
                onChange={(e) => read(e.target.files?.[0])} />
              <label htmlFor={fileId} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-surface px-3 text-sm font-medium hover:bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
                {reading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />} Escolher arquivo
              </label>
              <span className="min-w-0 text-sm break-all text-muted-foreground">{fileName || "Nenhum arquivo escolhido"}</span>
            </div>
          </div>

          {headers.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">O que é cada coluna</legend>
              <ul className="grid gap-2 sm:grid-cols-2">
                {headers.map((h) => (
                  <li key={h} className="grid gap-1">
                    <span className="truncate text-xs text-muted-foreground" title={h}>{h}</span>
                    <Select value={mapping[h] || NONE} onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v === NONE ? "" : (v as ClientLeadField) }))}>
                      <SelectTrigger className="w-full" aria-label={`Campo da coluna ${h}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Não usar</SelectItem>
                        {CLIENT_LEAD_FIELDS.map(([f, label]) => (
                          <SelectItem key={f} value={f} disabled={mapping[h] !== f && mapped(f)}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {built && (
            <div className="grid gap-1 rounded-lg bg-muted px-3 py-2 text-sm" role="status">
              <p>
                {built.rows.length.toLocaleString("pt-BR")} {built.rows.length === 1 ? "lead pronto" : "leads prontos"} para importar
                {built.skipped.length > 0 && `; ${built.skipped.length.toLocaleString("pt-BR")} ${built.skipped.length === 1 ? "linha fica" : "linhas ficam"} de fora`}.
              </p>
              {built.skipped.length > 0 && (
                <ul className="text-xs text-muted-foreground">
                  {built.skipped.slice(0, 5).map((s) => <li key={s.line}>Linha {s.line}: {s.reason}.</li>)}
                  {built.skipped.length > 5 && <li>E mais {built.skipped.length - 5}.</li>}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={!built?.rows.length || pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {built?.rows.length ? `Importar ${built.rows.length.toLocaleString("pt-BR")} ${built.rows.length === 1 ? "lead" : "leads"}` : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
