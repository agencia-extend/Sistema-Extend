"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, History, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormAlert } from "@/components/app/form-field";
import { isActiveImport, type ImportJob } from "@/domain/whatsapp/history";
import { cancelHistoryImport, continueHistoryImport, getHistoryState, startHistoryImport } from "../history-actions";
import { relinkWhatsapp } from "../actions";

const POLL_WAIT_MS = 10_000;
const n = (v: number) => v.toLocaleString("pt-BR");
const plural = (v: number, one: string, many: string) => `${n(v)} ${v === 1 ? one : many}`;

function Summary({ job }: { job: ImportJob }) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      {([["Conversas", job.contacts_done], ["Grupos", job.groups_done], ["Mensagens", job.messages_done]] as const).map(([label, value]) => (
        <div key={label} className="flex flex-col-reverse rounded-lg bg-muted/50 px-1 py-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-lg font-semibold tabular">{n(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Traz as conversas e os grupos do aparelho para o Atendimento. Logo depois do QR Code e a qualquer momento depois.
 * onRelink: o número precisa ler o QR Code de novo (foi conectado sem guardar o histórico).
 */
export function HistoryPanel({ onDone, onRelink }: { onDone: () => void; onRelink?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<{ connected: boolean; storeOn: boolean } | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState(true);
  const [groups, setGroups] = useState(true);
  const [pending, startTransition] = useTransition();
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void getHistoryState({}).then((res) => {
      if (!alive.current) return;
      if (!res.ok) return setError(res.message ?? "Não foi possível falar com o servidor do WhatsApp.");
      setState({ connected: res.data.connected, storeOn: res.data.storeOn });
      setJob(res.data.job);
    });
    return () => {
      alive.current = false;
    };
  }, []);

  const jobId = isActiveImport(job) ? job!.id : null;

  // Cada chamada trabalha um pouco e devolve o andamento. Fechar a tela não interrompe: o servidor continua.
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const res = await continueHistoryImport({ jobId }).catch(() => null);
      if (stopped) return;
      if (res?.ok) {
        setJob(res.data);
        router.refresh();
        if (!isActiveImport(res.data)) {
          if (res.data.status === "concluida") toast.success("Conversas compiladas.");
          return;
        }
        timer = setTimeout(tick, res.data.status === "aguardando" ? POLL_WAIT_MS : 300);
      } else {
        timer = setTimeout(tick, POLL_WAIT_MS);
      }
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId, router]);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await startHistoryImport({ contacts, groups });
      if (!res.ok) return setError(Object.values(res.fieldErrors ?? {})[0]?.[0] ?? res.message ?? "Não foi possível começar a compilação.");
      setJob(res.data);
    });
  }

  function cancel() {
    if (!job) return;
    startTransition(async () => {
      const res = await cancelHistoryImport({ jobId: job.id });
      if (!res.ok) return setError(res.message ?? "Não foi possível interromper.");
      toast.success(res.message);
      const again = await getHistoryState({});
      if (again.ok) setJob(again.data.job);
      router.refresh();
    });
  }

  function relink() {
    setError(null);
    startTransition(async () => {
      const res = await relinkWhatsapp({});
      if (!res.ok) return setError(res.message ?? "Não foi possível preparar o QR Code.");
      onRelink?.();
    });
  }

  if (!state) {
    return error ? <FormAlert>{error}</FormAlert> : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Conferindo a conexão…
      </p>
    );
  }

  if (!state.connected) return <FormAlert>O WhatsApp não está conectado agora. Conecte pelo QR Code para compilar as conversas.</FormAlert>;

  if (!state.storeOn && !jobId) {
    return (
      <div className="grid gap-3">
        <FormAlert>{error}</FormAlert>
        <p className="text-sm text-muted-foreground">O WhatsApp só envia o histórico no momento da conexão, e este número foi conectado sem guardar o histórico. Conecte de novo para trazer tudo. As conversas que já estão aqui continuam, e o número fica alguns instantes sem receber.</p>
        <Button disabled={pending || !onRelink} onClick={relink}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Conectar de novo e trazer tudo
        </Button>
      </div>
    );
  }

  if (jobId && job) {
    return (
      <div className="grid gap-3" aria-live="polite">
        <FormAlert>{error}</FormAlert>
        <p className="flex items-center gap-2 text-sm font-medium">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {job.status === "aguardando" ? "Esperando o aparelho enviar o resto do histórico…" : "Compilando as conversas…"}
        </p>
        <Summary job={job} />
        <p className="text-sm text-muted-foreground">{job.last_error ?? "Pode fechar esta tela: a compilação continua sozinha e avisa quando terminar. O aparelho envia o histórico aos poucos, o que pode levar alguns minutos. Mantenha o celular com internet."}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={cancel}>Interromper</Button>
          <Button variant="outline" onClick={onDone}>Fechar</Button>
        </div>
      </div>
    );
  }

  const finished = job?.status === "concluida";
  return (
    <div className="grid gap-3">
      <FormAlert>{error}</FormAlert>
      {finished && job && (
        <div className="grid gap-2" role="status">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Última compilação concluída
          </p>
          <Summary job={job} />
          {job.skipped > 0 && <p className="text-sm text-muted-foreground">{plural(job.skipped, "conversa ficou", "conversas ficaram")} de fora: o WhatsApp não informou o telefone ou não entregou as mensagens. Compilar de novo tenta outra vez.</p>}
          {job.contacts_done + job.groups_done === 0 && <p className="text-sm text-muted-foreground">O aparelho não enviou conversas. Confira se ele estava com internet logo depois de conectar.</p>}
        </div>
      )}
      {job?.status === "erro" && job.last_error && <FormAlert>{job.last_error}</FormAlert>}
      <fieldset className="grid gap-1">
        <legend className="mb-1 text-sm font-medium">O que trazer</legend>
        <label className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm">
          <Checkbox checked={contacts} onCheckedChange={(v) => setContacts(v === true)} /> Conversas individuais
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm">
          <Checkbox checked={groups} onCheckedChange={(v) => setGroups(v === true)} /> Grupos
        </label>
      </fieldset>
      <p className="text-sm text-muted-foreground">Vêm até 500 mensagens recentes de cada conversa. Fotos, vídeos e áudios antigos aparecem como aviso, sem o arquivo. Conversas paradas há mais de 30 dias entram encerradas. Quem tem acesso ao Atendimento passa a ver o que for trazido.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onDone}>Agora não</Button>
        <Button disabled={pending || (!contacts && !groups)} onClick={start}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <History aria-hidden="true" />} {finished ? "Compilar de novo" : "Compilar conversas"}
        </Button>
      </div>
    </div>
  );
}
