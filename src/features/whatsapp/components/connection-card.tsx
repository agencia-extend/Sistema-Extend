"use client";

import { Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { disconnectWhatsapp } from "@/features/whatsapp/actions";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { WhatsappDialog } from "./whatsapp-dialog";

const LABEL: Record<string, string> = {
  WORKING: "Conectado",
  SCAN_QR_CODE: "Esperando a leitura do QR Code",
  STARTING: "Iniciando…",
  STOPPED: "Desconectado",
  FAILED: "Conexão caiu",
};

/** Situação do número e o que dá para fazer: conectar (QR Code), compilar as conversas, desconectar. */
export function ConnectionCard({ status, me, canDisconnect }: { status: string | null; me: string | null; canDisconnect: boolean }) {
  const router = useRouter();
  const connected = status === "WORKING";
  const bad = !status || status === "FAILED" || status === "STOPPED";
  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 text-sm" role="status">
        <span className={cn("size-2 rounded-full", connected ? "bg-success" : bad ? "bg-danger" : "bg-warning")} aria-hidden="true" />
        <span className="font-medium">{status ? (LABEL[status] ?? status) : "Ainda não conectado"}</span>
        {connected && me && <span className="text-muted-foreground">· {me}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {/* Mesmo lugar conectado ou não: ao ler o QR Code, o diálogo continua aberto e passa para a compilação. */}
        <WhatsappDialog
          mode={connected ? "history" : "connect"}
          label={connected ? "Compilar conversas" : status && status !== "STOPPED" ? "Gerar outro QR Code" : "Conectar WhatsApp"}
          variant={connected ? "outline" : "default"}
        />
        {connected && canDisconnect && (
              <ConfirmDialog
                trigger={<Button variant="ghost" className="text-danger"><Unplug aria-hidden="true" /> Desconectar</Button>}
                title="Desconectar o WhatsApp?"
                description="O número sai do servidor: o Atendimento para de receber e os alertas e relatórios param de ir para os grupos até conectar de novo. As conversas já guardadas continuam."
                confirmLabel="Desconectar"
                onConfirm={async () => { if (handleResult(await disconnectWhatsapp({}))) router.refresh(); }}
              />
        )}
      </div>
    </div>
  );
}
