import { Fragment } from "react";

const URL_RE = /(https:\/\/[^\s<>"')]+[^\s<>"').,;:!?])/g;

function linkify(line: string) {
  return line.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline underline-offset-2 hover:no-underline">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** Texto da aula: parágrafos por linha em branco, quebras simples e links https clicáveis. */
export function LessonBody({ text }: { text: string }) {
  const paragraphs = text.trim().split(/\n\s*\n/);
  return (
    <div className="grid max-w-prose gap-4 text-[0.9375rem] leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i} className="wrap-break-word">
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {linkify(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
