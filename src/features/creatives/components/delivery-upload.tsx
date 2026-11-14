"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { LoaderCircle, Paperclip, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { createClient } from "@/lib/supabase/client";
import { addDelivery } from "@/features/creatives/actions";
import { handleResult } from "@/lib/action-feedback";
import { useHydrated } from "@/hooks/use-hydrated";

const MAX = 10 * 1024 * 1024;
const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").slice(-80);

/** Enviar uma nova versão: arquivos (até 10 MB, vão direto para o armazenamento) e/ou links do Drive. */
export function DeliveryUpload({ taskId, nextVersion }: { taskId: string; nextVersion: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Antes de a página ficar interativa, o arquivo escolhido se perderia.
  const hydrated = useHydrated();

  const send = () => {
    setError(null);
    const urls = links.map((l) => l.trim()).filter(Boolean);
    if (!files.length && !urls.length) return void setError("Envie ao menos um arquivo ou cole um link do Drive.");
    if (urls.some((u) => !/^https?:\/\//.test(u))) return void setError("Os links precisam começar com https://");
    const big = files.find((f) => f.size > MAX);
    if (big) return void setError(`${big.name} tem mais de 10 MB. Coloque no Drive e cole o link.`);
    start(async () => {
      const supabase = createClient();
      const assets: { kind: "arquivo" | "link"; name: string; storagePath?: string; url?: string; mimeType?: string; sizeBytes?: number }[] = [];
      for (const f of files) {
        const path = `tarefas/${taskId}/entregas/${crypto.randomUUID()}-${safe(f.name)}`;
        const up = await supabase.storage.from("anexos").upload(path, f, { contentType: f.type || "application/octet-stream" });
        if (up.error) {
          console.error("[entrega] envio do arquivo", up.error.message);
          return void setError(`Não foi possível enviar ${f.name}. Verifique a conexão e tente de novo.`);
        }
        assets.push({ kind: "arquivo", name: f.name.slice(0, 200), storagePath: path, mimeType: f.type || undefined, sizeBytes: f.size });
      }
      for (const u of urls) assets.push({ kind: "link", name: /drive\.google/.test(u) ? "Arquivo no Drive" : "Link", url: u });
      const res = await addDelivery({ taskId, note, assets });
      if (!res.ok) {
        const paths = assets.map((a) => a.storagePath).filter((p): p is string => Boolean(p));
        if (paths.length) await supabase.storage.from("anexos").remove(paths);
        return void setError(res.message);
      }
      handleResult(res);
      setFiles([]);
      setLinks([""]);
      setNote("");
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="nova-versao" className="grid gap-3 rounded-xl border border-dashed bg-surface p-4">
      <h3 id="nova-versao" className="text-sm font-semibold">Enviar a versão v{nextVersion}</h3>
      <FormAlert>{error}</FormAlert>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" multiple hidden aria-label="Arquivos da versão" accept="image/*,video/*,application/pdf"
          onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
        <Button type="button" variant="outline" size="sm" disabled={!hydrated} onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" /> Escolher arquivos</Button>
        {files.map((f, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
            <Paperclip className="size-3.5" aria-hidden="true" /> {f.name}
            <button type="button" aria-label={`Tirar ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="size-3.5" /></button>
          </span>
        ))}
      </div>
      {links.map((l, i) => (
        <Input key={i} type="url" inputMode="url" spellCheck={false} autoComplete="off" aria-label={`Link ${i + 1} da versão`} placeholder="Ou cole o link do Drive (vídeos grandes)…" value={l}
          onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
      {links.length < 5 && <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setLinks([...links, ""])}><Plus aria-hidden="true" /> Outro link</Button>}
      <FormField label="Recado para quem pediu" optional>
        <Textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <div><Button onClick={send} disabled={pending || !hydrated}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Enviando…" : `Enviar v${nextVersion}`}</Button></div>
    </section>
  );
}
