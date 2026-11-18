"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MEDIA_ACCEPT } from "@/domain/whatsapp/media";

// Anexar arquivo e gravar áudio (adaptado do HubSystem, features/inbox/components/composer-tools.tsx).

export function AttachButton({ disabled, onPick }: { disabled?: boolean; onPick: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={MEDIA_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
      <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label="Anexar foto, vídeo ou documento" onClick={() => input.current?.click()}>
        <Paperclip aria-hidden="true" />
      </Button>
    </>
  );
}

/** Formatos na ordem de preferência; o servidor do WhatsApp converte para mensagem de voz. */
const RECORD_TYPES = ["audio/ogg;codecs=opus", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
const MAX_SECONDS = 300;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function AudioRecorder({ disabled, onRecorded, onRecording }: { disabled?: boolean; onRecorded: (blob: Blob, mime: string) => void; onRecording?: (on: boolean) => void }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const discard = useRef(false);
  const onDone = useRef(onRecorded);
  const onRec = useRef(onRecording);
  const recording = seconds !== null;

  useEffect(() => {
    onDone.current = onRecorded;
    onRec.current = onRecording;
  }, [onRecorded, onRecording]);

  useEffect(() => {
    onRec.current?.(recording);
  }, [recording]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s !== null && s + 1 >= MAX_SECONDS) recorder.current?.stop();
        return s === null ? s : s + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]);

  // Sair da conversa no meio da gravação desliga o microfone sem enviar nada.
  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
    [],
  );

  async function start() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) return void toast.error("Este navegador não grava áudio. Envie um arquivo de áudio pelo clipe.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return void toast.error("Sem acesso ao microfone. Libere o microfone para este site nas permissões do navegador.");
    }
    const mimeType = RECORD_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    discard.current = false;
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setSeconds(null);
      if (discard.current || !chunks.length) return;
      const mime = rec.mimeType || mimeType || "audio/webm";
      onDone.current(new Blob(chunks, { type: mime }), mime);
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
  }

  if (!recording) {
    return (
      <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label="Gravar áudio" onClick={start}>
        <Mic aria-hidden="true" />
      </Button>
    );
  }
  return (
    <div className="flex flex-1 items-center justify-between gap-1 rounded-md bg-danger-soft pl-3 text-sm text-danger" role="status">
      <span className="tabular" aria-label={`Gravando: ${seconds} segundos`}>Gravando {clock(seconds)}</span>
      <span className="flex">
        <Button type="button" variant="ghost" size="icon" aria-label="Cancelar gravação" onClick={() => { discard.current = true; recorder.current?.stop(); }}>
          <X aria-hidden="true" />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Parar e enviar áudio" onClick={() => recorder.current?.stop()}>
          <Square className="fill-current" aria-hidden="true" />
        </Button>
      </span>
    </div>
  );
}
