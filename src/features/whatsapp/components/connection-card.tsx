"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, QrCode, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { disconnectWhatsapp, requestPairingCode, startWhatsapp, whatsappState } from "@/features/whatsapp/actions";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  WORKING: "Conectado",
  SCAN_QR_CODE: "Esperando a leitura do QR Code",
  STARTING: "Iniciando…",
  STOPPED: "Desconectado",
  FAILED: "Conexão caiu",
};

/** Conectar o número: inicia a sessão, mostra o QR Code (atualiza sozinho) e a situação. */
export function ConnectionCard({ initialStatus, me }: { initialStatus: string; me: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [qr, setQr] = useState<string | null>(null);
  const [who, setWho] = useState(me);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const waiting = status === "STARTING" || status === "SCAN_QR_CODE";

  const poll = useCallback(async () => {
    const res = await whatsappState({});
    if (!res.ok) return setError(res.message);
    setError(null);
    const d = res.data as { status: string; qr: string | null; me: string | null };
    setStatus((old) => {
      if (old !== "WORKING" && d.status === "WORKING") router.refresh();
      return d.status;
    });
    setQr(d.qr);
    setWho(d.me);
  }, [router]);

  useEffect(() => {
    if (!waiting) return;
    const first = setTimeout(poll, 300);
    const t = setInterval(poll, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [waiting, poll]);

  const bad = status === "FAILED" || status === "STOPPED";
  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 text-sm" role="status">
        <span className={cn("size-2 rounded-full", status === "WORKING" ? "bg-success" : bad ? "bg-danger" : "bg-warning")} aria-hidden="true" />
        <span className="font-medium">{LABEL[status] ?? status}</span>
        {status === "WORKING" && who && <span className="text-muted-foreground">· {who}</span>}
      </p>
      {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {status === "SCAN_QR_CODE" && (
        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code para conectar o WhatsApp" width={240} height={240} className="size-60 rounded-lg border bg-white p-2" />
          ) : (
            <span className="grid size-60 place-items-center rounded-lg border text-muted-foreground"><LoaderCircle className="animate-spin" aria-label="Gerando o QR Code" /></span>
          )}
          <div className="grid gap-3 text-sm">
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>No celular do número da Extend, abra o WhatsApp.</li>
              <li>Toque em <strong className="text-foreground">Aparelhos conectados › Conectar um aparelho</strong>.</li>
              <li>Aponte a câmera para o QR Code. Ele se renova sozinho.</li>
            </ol>
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const res = await requestPairingCode({ phone });
                  if (handleResult(res) && res.ok) setCode((res.data as { code: string }).code);
                });
              }}
            >
              <label htmlFor="wa-phone" className="font-medium">Ou conecte com o número</label>
              <div className="flex flex-wrap gap-2">
                <Input id="wa-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="48 99999-0000…" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-48" />
                <Button type="submit" variant="outline" disabled={pending || !phone.trim()}>Pedir código</Button>
              </div>
              {code && <p className="text-base">Digite no celular: <strong className="font-mono tracking-widest">{code}</strong></p>}
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status !== "WORKING" && (
          <Button disabled={pending || status === "STARTING"} onClick={() => run(async () => { if (handleResult(await startWhatsapp({}))) { setStatus("STARTING"); setCode(null); } })}>
            {pending || status === "STARTING" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <QrCode aria-hidden="true" />}
            {status === "SCAN_QR_CODE" ? "Gerar de novo" : "Conectar número"}
          </Button>
        )}
        {status === "WORKING" && (
          <ConfirmDialog
            trigger={<Button variant="ghost" className="text-danger"><Unplug aria-hidden="true" /> Desconectar</Button>}
            title="Desconectar o WhatsApp?"
            description="O número sai do servidor e os alertas e relatórios param de ir para os grupos até conectar de novo."
            confirmLabel="Desconectar"
            onConfirm={async () => { if (handleResult(await disconnectWhatsapp({}))) setStatus("STOPPED"); }}
          />
        )}
      </div>
    </div>
  );
}
