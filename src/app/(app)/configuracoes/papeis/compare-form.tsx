"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CompareForm({ roles, a, b }: { roles: { id: string; name: string }[]; a?: string; b?: string }) {
  const router = useRouter();
  const [ra, setA] = useState(a ?? "");
  const [rb, setB] = useState(b ?? "");
  const pick = (value: string, set: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger className="w-full sm:w-56" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pick(ra, setA, "Primeiro papel")}
      {pick(rb, setB, "Segundo papel")}
      <Button variant="outline" disabled={!ra || !rb || ra === rb} onClick={() => router.push(`/configuracoes/papeis?a=${ra}&b=${rb}#comparar`)}>
        Comparar
      </Button>
    </div>
  );
}
