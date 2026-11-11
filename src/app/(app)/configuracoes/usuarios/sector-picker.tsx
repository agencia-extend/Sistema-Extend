"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** Escolha de setores (vários). Define a visão do setor e o escopo "do meu setor". */
export function SectorPicker({
  sectors,
  value,
  onChange,
  disabled,
}: {
  sectors: { id: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((v) => v !== id));
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">Setores</legend>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {sectors.map((s) => (
          <div key={s.id} className="flex min-h-10 items-center gap-2">
            <Checkbox id={`setor-${s.id}`} checked={value.includes(s.id)} onCheckedChange={(v) => toggle(s.id, v === true)} />
            <Label htmlFor={`setor-${s.id}`} className="font-normal">
              {s.name}
            </Label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
