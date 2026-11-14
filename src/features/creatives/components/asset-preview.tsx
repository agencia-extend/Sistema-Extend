import { ExternalLink, FileText } from "lucide-react";
import { assetPreview, drivePreview } from "@/domain/creatives";

/** Prévia de um arquivo da versão: imagem, vídeo, player do Drive ou link. */
export function AssetPreview({ name, url, mimeType }: { name: string; url: string | null; mimeType: string | null }) {
  if (!url) return <span className="text-sm text-muted-foreground">{name} (arquivo indisponível)</span>;
  const kind = assetPreview(mimeType, url);
  if (kind === "imagem") {
    // eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do armazenamento privado
    return <img src={url} alt={name} className="max-h-[480px] w-auto max-w-full rounded-lg border" loading="lazy" />;
  }
  if (kind === "video") return <video controls preload="metadata" src={url} className="max-h-[480px] w-full rounded-lg border bg-black" aria-label={name} />;
  if (kind === "drive") {
    const src = drivePreview(url)!;
    return (
      <div className="grid gap-1">
        <iframe src={src} title={name} allow="autoplay" className="aspect-video w-full rounded-lg border" loading="lazy" />
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="size-3.5" aria-hidden="true" /> Abrir no Drive</a>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-muted">
      {mimeType ? <FileText className="size-4" aria-hidden="true" /> : <ExternalLink className="size-4" aria-hidden="true" />} {name}
    </a>
  );
}
