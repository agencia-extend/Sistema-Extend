"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { clientCode } from "@/domain/clients";

export function ClientPicker({ clients, value }: { clients: { id: string; name: string; code: number }[]; value: string }) {
  const router = useRouter();
  return (
    <FormField label="Cliente" required>
      <Select value={value} onValueChange={(id) => router.replace(`/criativos/novo?cliente=${id}`, { scroll: false })}>
        <SelectTrigger className="w-full sm:w-96" aria-label="Cliente"><SelectValue placeholder="Escolha o cliente…" /></SelectTrigger>
        <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{clientCode(c.code)} · {c.name}</SelectItem>)}</SelectContent>
      </Select>
    </FormField>
  );
}
