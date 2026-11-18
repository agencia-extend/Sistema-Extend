"use client";

import { useState, useTransition } from "react";
import { Copy, LoaderCircle, Pause, Play, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/app/form-field";
import { adStatusLabel, isRunning } from "@/domain/ads";
import { centsToInput, formatBRL } from "@/domain/shared/money";
import type { ActionResult } from "@/domain/shared/result";
import { duplicateAdObject, listCampaignAdSets, renameAdObject, setAdBudget, setAdStatus, type AdSetBudget } from "@/features/ads/manage-actions";
import { handleResult } from "@/lib/action-feedback";
import { adBudgetSchema } from "@/features/ads/schemas";

type Campaign = { id: string; name: string; status: string | null; dailyBudgetCents: number | null };

/**
 * Ajustes da campanha pelo sistema (vale na hora na Meta e entra no histórico do cliente): pausar/ativar, orçamento
 * diário (da campanha ou de cada conjunto), renomear e duplicar.
 */
export function CampaignAdjust({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState("");
  const [budget, setBudget] = useState("");
  const [name, setName] = useState(campaign.name);
  const [sets, setSets] = useState<AdSetBudget[] | null>(null);
  const [setBudgets, setSetBudgets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const active = isRunning(campaign.status);

  const go = (key: string, fn: () => Promise<ActionResult<unknown>>, close = true) => {
    setError(null);
    setBusy(key);
    run(async () => {
      const res = await fn();
      setBusy(null);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      if (close) setOpen(false);
    });
  };

  const onOpen = (o: boolean) => {
    if (pending) return;
    setOpen(o);
    if (!o) return;
    setWhy(""); setError(null); setName(campaign.name); setBudget(centsToInput(campaign.dailyBudgetCents)); setSets(null);
    if (campaign.dailyBudgetCents === null)
      void listCampaignAdSets({ campaignId: campaign.id }).then((r) => {
        if (!r.ok) return setError(r.message);
        setSets(r.data);
        setSetBudgets(Object.fromEntries(r.data.map((s) => [s.id, centsToInput(s.dailyBudgetCents)])));
      });
  };

  // Orçamento: valida aqui (Zod) antes de ir ao servidor e à Meta.
  const saveBudget = (key: string, level: "campaign" | "adset", id: string, value: string) => {
    const parsed = adBudgetSchema.safeParse({ level, id, dailyBudget: value, why: reason });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira o orçamento.");
    go(key, () => setAdBudget({ level, id, dailyBudget: value, why: reason }));
  };

  const spin = (key: string) => busy === key && <LoaderCircle className="animate-spin" aria-hidden="true" />;
  const reason = why.trim() || undefined;

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`Ajustar a campanha ${campaign.name}`}><SlidersHorizontal aria-hidden="true" /> Ajustar</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-words">Ajustar: {campaign.name}</DialogTitle>
          <DialogDescription>Vale na hora na conta de anúncios do cliente e fica no histórico de alterações, com o seu nome.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <FormAlert>{error}</FormAlert>
          <FormField label="Motivo" optional hint="Vai junto para o histórico do cliente.">
            <Input autoComplete="off" maxLength={1000} placeholder="Ex.: CPL acima da meta há 3 dias…" value={why} onChange={(e) => setWhy(e.target.value)} />
          </FormField>

          <section aria-labelledby="aj-situacao" className="grid gap-2">
            <h3 id="aj-situacao" className="text-sm font-semibold">Situação: {adStatusLabel(campaign.status)}</h3>
            <Button variant={active ? "outline" : "default"} disabled={pending} className="w-fit"
              onClick={() => go("status", () => setAdStatus({ level: "campaign", id: campaign.id, active: !active, why: reason }))}>
              {spin("status") || (active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />)} {active ? "Pausar a campanha" : "Ativar a campanha"}
            </Button>
          </section>

          <section aria-labelledby="aj-orcamento" className="grid gap-2">
            <h3 id="aj-orcamento" className="text-sm font-semibold">Orçamento diário</h3>
            {campaign.dailyBudgetCents !== null ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <FormField label="Novo orçamento por dia (R$)" className="sm:flex-1">
                  <Input inputMode="decimal" autoComplete="off" value={budget} onChange={(e) => setBudget(e.target.value)} />
                </FormField>
                <Button variant="outline" disabled={pending} onClick={() => saveBudget("budget", "campaign", campaign.id, budget)}>
                  {spin("budget")} Salvar orçamento
                </Button>
              </div>
            ) : sets === null ? (
              <p className="text-sm text-muted-foreground">{error ? "—" : "Carregando os conjuntos…"}</p>
            ) : sets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Esta campanha não tem conjuntos sincronizados.</p>
            ) : (
              <ul className="grid gap-3" aria-label="Orçamento de cada conjunto">
                {sets.map((s) => (
                  <li key={s.id} className="grid gap-1.5 rounded-lg border p-3">
                    <p className="text-sm font-medium break-words">{s.name} <span className="text-xs font-normal text-muted-foreground">· {adStatusLabel(s.status)}</span></p>
                    {s.dailyBudgetCents === null ? (
                      <p className="text-xs text-muted-foreground">Sem orçamento diário (vitalício ou da campanha).</p>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input inputMode="decimal" autoComplete="off" aria-label={`Orçamento por dia de ${s.name} (R$)`} className="sm:flex-1"
                          value={setBudgets[s.id] ?? ""} onChange={(e) => setSetBudgets((b) => ({ ...b, [s.id]: e.target.value }))} />
                        <Button size="sm" variant="outline" disabled={pending}
                          onClick={() => saveBudget(`set-${s.id}`, "adset", s.id, setBudgets[s.id] ?? "")}>
                          {spin(`set-${s.id}`)} Salvar
                        </Button>
                      </div>
                    )}
                    {s.dailyBudgetCents !== null && <p className="text-xs text-muted-foreground tabular">Hoje: {formatBRL(s.dailyBudgetCents)} por dia</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="aj-nome" className="grid gap-2">
            <h3 id="aj-nome" className="text-sm font-semibold">Nome</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input autoComplete="off" maxLength={400} aria-label="Novo nome da campanha" className="sm:flex-1" value={name} onChange={(e) => setName(e.target.value)} />
              <Button variant="outline" disabled={pending} onClick={() => go("rename", () => renameAdObject({ level: "campaign", id: campaign.id, name }))}>
                {spin("rename")} Renomear
              </Button>
            </div>
          </section>

          <section aria-labelledby="aj-duplicar" className="grid gap-2">
            <h3 id="aj-duplicar" className="text-sm font-semibold">Duplicar</h3>
            <p className="text-sm text-muted-foreground">Copia a campanha com os conjuntos e anúncios. A cópia nasce pausada.</p>
            <Button variant="outline" disabled={pending} className="w-fit" onClick={() => go("dup", () => duplicateAdObject({ level: "campaign", id: campaign.id, why: reason }))}>
              {spin("dup") || <Copy aria-hidden="true" />} Duplicar a campanha
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Pausar/ativar um anúncio (aba Anúncios do cliente). */
export function AdStatusToggle({ id, name, status }: { id: string; name: string; status: string | null }) {
  const [pending, run] = useTransition();
  const active = isRunning(status);
  return (
    <Button size="sm" variant="ghost" className="h-7 w-fit px-2 text-xs" disabled={pending} aria-label={`${active ? "Pausar" : "Ativar"} o anúncio ${name}`}
      onClick={() => run(async () => void handleResult(await setAdStatus({ level: "ad", id, active: !active })))}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      {active ? "Pausar" : "Ativar"}
    </Button>
  );
}
