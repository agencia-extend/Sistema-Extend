import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "Pedir novo criativo" a partir de um anúncio (RF-CRI-08): abre o pedido já preenchido com o que vem do anúncio. */
export function RequestFromAdLink({ adId, adName, className }: { adId: string; adName: string; className?: string }) {
  return (
    <Link href={`/criativos/novo?anuncio=${adId}`} aria-label={`Pedir novo criativo a partir de ${adName}`}
      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-7 w-fit", className)}>
      <Sparkles aria-hidden="true" /> Pedir novo criativo
    </Link>
  );
}
