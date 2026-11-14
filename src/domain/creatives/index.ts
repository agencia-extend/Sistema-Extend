/** Criativos (etapa 04): formatos, objetivos, etapas, biblioteca e mensagens prontas. */

export const CREATIVE_FORMATS = ["imagem", "video", "story", "carrossel", "reels"] as const;
export type CreativeFormat = (typeof CREATIVE_FORMATS)[number];
export const CREATIVE_FORMAT_LABEL: Record<CreativeFormat, string> = { imagem: "Imagem", video: "Vídeo", story: "Story", carrossel: "Carrossel", reels: "Reels" };

export const CREATIVE_OBJECTIVES = ["mensagens", "leads", "vendas", "trafego", "reconhecimento", "engajamento", "outro"] as const;
export type CreativeObjective = (typeof CREATIVE_OBJECTIVES)[number];
export const CREATIVE_OBJECTIVE_LABEL: Record<CreativeObjective, string> = {
  mensagens: "Mensagens (WhatsApp/Direct)",
  leads: "Cadastros (leads)",
  vendas: "Vendas",
  trafego: "Tráfego para o site",
  reconhecimento: "Reconhecimento",
  engajamento: "Engajamento",
  outro: "Outro",
};

/** Etapas do fluxo do criativo, na ordem do quadro. */
export const CREATIVE_STEPS = ["Solicitado", "Em produção", "Em revisão", "Ajustes solicitados", "Aprovação do cliente", "Aprovado", "Entregue", "No ar"] as const;
export type CreativeStep = (typeof CREATIVE_STEPS)[number];

export const LIBRARY_STATUSES = ["em_teste", "vencedor", "fadigado", "reprovado_meta", "arquivado"] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];
export const LIBRARY_STATUS_LABEL: Record<LibraryStatus, string> = {
  em_teste: "Em teste",
  vencedor: "Vencedor",
  fadigado: "Fadigado",
  reprovado_meta: "Reprovado pela Meta",
  arquivado: "Arquivado",
};
export const LIBRARY_STATUS_TONE: Record<LibraryStatus, string> = {
  em_teste: "bg-info-soft text-info",
  vencedor: "bg-success-soft text-success",
  fadigado: "bg-warning-soft text-warning",
  reprovado_meta: "bg-danger-soft text-danger",
  arquivado: "bg-neutral-soft text-neutral-status",
};

/** Que ações de revisão cabem na etapa atual (para quem pediu ou revisa). */
export function reviewActions(step: string | null): ("ajustes" | "cliente" | "aprovado" | "entregue" | "no_ar")[] {
  switch (step) {
    case "Em revisão":
      return ["ajustes", "cliente", "aprovado"];
    case "Aprovação do cliente":
      return ["ajustes", "aprovado"];
    case "Aprovado":
      return ["entregue", "no_ar"];
    case "Entregue":
      return ["no_ar"];
    default:
      return [];
  }
}

/** Link do WhatsApp com a mensagem para o cliente aprovar. */
export function whatsappApprovalLink(url: string, clientName: string, title: string): string {
  const text = `Olá! Aqui é da Agência Extend. O criativo "${title}" de ${clientName} está pronto para você aprovar: ${url}\nÉ só abrir, ver a peça e tocar em Aprovar ou Pedir alteração.`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export type LinkState = "aberto" | "usado" | "substituido" | "expirado";
export function linkState(l: { decidedAt: string | null; revokedAt: string | null; expiresAt: string }, now: Date = new Date()): LinkState {
  if (l.decidedAt) return "usado";
  if (l.revokedAt) return "substituido";
  return l.expiresAt < now.toISOString() ? "expirado" : "aberto";
}

/** Arquivo pode ser mostrado como imagem ou vídeo dentro da página. */
export function assetPreview(mime: string | null, url: string | null): "imagem" | "video" | "drive" | "arquivo" {
  if (mime?.startsWith("image/")) return "imagem";
  if (mime?.startsWith("video/")) return "video";
  if (url && /drive\.google\.com\/file\/d\//.test(url)) return "drive";
  return "arquivo";
}

/** Link do Drive para o player embutido. */
export function drivePreview(url: string): string | null {
  const m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
}
