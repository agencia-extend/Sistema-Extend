import { cn } from "@/lib/utils";

/**
 * Marca animada da Extend para a entrada do sistema. O "ae" é revelado da esquerda
 * para a direita, um brilho atravessa a marca e linhas de luz se estendem a partir
 * dela — o nome da agência em movimento. Tudo em CSS (globals.css, .brand-motion);
 * com "reduzir movimento" ligado, a marca aparece parada.
 */
export function BrandMotion({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  return (
    <div className={cn("brand-motion", size === "sm" ? "brand-motion--sm" : "brand-motion--lg", className)} aria-hidden="true">
      <span className="brand-motion__glow" />
      <span className="brand-motion__mark">
        {/* eslint-disable-next-line @next/next/no-img-element -- a máscara do brilho usa o mesmo arquivo */}
        <img src="/brand/mark.png" alt="" width={220} height={72} />
        <span className="brand-motion__shine" />
      </span>
      <span className="brand-motion__rays">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
