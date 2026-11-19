"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert, FormField } from "@/components/app/form-field";
import { adStatusLabel } from "@/domain/ads";
import type { PlanPlatform } from "@/domain/ads/plans";
import { linkPlanCampaign, loadPlanOptions } from "@/features/ads/plan-actions";
import type { PlanOptions } from "@/features/ads/plan-queries";
import { handleResult } from "@/lib/action-feedback";

/** Ligar o plano a uma campanha à mão (quando o nome não bate) ou soltar a campanha ligada. */
export function PlanLinkDialog({ id, clientId, platform, linked, trigger }: { id: string; clientId: string; platform: PlanPlatform; linked: { id: string; name: string } | null; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PlanOptions | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [alert, setAlert] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, run] = useTransition();
  const [loading, load] = useTransition();

  useEffect(() => {
    if (!open) return;
    load(async () => {
      const res = await loadPlanOptions({ clientId });
      if (res.ok) setOptions(res.data);
      else setAlert(res.message);
    });
  }, [open, clientId]);

  const choices = (options?.campaigns ?? []).filter((c) => c.platform === platform && (!c.taken || c.id === linked?.id));
  const send = (value: string | null) => {
    if (value === "") return setError("Escolha a campanha.");
    setError(undefined);
    setAlert(null);
    run(async () => {
      const res = await linkPlanCampaign({ id, clientId, campaignId: value });
      if (!res.ok) return setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setCampaignId(linked?.id ?? ""); setAlert(null); setError(undefined); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Campanha do plano</DialogTitle>
          <DialogDescription>Com a campanha ligada, o plano mostra o que já foi gasto e vai para No ar quando ela fica ativa.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          {loading || !options ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Carregando as campanhas…</p>
          ) : choices.length ? (
            <FormField label="Campanha" required error={error}>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger className="w-full" aria-label="Campanha"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>
                  {choices.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {adStatusLabel(c.status)}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma campanha livre nas contas deste cliente nesta plataforma. Confira se a conta está ligada ao cliente em Configurações › Integrações e sincronize.</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          {linked && <Button variant="outline" onClick={() => send(null)} disabled={pending}>Soltar campanha</Button>}
          {choices.length > 0 && (
            <Button onClick={() => send(campaignId)} disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Ligar campanha
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
