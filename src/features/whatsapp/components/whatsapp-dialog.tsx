"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, History, LoaderCircle, QrCode, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormAlert, FormField } from "@/components/app/form-field";
import { requestPairingCode, startWhatsapp, whatsappState } from "../actions";
import { HistoryPanel } from "./history-import";

const POLL_MS = 4000;
type Step = "starting" | "scan" | "history";

/** Leitura do QR Code, ou o código de 8 letras para quem está no próprio celular do número. */
function Pairing({ qr, status }: { qr: string | null; status: string }) {
  const [mode, setMode] = useState<"qr" | "codigo">("qr");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (mode === "codigo") {
    return (
      <div className="grid gap-3" aria-live="polite">
        <FormAlert>{error}</FormAlert>
        {code ? (
          <>
            <p className="text-center text-3xl font-semibold tracking-widest tabular" aria-label={`Código ${code.split("").join(" ")}`}>{code}</p>
            <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(code).then(() => toast.success("Código copiado."))}>
              <Copy aria-hidden="true" /> Copiar código
            </Button>
            <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted-foreground">
              <li>No WhatsApp, abra Aparelhos conectados.</li>
              <li>Toque em Conectar um aparelho.</li>
              <li>Toque em Conectar com número de telefone.</li>
              <li>Digite o código acima.</li>
            </ol>
          </>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const res = await requestPairingCode({ phone });
                if (!res.ok) return setError(Object.values(res.fieldErrors ?? {})[0]?.[0] ?? res.message ?? "Não foi possível gerar o código.");
                setCode((res.data as { code: string }).code);
              });
            }}
          >
            <FormField label="Número deste WhatsApp" hint="Com DDD. É o número que vai ser conectado.">
              <Input type="tel" inputMode="tel" name="telefone" autoComplete="off" placeholder="(48) 99999-0000…" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormField>
            <Button type="submit" disabled={pending || phone.replace(/\D/g, "").length < 10}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Gerar código
            </Button>
          </form>
        )}
        <Button variant="ghost" onClick={() => setMode("qr")}>Usar o QR Code</Button>
      </div>
    );
  }

  return (
    <div className="grid justify-items-center gap-3" aria-live="polite">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem gerada na hora pelo servidor do WhatsApp
        <img src={qr} alt="QR Code para conectar o WhatsApp" width={264} height={264} className="size-64 rounded-lg border bg-white p-2" />
      ) : (
        <p className="flex h-64 items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> {status === "FAILED" ? "O QR Code expirou. Gerando outro…" : "Gerando o QR Code…"}
        </p>
      )}
      {qr && <p className="max-w-prose text-center text-sm text-muted-foreground">No celular do número da Extend, abra o WhatsApp, toque em Aparelhos conectados e depois em Conectar um aparelho. O código muda sozinho.</p>}
      <Button variant="outline" className="w-full" onClick={() => setMode("codigo")}>
        <Smartphone aria-hidden="true" /> Está no celular do número? Conectar com código
      </Button>
    </div>
  );
}

/**
 * Conectar o WhatsApp da Extend (como no HubSystem): um clique, o QR Code aparece e, conectado, já oferece
 * compilar as conversas. Com mode="history", abre direto na compilação.
 */
export function WhatsappDialog({ mode, label, variant = "default", onOpenChange: onOpenChangeProp }: {
  mode: "connect" | "history"; label: string; variant?: "default" | "outline"; onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("starting");
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState("STARTING");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function begin() {
    setError(null);
    setQr(null);
    setStep("starting");
    startTransition(async () => {
      const res = await startWhatsapp({});
      if (!res.ok) return setError(res.message ?? "Não foi possível iniciar a conexão.");
      setStep("scan");
    });
  }

  function onOpenChange(v: boolean) {
    setOpen(v);
    onOpenChangeProp?.(v);
    if (v) {
      if (mode === "connect") begin();
      else setStep("history");
    } else {
      setError(null);
      router.refresh();
    }
  }

  // Enquanto o QR está na tela: ele muda sozinho e a conexão pode completar ou expirar.
  useEffect(() => {
    if (!open || step !== "scan") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let restarts = 0;
    const tick = async () => {
      const res = await whatsappState({}).catch(() => null);
      if (stopped) return;
      if (res?.ok) {
        const d = res.data as { status: string; qr: string | null; me: string | null };
        setStatus(d.status);
        setQr(d.qr);
        setError(null);
        if (d.status === "WORKING") {
          toast.success(d.me ? `WhatsApp ${d.me} conectado.` : "WhatsApp conectado.");
          setStep("history");
          router.refresh();
          return;
        }
        // O QR expirou sem leitura: gera outro sozinho (até 3 vezes).
        if ((d.status === "FAILED" || d.status === "STOPPED") && restarts < 3) {
          restarts++;
          await startWhatsapp({}).catch(() => null);
        }
      } else if (res) {
        setError(res.message ?? "Não foi possível falar com o servidor do WhatsApp.");
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [open, step, router]);

  const title = step === "history" ? "Compilar conversas" : "Conectar o WhatsApp da Extend";
  const description =
    step === "history"
      ? "Traz as conversas e os grupos que já estão no WhatsApp da Extend para responder aqui e transformar em lead."
      : "Leia o QR Code com o celular do número da Extend. As mensagens passam a chegar no Atendimento.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant}>{mode === "connect" ? <QrCode aria-hidden="true" /> : <History aria-hidden="true" />} {label}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {step === "starting" && (
          error ? (
            <div className="grid gap-3">
              <FormAlert>{error}</FormAlert>
              <Button variant="outline" onClick={begin} disabled={pending}>
                {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Tentar de novo
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Preparando a conexão…
            </p>
          )
        )}
        {step === "scan" && (
          <div className="grid gap-3">
            <FormAlert>{error}</FormAlert>
            <Pairing qr={qr} status={status} />
          </div>
        )}
        {step === "history" && open && <HistoryPanel onDone={() => onOpenChange(false)} onRelink={() => { setQr(null); setStep("scan"); }} />}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Aviso para compilar as conversas. Some quando a compilação começa, mas não enquanto o diálogo dele está aberto
 * (senão o andamento sumiria da tela no meio).
 */
export function CompileBanner({ show }: { show: boolean }) {
  const [open, setOpen] = useState(false);
  if (!show && !open) return null;
  return (
    <div role="region" aria-label="Trazer conversas antigas" className="grid justify-items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-sm">
      <p><strong className="font-semibold">Compile as conversas</strong> para trazer o histórico do WhatsApp da Extend, com os nomes dos contatos e os grupos dos clientes.</p>
      <WhatsappDialog mode="history" label="Trazer conversas e grupos" variant="outline" onOpenChange={setOpen} />
    </div>
  );
}
