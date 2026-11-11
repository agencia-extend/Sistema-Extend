"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/app/form-field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { deleteRole, duplicateRole } from "@/features/admin/actions";
import { handleResult } from "@/lib/action-feedback";

export function RoleMenu({ roleId, roleName, deletable }: { roleId: string; roleName: string; deletable: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${roleName} (cópia)`);
  const [pending, startTransition] = useTransition();

  const duplicate = () =>
    startTransition(async () => {
      const res = await duplicateRole({ roleId, name });
      if (handleResult(res) && res.ok && res.data) {
        setOpen(false);
        router.push(`/configuracoes/papeis/${(res.data as { id: string }).id}`);
      }
    });

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Copy aria-hidden="true" /> Duplicar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicar papel</DialogTitle>
            <DialogDescription>Cria um papel novo com as mesmas permissões de “{roleName}”.</DialogDescription>
          </DialogHeader>
          <FormField label="Nome do novo papel" required error={name.trim().length < 2 ? "Dê um nome ao papel." : undefined}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={duplicate} disabled={pending || name.trim().length < 2}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {deletable && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost">
              <Trash2 aria-hidden="true" /> Excluir
            </Button>
          }
          title={`Excluir o papel “${roleName}”?`}
          description="Só é possível excluir um papel que ninguém usa. Esta ação não pode ser desfeita."
          confirmLabel="Excluir papel"
          onConfirm={async () => {
            const res = await deleteRole({ roleId });
            if (handleResult(res)) router.push("/configuracoes/papeis");
            return res.ok;
          }}
        />
      )}
    </>
  );
}
