"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** De quem são as tarefas no quadro: minhas, de todos ou de uma pessoa (para quem distribui as demandas). */
export function PersonPicker({ team, value }: { team: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <Select value={value} onValueChange={(v) => {
      const next = new URLSearchParams(sp.toString());
      if (v === "eu") next.delete("pessoa"); else next.set("pessoa", v);
      router.replace(`${pathname}?${next}`, { scroll: false });
    }}>
      <SelectTrigger className="w-full sm:w-64" aria-label="Tarefas de quem"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="eu">Minhas tarefas</SelectItem>
        <SelectItem value="todos">Todas as pessoas</SelectItem>
        {team.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
