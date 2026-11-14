import { parseRich, type Inline } from "@/domain/proposals";

const line = (parts: Inline[], key: number) => (
  <span key={key}>{parts.map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))}</span>
);

/** Texto simples com parágrafos, listas com "- " e **negrito** (mesma regra das propostas). */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {parseRich(text).map((n, i) =>
        n.kind === "ul" ? (
          <ul key={i} className="mb-3 list-disc space-y-1 pl-5 last:mb-0">
            {n.items.map((it, j) => <li key={j}>{line(it, j)}</li>)}
          </ul>
        ) : (
          <p key={i} className="mb-3 last:mb-0">
            {n.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line(l, j)}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
