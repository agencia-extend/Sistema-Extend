"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { LoaderCircle, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/app/form-field";
import { assignTraining } from "@/features/trainings/actions";
import { handleResult } from "@/lib/action-feedback";

type Person = { id: string; name: string; jobTitle: string | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Escolher quem deve fazer o treinamento e até quando. Quem recebe é avisado. */
export function AssignDialog({ trainingId, people, assigned, published }: { trainingId: string; people: Person[]; assigned: string[]; published: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dueOn, setDueOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inList = useMemo(() => new Set(assigned), [assigned]);
  const shown = useMemo(() => people.filter((p) => !q || norm(`${p.name} ${p.jobTitle ?? ""}`).includes(norm(q))), [people, q]);

  const toggle = (id: string, on: boolean) => {
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    setPicked(next);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await assignTraining({ trainingId, profileIds: [...picked], dueOn: dueOn || null });
      if (!res.ok) return setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setPicked(new Set()); setQ(""); setDueOn(""); setError(null); } }}>
      <DialogTrigger asChild>
        <Button><UserPlus aria-hidden="true" /> Atribuir a pessoas</Button>
      </DialogTrigger>
      <DialogContent className="grid max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atribuir treinamento</DialogTitle>
          <DialogDescription>
            {published ? "Quem você escolher recebe um aviso no sistema e no celular." : "O treinamento ainda é rascunho: as pessoas são avisadas quando você publicar."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
          <FormAlert>{error}</FormAlert>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input type="search" aria-label="Buscar pessoa" placeholder="Buscar pessoa…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ul className="min-h-0 divide-y overflow-y-auto overscroll-contain rounded-lg border">
            {shown.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Ninguém com esse nome.</li>}
            {shown.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <Checkbox checked={picked.has(p.id)} onCheckedChange={(c) => toggle(p.id, c === true)} />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    {p.jobTitle && <span className="truncate text-xs text-muted-foreground">{p.jobTitle}</span>}
                  </span>
                  {inList.has(p.id) && <span className="shrink-0 text-xs text-muted-foreground">já na lista</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-3">
          <FormField label="Concluir até" optional hint="Sem data, fica como pendência sem prazo. Para quem já está na lista, só muda o prazo.">
            <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button onClick={save} disabled={pending || picked.size === 0}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Atribuir{picked.size > 0 ? ` (${picked.size})` : ""}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
