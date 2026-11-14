import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { RECURRENCE_LABEL, type Inline, type ProposalDoc, type RichNode } from "@/domain/proposals";
import { formatBRL } from "@/domain/shared/money";

// PDF da proposta (RF-PRO-04). Mesmo documento da prévia (components/proposal-document.tsx).
const dir = path.join(process.cwd(), "src/features/proposals/pdf/fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(dir, "inter-400.woff"), fontWeight: 400 },
    { src: path.join(dir, "inter-600.woff"), fontWeight: 600 },
    { src: path.join(dir, "inter-700.woff"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Outfit",
  fonts: [
    { src: path.join(dir, "outfit-600.woff"), fontWeight: 600 },
    { src: path.join(dir, "outfit-700.woff"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);
// Lido do disco como buffer (caminho do Windows seria tratado como URL).
const LOGO = { data: fs.readFileSync(path.join(process.cwd(), "public/brand/logo.png")), format: "png" as const };

const INK = "#0b1424";
const TEXT = "#334155";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const BLUE = "#1d8ae6";

const s = StyleSheet.create({
  // lineHeight fica no corpo, não na página: na página ele some com o rodapé fixo (bug do react-pdf).
  page: { fontFamily: "Inter", fontSize: 10.5, color: TEXT, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 48 },
  body: { lineHeight: 1.55 },
  cover: { marginBottom: 18 },
  logo: { width: 126, height: 24, objectFit: "contain", marginBottom: 28 },
  h1: { fontFamily: "Outfit", fontWeight: 700, fontSize: 28, lineHeight: 1.2, color: INK, marginBottom: 8 },
  coverText: { fontSize: 13 },
  meta: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10, marginTop: 22 },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: 9, color: MUTED },
  metaValue: { fontWeight: 600, color: INK },
  gold: { height: 3, marginTop: 18, flexDirection: "row" },
  section: { marginTop: 16 },
  h2: { fontFamily: "Outfit", fontWeight: 600, fontSize: 15, color: BLUE, marginBottom: 6 },
  p: { marginBottom: 6 },
  li: { flexDirection: "row", marginBottom: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE, marginTop: 6, marginRight: 8 },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 10, marginTop: 6 },
  bold: { fontWeight: 600, color: INK },
  th: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: BLUE,
    paddingBottom: 4,
    marginTop: 6,
    fontWeight: 600,
    color: INK,
    fontSize: 9.5,
  },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5, fontSize: 9.5 },
  cName: { flex: 3 },
  cRec: { flex: 1.4 },
  cNum: { flex: 1.5, textAlign: "right" },
  totals: { marginTop: 10, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  totalLabel: { marginRight: 12 },
  totalBig: { fontFamily: "Outfit", fontWeight: 700, fontSize: 17, color: INK },
  image: { width: "100%", borderRadius: 4, marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
  },
});

function Inl({ xs }: { xs: Inline[] }) {
  return (
    <>
      {xs.map((x, i) =>
        x.bold ? (
          <Text key={i} style={s.bold}>
            {x.text}
          </Text>
        ) : (
          <Text key={i}>{x.text}</Text>
        ),
      )}
    </>
  );
}

function Rich({ nodes, style }: { nodes: RichNode[]; style?: Style }) {
  return (
    <View>
      {nodes.map((n, i) =>
        n.kind === "p" ? (
          <Text key={i} style={[s.p, style ?? {}]}>
            {n.lines.map((l, j) => (
              <Text key={j}>
                {j > 0 ? "\n" : ""}
                <Inl xs={l} />
              </Text>
            ))}
          </Text>
        ) : (
          <View key={i} style={s.p}>
            {n.items.map((l, j) => (
              <View key={j} style={s.li} wrap={false}>
                <View style={s.dot} />
                <Text style={[{ flex: 1 }, style ?? {}]}>
                  <Inl xs={l} />
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}

function ProposalPdf({ doc, images }: { doc: ProposalDoc; images: Record<string, string> }) {
  const t = doc.totals;
  return (
    <Document title={`Proposta ${doc.number} — ${doc.clientName}`} author="Agência Extend" language="pt-BR">
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          {doc.sections.map((sec) => {
            if (sec.type === "capa") {
              return (
                <View key={sec.id} style={s.cover}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
                  <Image src={LOGO} style={s.logo} />
                  <Text style={s.h1}>{sec.title}</Text>
                  <Rich nodes={sec.nodes} style={s.coverText} />
                  <View style={s.meta}>
                    <View style={s.metaCell}>
                      <Text style={s.metaLabel}>Proposta nº</Text>
                      <Text style={s.metaValue}>{doc.number}</Text>
                    </View>
                    <View style={s.metaCell}>
                      <Text style={s.metaLabel}>Data</Text>
                      <Text style={s.metaValue}>{doc.issuedAt}</Text>
                    </View>
                    <View style={s.metaCell}>
                      <Text style={s.metaLabel}>Válida até</Text>
                      <Text style={s.metaValue}>{doc.validUntil}</Text>
                    </View>
                  </View>
                  <View style={s.gold}>
                    <View style={{ flex: 1, backgroundColor: "#FFB800" }} />
                    <View style={{ flex: 1, backgroundColor: "#F7931E" }} />
                  </View>
                </View>
              );
            }
            return (
              <View key={sec.id} style={s.section} wrap={!(sec.type === "investimento" && doc.lines.length <= 12)}>
                {sec.title ? (
                  <Text style={s.h2} minPresenceAhead={40}>
                    {sec.title}
                  </Text>
                ) : null}
                {sec.type === "imagem" ? (
                  <View>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
                    {sec.imagePath && images[sec.imagePath] ? (
                      <Image src={images[sec.imagePath]} style={s.image} />
                    ) : null}
                    {sec.nodes.length > 0 ? <Rich nodes={sec.nodes} style={{ color: MUTED, fontSize: 9.5 }} /> : null}
                  </View>
                ) : sec.nodes.length > 0 ? (
                  <Rich nodes={sec.nodes} />
                ) : null}
                {sec.type === "servicos" &&
                  doc.lines.map((l, i) => (
                    <View key={i} style={s.card} wrap={false}>
                      <Text style={s.bold}>
                        {l.name}
                        {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                      </Text>
                      {l.description ? <Text>{l.description}</Text> : null}
                    </View>
                  ))}
                {sec.type === "investimento" && (
                  <View>
                    <View style={s.th}>
                      <Text style={s.cName}>Serviço</Text>
                      <Text style={s.cRec}>Cobrança</Text>
                      <Text style={s.cNum}>Valor</Text>
                      <Text style={s.cNum}>Desconto</Text>
                      <Text style={s.cNum}>Total</Text>
                    </View>
                    {doc.lines.map((l, i) => (
                      <View key={i} style={s.tr} wrap={false}>
                        <Text style={s.cName}>
                          {l.name}
                          {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                        </Text>
                        <Text style={s.cRec}>{RECURRENCE_LABEL[l.recurrence]}</Text>
                        <Text style={s.cNum}>{formatBRL(l.priceCents * l.quantity)}</Text>
                        <Text style={s.cNum}>{l.discountCents ? `− ${formatBRL(l.discountCents)}` : "—"}</Text>
                        <Text style={[s.cNum, s.bold]}>{formatBRL(l.totalCents)}</Text>
                      </View>
                    ))}
                    <View style={s.totals} wrap={false}>
                      {t.discountCents > 0 ? (
                        <View style={s.totalRow}>
                          <Text style={s.totalLabel}>Desconto total</Text>
                          <Text>− {formatBRL(t.discountCents)}</Text>
                        </View>
                      ) : null}
                      {t.monthlyCents > 0 ? (
                        <View style={s.totalRow}>
                          <Text style={s.totalLabel}>Total mensal</Text>
                          <Text style={s.totalBig}>{formatBRL(t.monthlyCents)}</Text>
                        </View>
                      ) : null}
                      {t.oneTimeCents > 0 ? (
                        <View style={s.totalRow}>
                          <Text style={s.totalLabel}>Valor único</Text>
                          <Text style={s.totalBig}>{formatBRL(t.oneTimeCents)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Agência Extend · Proposta nº ${doc.number} · válida até ${doc.validUntil} · página ${pageNumber} de ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export async function renderProposalPdf(doc: ProposalDoc, images: Record<string, string> = {}): Promise<Buffer> {
  return renderToBuffer(<ProposalPdf doc={doc} images={images} />);
}
