"use client";

import { useState } from "react";
import { Check, Copy, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEVEL_LABEL, TOKENS, buildName, checkName, parseNaming, type NamingLevel } from "@/domain/ads/naming";
import { cn } from "@/lib/utils";

/** Gerador de nome (RF-PLA-03): escolhe o nível, preenche as peças e copia o nome no padrão da agência. */
export function NameGenerator({ templates, month }: { templates: Record<NamingLevel, string>; month: string }) {
  const [level, setLevel] = useState<NamingLevel>("campaign");
  const [values, setValues] = useState<Record<string, string>>({ "AAAA-MM": month });
  const [copied, setCopied] = useState(false);
  const r = parseNaming(templates[level]);
  const parts = "parts" in r ? r.parts : [];
  const tokens = [...new Set(parts.filter((p) => p.kind === "token").map((p) => (p as { key: string }).key))];
  const name = buildName(parts, values);
  const missing = tokens.filter((k) => !(values[k] ?? "").trim());
  const check = parts.length ? checkName(name, parts) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      toast.success("Nome copiado. Cole no Gerenciador de Anúncios.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o nome e copie à mão.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline"><Wand2 aria-hidden="true" /> Gerar nome</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar nome no padrão</DialogTitle>
          <DialogDescription>Preencha as peças e copie. O verificador da aba Nomenclatura confere o que já está nas contas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ng-level">Para</Label>
            <Select value={level} onValueChange={(x) => setLevel(x as NamingLevel)}>
              <SelectTrigger id="ng-level" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(LEVEL_LABEL) as NamingLevel[]).map((l) => <SelectItem key={l} value={l}>{LEVEL_LABEL[l]}</SelectItem>)}</SelectContent>
            </Select>
            <p className="font-mono text-xs text-muted-foreground">{templates[level]}</p>
          </div>
          {"error" in r ? <p className="text-sm text-danger">{r.error}</p> : tokens.map((k) => {
            const t = TOKENS[k];
            const id = `ng-${k}`;
            return (
              <div key={k} className="grid gap-1.5">
                <Label htmlFor={id}>{t.label}</Label>
                {t.options ? (
                  <Select value={values[k] ?? ""} onValueChange={(x) => setValues((v) => ({ ...v, [k]: x }))}>
                    <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                    <SelectContent>{t.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input id={id} value={values[k] ?? ""} autoComplete="off" spellCheck={false} type={k === "AAAA-MM" ? "month" : "text"}
                    inputMode={k === "V#" || k === "CR" ? "numeric" : undefined} placeholder={`${t.example}…`} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
                )}
                <span className="text-xs text-muted-foreground">{t.hint}</span>
              </div>
            );
          })}
          <div className="grid gap-2 rounded-lg border bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground">Nome</span>
            <output className="font-mono text-sm break-all" aria-live="polite">{name || "—"}</output>
            {missing.length > 0 ? (
              <span className="text-xs text-muted-foreground">Falta: {missing.map((k) => TOKENS[k].label.toLowerCase()).join(", ")}.</span>
            ) : check && !check.ok ? (
              <span className="text-xs text-danger">Fora do padrão: {check.reason}.</span>
            ) : null}
            <Button type="button" className={cn("w-fit")} disabled={missing.length > 0 || (check !== null && !check.ok)} onClick={copy}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copiado" : "Copiar nome"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
