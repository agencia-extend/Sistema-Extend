"use client";

import type { ReactNode } from "react";
import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Detalhes da conversa numa gaveta (celular e telas médias; nas largas ficam ao lado da conversa). */
export function ChatDetails({ name, children }: { name: string; children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Detalhes da conversa"><PanelRight aria-hidden="true" /></Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(22rem,92vw)] overflow-y-auto overscroll-contain">
        <SheetHeader>
          <SheetTitle className="truncate">{name}</SheetTitle>
          <SheetDescription>Responsável, etiquetas e lead do Comercial.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
