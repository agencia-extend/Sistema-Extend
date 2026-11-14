"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Troca o funil exibido (só aparece quando há mais de um). */
export function PipelineSwitch({ value, pipelines }: { value: string; pipelines: { id: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  if (pipelines.length < 2) return null;
  return (
    <Select
      value={value}
      onValueChange={(id) => {
        const q = new URLSearchParams(sp);
        q.set("funil", id);
        q.delete("etapa");
        router.push(`${path}?${q}`);
      }}
    >
      <SelectTrigger className="w-full sm:w-56" aria-label="Funil"><SelectValue /></SelectTrigger>
      <SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}
