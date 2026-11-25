"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ExternalLink, LoaderCircle, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCORE_RULES, scoreTone } from "@/domain/crm/prospector";
import { handleResult } from "@/lib/action-feedback";
import { importProspects, searchProspects, type ProspectRow } from "@/features/crm/prospector-actions";
import { cn } from "@/lib/utils";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
const TONE = { alta: "bg-emerald-600 text-white", media: "bg-amber-500 text-black", baixa: "bg-muted text-muted-foreground" } as const;

type Props = {
  pipelines: { id: string; name: string }[];
  defaultPipeline: string;
  canImport: boolean;
  usage: number;
  limit: number;
};

export function ProspectorPanel({ pipelines, defaultPipeline, canImport, usage: initialUsage, limit }: Props) {
  const router = useRouter();
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState<string>("RS");
  const [pages, setPages] = useState("1");
  const [pipeline, setPipeline] = useState(defaultPipeline);
  const [rows, setRows] = useState<ProspectRow[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [usage, setUsage] = useState(initialUsage);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searching, startSearch] = useTransition();
  const [importing, startImport] = useTransition();
  const searched = useMemo(() => ({ niche, city }), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = Math.max(0, limit - usage);
  const available = (rows ?? []).filter((r) => !r.imported && !r.inCrm);

  function search(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => {
      const res = await searchProspects({ niche, city, uf, pages: Number(pages) });
      setErrors(res.ok ? {} : Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, v[0]])));
      if (handleResult(res) && res.ok && res.data) {
        setRows(res.data.rows);
        setUsage(res.data.usage);
        setPicked(new Set(res.data.rows.filter((r) => !r.imported && !r.inCrm && r.score >= 35).map((r) => r.id)));
      }
    });
  }

  function doImport() {
    const places = (rows ?? []).filter((r) => picked.has(r.id)).map(({ id, name, phone, website, address, rating, reviews, mapsUrl, category, open }) => ({ id, name, phone, website, address, rating, reviews, mapsUrl, category, open }));
    startImport(async () => {
      const res = await importProspects({ pipelineId: pipeline, niche: searched.niche, city: searched.city, places });
      if (handleResult(res)) {
        setRows((rs) => (rs ?? []).map((r) => (picked.has(r.id) ? { ...r, imported: true } : r)));
        setPicked(new Set());
        router.refresh();
      }
    });
  }

  const toggle = (id: string, on: boolean) => setPicked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  return (
    <div className="grid gap-6">
      <form onSubmit={search} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_6rem_8rem_auto] sm:items-end" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-niche">Nicho</Label>
          <Input id="pr-niche" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="ex.: imobiliária, clínica odontológica" maxLength={80} aria-invalid={Boolean(errors.niche)} aria-describedby={errors.niche ? "pr-niche-err" : undefined} />
          {errors.niche && <p id="pr-niche-err" className="text-xs text-destructive">{errors.niche}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-city">Cidade</Label>
          <Input id="pr-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="ex.: Porto Alegre" maxLength={80} autoComplete="address-level2" aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? "pr-city-err" : undefined} />
          {errors.city && <p id="pr-city-err" className="text-xs text-destructive">{errors.city}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-uf">UF</Label>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger id="pr-uf"><SelectValue /></SelectTrigger>
            <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-pages">Quantidade</Label>
          <Select value={pages} onValueChange={setPages}>
            <SelectTrigger id="pr-pages"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Até 20</SelectItem>
              <SelectItem value="2">Até 40</SelectItem>
              <SelectItem value="3">Até 60</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={searching || left === 0} className="min-h-11">
          {searching ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />} Buscar
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-5">
          {left === 0 ? "Limite do mês atingido. " : ""}Buscas no mês: {usage} de {limit} (cada 20 empresas conta 1). Os dados vêm do Google Maps.
        </p>
      </form>

      {rows === null ? (
        <section aria-labelledby="pr-how" className="rounded-xl border border-dashed p-5 text-sm">
          <h2 id="pr-how" className="mb-2 font-semibold">Como o score funciona</h2>
          <p className="mb-2 text-muted-foreground">Quanto maior, mais a empresa precisa de marketing e mais fácil é falar com ela.</p>
          <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">{SCORE_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nenhuma empresa encontrada. Tente um nicho mais comum ou outra cidade.</p>
      ) : (
        <section aria-labelledby="pr-res" className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="pr-res" className="text-base font-semibold">{rows.length} empresa(s) · {picked.size} selecionada(s)</h2>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canImport && pipelines.length > 1 && (
                <Select value={pipeline} onValueChange={setPipeline}>
                  <SelectTrigger className="w-48" aria-label="Funil de destino"><SelectValue /></SelectTrigger>
                  <SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Button variant="outline" type="button" onClick={() => setPicked(picked.size === available.length ? new Set() : new Set(available.map((r) => r.id)))} disabled={!available.length}>
                {picked.size === available.length && available.length ? "Desmarcar todas" : "Marcar todas"}
              </Button>
              {canImport ? (
                <Button type="button" onClick={doImport} disabled={importing || picked.size === 0}>
                  {importing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />} Levar ao funil
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Para levar ao funil é preciso poder gerenciar leads.</span>
              )}
            </div>
          </div>
          <ul className="divide-y rounded-xl border bg-card">
            {rows.map((r) => {
              const locked = r.imported || r.inCrm;
              return (
                <li key={r.id} className={cn("flex gap-3 px-4 py-3", locked && "opacity-70")}>
                  <Checkbox className="mt-1" checked={picked.has(r.id)} disabled={locked || !canImport} onCheckedChange={(v) => toggle(r.id, v === true)} aria-label={`Selecionar ${r.name}`} />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold tabular", TONE[scoreTone(r.score)])} title="Score de oportunidade">{r.score}</span>
                      {r.category && <Badge variant="secondary">{r.category}</Badge>}
                      {r.imported && <Badge variant="outline">Já importada</Badge>}
                      {!r.imported && r.inCrm && <Badge variant="outline">Já está no Comercial</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{[r.phone ?? "Sem telefone", r.address].filter(Boolean).join(" · ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.rating !== null ? `Nota ${String(r.rating).replace(".", ",")} · ` : ""}{r.reviews ?? 0} avaliação(ões) · {r.reasons.map((x) => x.text).join("; ")}
                    </p>
                    <p className="flex flex-wrap gap-3 text-xs">
                      {r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline">Site <ExternalLink className="size-3" aria-hidden="true" /></a> : <span className="text-muted-foreground">Sem site</span>}
                      {r.mapsUrl && <a href={r.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline">Google Maps <ExternalLink className="size-3" aria-hidden="true" /></a>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
