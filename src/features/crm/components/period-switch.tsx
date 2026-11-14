"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIODS, type PeriodKey } from "@/domain/crm";

export function PeriodSwitch({ value }: { value: PeriodKey }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const q = new URLSearchParams(sp);
        q.set("periodo", v);
        router.push(`${path}?${q}`);
      }}
    >
      <SelectTrigger className="w-full sm:w-48" aria-label="Período"><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(PERIODS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
