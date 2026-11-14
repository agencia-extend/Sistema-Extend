"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

const OPTIONS = [
  ["light", "Claro", Sun],
  ["dark", "Escuro", Moon],
  ["system", "Automático", Laptop],
] as const;

/** Escolha de tema (claro, escuro ou o do aparelho) em botões compactos. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const current = hydrated ? (theme ?? "system") : "system";
  return (
    <div role="radiogroup" aria-label="Tema" className={cn("inline-flex rounded-full border bg-card/70 p-1 backdrop-blur", className)}>
      {OPTIONS.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            current === value && "bg-background text-foreground shadow-sm",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
