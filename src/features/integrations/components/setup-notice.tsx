"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** O que falta configurar no servidor e o endereço de retorno para cadastrar na plataforma. */
export function SetupNotice({ missing, redirectUri, platform }: { missing: string[]; redirectUri: string; platform: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
      {missing.length > 0 ? (
        <p>
          <span className="font-medium">Ainda não dá para conectar.</span> Falta preencher no servidor:{" "}
          {missing.map((m, i) => (
            <span key={m}>
              <code className="rounded bg-background/70 px-1 py-0.5 text-xs" translate="no">{m}</code>
              {i < missing.length - 1 ? ", " : ""}
            </span>
          ))}
          . O passo a passo está em <span translate="no">docs/11-passo-a-passo-meta-google.md</span>.
        </p>
      ) : (
        <p>Configuração completa no servidor.</p>
      )}
      <div className="grid gap-1">
        <p className="text-muted-foreground">Endereço de retorno para cadastrar {platform}:</p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <code className="min-w-0 break-all rounded bg-background/70 px-2 py-1 text-xs" translate="no">{redirectUri}</code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(redirectUri).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
