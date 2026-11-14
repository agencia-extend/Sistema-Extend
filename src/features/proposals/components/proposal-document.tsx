import { Fragment } from "react";
import { RECURRENCE_LABEL, type Inline, type ProposalDoc, type RichNode } from "@/domain/proposals";
import { formatBRL } from "@/domain/shared/money";

// A proposta como "papel": mesmas seções, mesma ordem e mesmos valores do PDF (pdf/proposal-pdf.tsx).
// Cores fixas da marca (não seguem o tema escuro), porque é o documento que o cliente recebe.

function Inlines({ xs }: { xs: Inline[] }) {
  return <>{xs.map((x, i) => (x.bold ? <strong key={i} className="font-semibold text-[#0b1424]">{x.text}</strong> : <Fragment key={i}>{x.text}</Fragment>))}</>;
}

function Rich({ nodes }: { nodes: RichNode[] }) {
  return (
    <div className="grid gap-3">
      {nodes.map((n, i) =>
        n.kind === "p" ? (
          <p key={i} className="break-words">
            {n.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}<Inlines xs={l} /></Fragment>)}
          </p>
        ) : (
          <ul key={i} className="grid gap-1.5">
            {n.items.map((l, j) => (
              <li key={j} className="flex gap-2.5 break-words"><span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[#1d8ae6]" aria-hidden="true" /><span><Inlines xs={l} /></span></li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** standalone: página pública (capa é o h1). Dentro do sistema a página já tem h1, então a capa vira h2. */
export function ProposalDocument({ doc, images = {}, logoSrc = "/brand/logo.png", standalone = false }: { doc: ProposalDoc; images?: Record<string, string>; logoSrc?: string; standalone?: boolean }) {
  const t = doc.totals;
  const Title = standalone ? "h1" : "h2";
  const Section = standalone ? "h2" : "h3";
  return (
    <article className="mx-auto w-full max-w-[794px] overflow-hidden rounded-lg bg-white text-[15px] leading-relaxed text-[#334155] shadow-sm ring-1 ring-black/10 [color-scheme:light]" lang="pt-BR">
      {doc.sections.map((s) => {
        if (s.type === "capa") {
          return (
            <header key={s.id} className="grid gap-8 px-6 pt-8 pb-8 sm:px-12 sm:pt-12">
              {/* eslint-disable-next-line @next/next/no-img-element -- mesma imagem do PDF, sem otimização */}
              <img src={logoSrc} alt="Agência Extend" width={168} height={32} className="h-8 w-auto self-start" />
              <div className="grid gap-3">
                <Title className="font-heading text-[2rem] leading-tight font-bold text-balance break-words text-[#0b1424] sm:text-[2.5rem]">{s.title}</Title>
                <div className="text-lg"><Rich nodes={s.nodes} /></div>
              </div>
              <dl className="grid grid-cols-3 gap-3 border-t border-[#e2e8f0] pt-4 text-sm">
                <div><dt className="text-[#64748b]">Proposta nº</dt><dd className="font-semibold text-[#0b1424] tabular">{doc.number}</dd></div>
                <div><dt className="text-[#64748b]">Data</dt><dd className="font-semibold text-[#0b1424] tabular">{doc.issuedAt}</dd></div>
                <div><dt className="text-[#64748b]">Válida até</dt><dd className="font-semibold text-[#0b1424] tabular">{doc.validUntil}</dd></div>
              </dl>
              <span className="gold-rule -mx-6 block h-1 sm:-mx-12" aria-hidden="true" />
            </header>
          );
        }
        return (
          <section key={s.id} className="grid gap-3 px-6 py-6 sm:px-12" aria-label={s.title || undefined}>
            {s.title && <Section className="font-heading text-xl font-semibold text-balance text-[#1d8ae6]">{s.title}</Section>}
            {s.type === "imagem" ? (
              <figure className="grid gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagem do modelo vem de URL assinada */}
                {s.imagePath && images[s.imagePath] && <img src={images[s.imagePath]} alt={s.title || "Imagem da proposta"} loading="lazy" decoding="async" className="w-full rounded-md" />}
                {s.nodes.length > 0 && <figcaption className="text-sm text-[#64748b]"><Rich nodes={s.nodes} /></figcaption>}
              </figure>
            ) : (
              s.nodes.length > 0 && <Rich nodes={s.nodes} />
            )}
            {s.type === "servicos" && (
              <ul className="grid gap-3">
                {doc.lines.map((l, i) => (
                  <li key={i} className="rounded-md border border-[#e2e8f0] px-4 py-3">
                    <span className="block font-semibold text-[#0b1424]">{l.name}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</span>
                    {l.description && <span className="block text-sm break-words">{l.description}</span>}
                  </li>
                ))}
              </ul>
            )}
            {s.type === "investimento" && (
              <div className="grid gap-3">
                <ul className="grid gap-2 sm:hidden">
                  {doc.lines.map((l, i) => (
                    <li key={i} className="grid gap-0.5 border-b border-[#e2e8f0] pb-2 text-sm">
                      <span className="flex justify-between gap-3"><span className="font-semibold text-[#0b1424]">{l.name}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</span><span className="font-semibold whitespace-nowrap text-[#0b1424] tabular">{formatBRL(l.totalCents)}</span></span>
                      <span className="text-[#64748b]">{RECURRENCE_LABEL[l.recurrence]} · {formatBRL(l.priceCents * l.quantity)}{l.discountCents ? ` − ${formatBRL(l.discountCents)} de desconto` : ""}</span>
                    </li>
                  ))}
                </ul>
                <div className="hidden sm:block">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Valores da proposta</caption>
                    <thead>
                      <tr className="border-b-2 border-[#1d8ae6] text-left text-[#0b1424]">
                        <th scope="col" className="py-2 pr-2 font-semibold">Serviço</th>
                        <th scope="col" className="py-2 pr-2 font-semibold">Cobrança</th>
                        <th scope="col" className="py-2 pr-2 text-right font-semibold">Valor</th>
                        <th scope="col" className="py-2 pr-2 text-right font-semibold">Desconto</th>
                        <th scope="col" className="py-2 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.lines.map((l, i) => (
                        <tr key={i} className="border-b border-[#e2e8f0]">
                          <td className="py-2 pr-2">{l.name}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</td>
                          <td className="py-2 pr-2">{RECURRENCE_LABEL[l.recurrence]}</td>
                          <td className="py-2 pr-2 text-right whitespace-nowrap tabular">{formatBRL(l.priceCents * l.quantity)}</td>
                          <td className="py-2 pr-2 text-right whitespace-nowrap tabular">{l.discountCents ? `− ${formatBRL(l.discountCents)}` : "—"}</td>
                          <td className="py-2 text-right font-semibold whitespace-nowrap text-[#0b1424] tabular">{formatBRL(l.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <dl className="grid justify-end gap-1 text-right">
                  {t.discountCents > 0 && <div className="flex justify-end gap-4 text-sm"><dt>Desconto total</dt><dd className="tabular">− {formatBRL(t.discountCents)}</dd></div>}
                  {t.monthlyCents > 0 && <div className="flex items-baseline justify-end gap-4"><dt>Total mensal</dt><dd className="font-heading text-2xl font-bold text-[#0b1424] tabular">{formatBRL(t.monthlyCents)}</dd></div>}
                  {t.oneTimeCents > 0 && <div className="flex items-baseline justify-end gap-4"><dt>Valor único</dt><dd className="font-heading text-xl font-bold text-[#0b1424] tabular">{formatBRL(t.oneTimeCents)}</dd></div>}
                </dl>
              </div>
            )}
          </section>
        );
      })}
      <footer className="mt-4 border-t border-[#e2e8f0] px-6 py-4 text-xs text-[#64748b] sm:px-12">Agência Extend · Proposta nº {doc.number} · válida até {doc.validUntil}</footer>
    </article>
  );
}
