"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "todos";

/** Filtro por cliente: sem cliente, aparecem também as datas nacionais. */
export function CalendarFilter({ clients, value, month }: { clients: { id: string; name: string }[]; value: string; month: string }) {
  const router = useRouter();
  return (
    <div className="grid gap-1.5">
      <label htmlFor="mk-cliente" className="text-sm font-medium">Cliente</label>
      <Select
        value={value || ALL}
        onValueChange={(id) => {
          const q = new URLSearchParams({ de: month.slice(0, 7) });
          if (id !== ALL) q.set("cliente", id);
          router.replace(`/calendario-marketing?${q}`, { scroll: false });
        }}
      >
        <SelectTrigger id="mk-cliente" className="w-full sm:w-80"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos (com as datas nacionais)</SelectItem>
          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
