"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { LIBRARY_STATUSES, LIBRARY_STATUS_LABEL, type LibraryStatus } from "@/domain/creatives";
import { updateLibraryItem } from "@/features/creatives/actions";
import { handleResult } from "@/lib/action-feedback";

type Item = { id: string; angle: string; status: LibraryStatus; primaryText: string | null; headline: string | null; description: string | null };

/** Situação do criativo na biblioteca e a copy final (texto principal, título e descrição). */
export function LibraryEdit({ item }: { item: Item }) {
  const router = useRouter();
  const init = { status: item.status, primaryText: item.primaryText ?? "", headline: item.headline ?? "", description: item.description ?? "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await updateLibraryItem({ id: item.id, ...v });
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(init); setError(null); } }}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Editar ${item.angle} na biblioteca`}><Pencil /></Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criativo na biblioteca</DialogTitle>
          <DialogDescription className="break-words">{item.angle}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Situação">
            <Select value={v.status} onValueChange={(s) => setV({ ...v, status: s as LibraryStatus })}>
              <SelectTrigger className="w-full" aria-label="Situação"><SelectValue /></SelectTrigger>
              <SelectContent>{LIBRARY_STATUSES.map((s) => <SelectItem key={s} value={s}>{LIBRARY_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Texto principal" optional><Textarea rows={4} maxLength={3000} value={v.primaryText} onChange={(e) => setV({ ...v, primaryText: e.target.value })} /></FormField>
          <FormField label="Título" optional><Input autoComplete="off" maxLength={200} value={v.headline} onChange={(e) => setV({ ...v, headline: e.target.value })} /></FormField>
          <FormField label="Descrição" optional><Input autoComplete="off" maxLength={500} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
