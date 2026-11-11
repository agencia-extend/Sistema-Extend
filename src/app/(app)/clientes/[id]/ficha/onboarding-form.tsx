"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CloudOff, LoaderCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { saveAnswers } from "@/features/clients/actions";
import type { FormQuestion, FormSection } from "@/features/clients/schemas";
import { formatDateTime } from "@/domain/shared/dates";

type Value = string | string[] | boolean | null;
type SaveState = { kind: "idle" | "saving" | "saved" | "error"; at?: string; message?: string };

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "boolean" ? true : Boolean(v && String(v).trim()));

/** Ficha de onboarding em seções, com salvamento automático e progresso (RF-ONB-01). */
export function OnboardingForm({
  clientId,
  sections,
  answers: initial,
  canEdit,
  savedAt,
}: {
  clientId: string;
  sections: FormSection[];
  answers: Record<string, unknown>;
  canEdit: boolean;
  savedAt: string | null;
}) {
  const [answers, setAnswers] = useState<Record<string, Value>>(initial as Record<string, Value>);
  const [state, setState] = useState<SaveState>({ kind: "idle", at: savedAt ?? undefined });
  const pending = useRef<Record<string, Value>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const batch = pending.current;
    if (!Object.keys(batch).length) return;
    pending.current = {};
    setState({ kind: "saving" });
    const res = await saveAnswers({ clientId, answers: batch });
    if (res.ok) setState({ kind: "saved", at: (res.data as { savedAt: string }).savedAt });
    else {
      pending.current = { ...batch, ...pending.current };
      setState({ kind: "error", message: res.message });
    }
  }, [clientId]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const change = (key: string, v: Value) => {
    setAnswers((a) => ({ ...a, [key]: v }));
    pending.current[key] = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 900);
  };

  const all = sections.flatMap((s) => s.questions);
  const required = all.filter((q) => q.required);
  const done = required.filter((q) => filled(answers[q.key])).length;

  return (
    <div className="grid gap-6">
      <div className="sticky top-16 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/95 px-4 py-2.5 backdrop-blur">
        <p className="text-sm">
          <span className="font-semibold tabular">{done}/{required.length}</span> obrigatórias preenchidas
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {state.kind === "saving" && (<><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Salvando…</>)}
          {state.kind === "saved" && (<><Check className="size-3.5 text-success" aria-hidden="true" /> Salvo {state.at ? formatDateTime(state.at).slice(11) : ""}</>)}
          {state.kind === "idle" && state.at && `Última alteração: ${formatDateTime(state.at)}`}
          {state.kind === "error" && (
            <button type="button" onClick={() => void flush()} className="flex items-center gap-1.5 font-medium text-danger">
              <CloudOff className="size-3.5" aria-hidden="true" /> Não salvou. Tentar de novo
            </button>
          )}
        </p>
      </div>

      {sections.map((s) => (
        <fieldset key={s.key} className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
          <legend className="px-1 text-base font-semibold">{s.title}</legend>
          {s.questions.map((q) => (
            <Question key={q.key} q={q} value={answers[q.key] ?? null} disabled={!canEdit} onChange={(v) => change(q.key, v)} />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function Question({ q, value, disabled, onChange }: { q: FormQuestion; value: Value; disabled: boolean; onChange: (v: Value) => void }) {
  const hint = [q.help, q.visibility === "operational" ? "Aparece no resumo para a equipe de produção." : null].filter(Boolean).join(" ");
  if (q.type === "boolean") {
    return (
      <div className="flex min-h-10 items-center gap-3">
        <Switch id={`q-${q.key}`} checked={value === true} onCheckedChange={(v) => onChange(v)} disabled={disabled} />
        <Label htmlFor={`q-${q.key}`} className="font-normal">{q.label}</Label>
      </div>
    );
  }
  if (q.type === "multiselect") {
    const list = Array.isArray(value) ? value : [];
    return (
      <fieldset className="grid gap-1.5" disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">{q.label}{q.required && <span className="sr-only"> (obrigatório)</span>}</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {(q.options ?? []).map((o) => (
            <div key={o} className="flex min-h-9 items-center gap-2">
              <Checkbox id={`q-${q.key}-${o}`} checked={list.includes(o)} onCheckedChange={(v) => onChange(v ? [...list, o] : list.filter((x) => x !== o))} />
              <Label htmlFor={`q-${q.key}-${o}`} className="font-normal">{o}</Label>
            </div>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <FormField label={q.label} required={q.required} optional={!q.required} hint={hint || undefined}>
      {q.type === "textarea" ? (
        <Textarea rows={3} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      ) : q.type === "select" ? (
        <Select value={typeof value === "string" ? value : ""} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Escolha uma opção" /></SelectTrigger>
          <SelectContent>
            {(q.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={q.type === "url" ? "url" : q.type === "number" ? "number" : "text"}
          inputMode={q.type === "number" ? "decimal" : undefined}
          autoComplete="off"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </FormField>
  );
}
