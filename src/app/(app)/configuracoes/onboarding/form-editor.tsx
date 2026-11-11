"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { publishForm } from "@/features/clients/settings-actions";
import type { FormQuestion, FormSection } from "@/features/clients/schemas";
import { handleResult } from "@/lib/action-feedback";

const TYPES: Record<FormQuestion["type"], string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  select: "Uma opção",
  multiselect: "Várias opções",
  boolean: "Sim / não",
  url: "Link",
  number: "Número",
};

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "pergunta";

function move<T>(list: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const n = [...list];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

/** Modelo da ficha editável pelo admin (seções, perguntas, tipo, obrigatória, quem vê). */
export function FormEditor({ version, initial }: { version: number; initial: FormSection[] }) {
  const [sections, setSections] = useState<FormSection[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const update = (fn: (s: FormSection[]) => FormSection[]) => (setSections(fn), setDirty(true));
  const setQ = (si: number, qi: number, patch: Partial<FormQuestion>) =>
    update((all) => all.map((s, i) => (i !== si ? s : { ...s, questions: s.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)) })));

  const publish = () =>
    startTransition(async () => {
      if (handleResult(await publishForm({ sections }))) setDirty(false);
    });

  return (
    <section aria-labelledby="ficha" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-1">
          <h2 id="ficha" className="text-base font-semibold">Perguntas da ficha <span className="font-normal text-muted-foreground">(versão {version})</span></h2>
          <p className="text-sm text-muted-foreground">“Equipe vê” coloca a resposta no resumo operacional para editores, designers e social media.</p>
        </div>
        <Button onClick={publish} disabled={pending || !dirty}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Publicar nova versão
        </Button>
      </div>

      {sections.map((s, si) => (
        <fieldset key={s.key} className="grid gap-3 rounded-xl border bg-card p-4">
          <legend className="sr-only">{s.title}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-xs font-semibold" aria-label="Nome da seção" value={s.title} onChange={(e) => update((all) => all.map((x, i) => (i === si ? { ...x, title: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label="Subir seção" onClick={() => update((all) => move(all, si, -1))}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" aria-label="Descer seção" onClick={() => update((all) => move(all, si, 1))}><ArrowDown /></Button>
            <Button variant="ghost" size="icon" aria-label="Remover seção" onClick={() => update((all) => all.filter((_, i) => i !== si))} disabled={sections.length === 1}><Trash2 /></Button>
          </div>
          <ul className="grid gap-2">
            {s.questions.map((q, qi) => (
              <li key={`${q.key}-${qi}`} className="grid gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input className="min-w-0 flex-1 basis-60" aria-label="Pergunta" value={q.label} onChange={(e) => setQ(si, qi, { label: e.target.value })} />
                  <Select value={q.type} onValueChange={(v) => setQ(si, qi, { type: v as FormQuestion["type"] })}>
                    <SelectTrigger className="w-40" aria-label="Tipo de resposta"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {(q.type === "select" || q.type === "multiselect") && (
                  <Input
                    aria-label="Opções separadas por vírgula"
                    placeholder="Opções separadas por vírgula…"
                    value={(q.options ?? []).join(", ")}
                    onChange={(e) => setQ(si, qi, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                  />
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch id={`req-${si}-${qi}`} checked={q.required} onCheckedChange={(v) => setQ(si, qi, { required: v })} />
                    <Label htmlFor={`req-${si}-${qi}`} className="font-normal">Obrigatória</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id={`vis-${si}-${qi}`} checked={q.visibility === "operational"} onCheckedChange={(v) => setQ(si, qi, { visibility: v ? "operational" : "full" })} />
                    <Label htmlFor={`vis-${si}-${qi}`} className="font-normal">Equipe vê</Label>
                  </div>
                  <span className="ml-auto flex">
                    <Button variant="ghost" size="icon" aria-label="Subir pergunta" onClick={() => update((all) => all.map((x, i) => (i === si ? { ...x, questions: move(x.questions, qi, -1) } : x)))}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon" aria-label="Descer pergunta" onClick={() => update((all) => all.map((x, i) => (i === si ? { ...x, questions: move(x.questions, qi, 1) } : x)))}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon" aria-label="Remover pergunta" disabled={s.questions.length === 1}
                      onClick={() => update((all) => all.map((x, i) => (i === si ? { ...x, questions: x.questions.filter((_, j) => j !== qi) } : x)))}><Trash2 /></Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => {
              const used = new Set(sections.flatMap((x) => x.questions.map((q) => q.key)));
              let key = slug(`nova_${s.key}`);
              for (let n = 2; used.has(key); n++) key = `${slug(`nova_${s.key}`)}_${n}`;
              update((all) => all.map((x, i) => (i === si ? { ...x, questions: [...x.questions, { key, label: "Nova pergunta", type: "textarea", required: false, visibility: "full" }] } : x)));
            }}
          >
            <Plus aria-hidden="true" /> Pergunta
          </Button>
        </fieldset>
      ))}
      <Button
        variant="outline"
        className="justify-self-start"
        onClick={() => {
          const key = `secao_${Date.now().toString(36)}`;
          update((all) => [...all, { key, title: "Nova seção", questions: [{ key: `${key}_1`, label: "Nova pergunta", type: "textarea", required: false, visibility: "full" }] }]);
        }}
      >
        <Plus aria-hidden="true" /> Nova seção
      </Button>
    </section>
  );
}
