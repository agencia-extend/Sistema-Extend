"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/app/form-field";
import { DEFAULT_NAMING, LEVEL_LABEL, TOKENS, exampleName, parseNaming, type NamingLevel } from "@/domain/ads/naming";
import { saveNaming } from "@/features/ads/report-actions";
import { namingSchema } from "@/features/ads/schemas";
import { handleResult } from "@/lib/action-feedback";

const LEVELS: NamingLevel[] = ["campaign", "adset", "ad"];

/** Padrão de nome de campanha, conjunto e anúncio: peças inseridas por botões, com o exemplo ao vivo. */
export function NamingForm({ initial, canEdit }: { initial: Record<NamingLevel, string>; canEdit: boolean }) {
  const [v, setV] = useState(initial);
  const [focus, setFocus] = useState<NamingLevel>("campaign");
  const [errors, setErrors] = useState<Partial<Record<NamingLevel, string>>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const refs = useRef<Partial<Record<NamingLevel, HTMLInputElement | null>>>({});

  const insert = (key: string) => {
    const el = refs.current[focus];
    const token = `{${key}}`;
    const cur = v[focus];
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    setV((x) => ({ ...x, [focus]: cur.slice(0, start) + token + cur.slice(end) }));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const parsed = namingSchema.safeParse(v);
    if (!parsed.success) {
      const out: Partial<Record<NamingLevel, string>> = {};
      for (const i of parsed.error.issues) out[i.path[0] as NamingLevel] ??= i.message;
      setErrors(out);
      return setAlert("Revise os padrões destacados.");
    }
    setErrors({});
    run(async () => {
      const res = await saveNaming(parsed.data);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
    });
  };

  return (
    <form onSubmit={save} noValidate className="grid gap-5">
      <FormAlert>{alert}</FormAlert>
      {LEVELS.map((l) => {
        const r = parseNaming(v[l]);
        return (
          <div key={l} className="grid gap-1.5">
          <FormField label={LEVEL_LABEL[l]} required error={errors[l]}>
            <Input ref={(el) => { refs.current[l] = el; }} value={v[l]} disabled={!canEdit} spellCheck={false} autoComplete="off" maxLength={120}
              className="font-mono text-sm" onFocus={() => setFocus(l)} onChange={(e) => setV((x) => ({ ...x, [l]: e.target.value }))} />
          </FormField>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {"parts" in r ? <>Exemplo: <span className="font-mono text-foreground">{exampleName(r.parts)}</span></> : <span className="text-danger">{r.error}</span>}
            </p>
          </div>
        );
      })}
      {canEdit && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Inserir peça em {LEVEL_LABEL[focus].toLowerCase()} <span className="font-normal text-muted-foreground">(entra onde está o cursor)</span></legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(TOKENS).map(([k, t]) => (
              <Button key={k} type="button" variant="outline" size="sm" className="h-7 px-2 font-mono text-xs" title={`${t.label}: ${t.hint}`} aria-label={`Inserir ${t.label}`} onClick={() => insert(k)}>{`{${k}}`}</Button>
            ))}
          </div>
        </fieldset>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} {pending ? "Salvando…" : "Salvar nomenclatura"}</Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => { setV(DEFAULT_NAMING); setErrors({}); }}>Voltar à sugestão</Button>
        </div>
      )}
    </form>
  );
}
