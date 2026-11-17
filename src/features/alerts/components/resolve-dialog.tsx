"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { resolveAlert } from "@/features/alerts/actions";
import { resolveAlertSchema } from "@/features/alerts/schemas";
import { handleResult } from "@/lib/action-feedback";

/** Resolver o alerta contando como foi resolvido (fica no painel, em Resolvidos). */
export function ResolveDialog({ id, title, trigger }: { id: string; title: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const parsed = resolveAlertSchema.safeParse({ id, note });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    run(async () => {
      const res = await resolveAlert(parsed.data);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setNote(""); setError(undefined); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolver alerta</DialogTitle>
          <DialogDescription className="break-words">{title}</DialogDescription>
        </DialogHeader>
        <form id={`resolve-${id}`} onSubmit={save} className="grid gap-4" noValidate>
          <FormAlert>{alert}</FormAlert>
          <FormField label="Como foi resolvido" required error={error} hint="O restante do tráfego do cliente recebe esta nota.">
            <Textarea rows={3} maxLength={500} placeholder="Ex.: cliente recarregou R$ 500 no Pix…" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </form>
        <DialogFooter>
          <Button type="submit" form={`resolve-${id}`} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Resolver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
