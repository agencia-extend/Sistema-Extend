import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { RESULT_LABEL } from "@/domain/ads";
import { reportTotals, reportValues, type ReportData } from "@/domain/ads/report";

// PDF do relatório de anúncios (RF-REL-05): mesmos números do texto do WhatsApp, com a marca da Extend.
const dir = path.join(process.cwd(), "src/features/proposals/pdf/fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(dir, "inter-400.woff"), fontWeight: 400 },
    { src: path.join(dir, "inter-600.woff"), fontWeight: 600 },
    { src: path.join(dir, "inter-700.woff"), fontWeight: 700 },
  ],
});
Font.register({ family: "Outfit", fonts: [{ src: path.join(dir, "outfit-600.woff"), fontWeight: 600 }, { src: path.join(dir, "outfit-700.woff"), fontWeight: 700 }] });
Font.registerHyphenationCallback((word) => [word]);
const LOGO = { data: fs.readFileSync(path.join(process.cwd(), "public/brand/logo.png")), format: "png" as const };

const INK = "#0b1424";
const TEXT = "#334155";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const BLUE = "#1d8ae6";
const GOLD = "#ffb800";

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 10, color: TEXT, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44 },
  logo: { width: 120, height: 23, objectFit: "contain", marginBottom: 22 },
  h1: { fontFamily: "Outfit", fontWeight: 700, fontSize: 24, color: INK },
  sub: { fontSize: 12, marginTop: 4 },
  bar: { flexDirection: "row", height: 3, marginTop: 14, marginBottom: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  kpi: { width: "33.33%", padding: 4 },
  kpiBox: { borderWidth: 1, borderColor: LINE, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10 },
  kpiLabel: { fontSize: 8.5, color: MUTED },
  kpiValue: { fontFamily: "Outfit", fontWeight: 700, fontSize: 15, color: INK, marginTop: 2 },
  h2: { fontFamily: "Outfit", fontWeight: 600, fontSize: 13, color: BLUE, marginTop: 18, marginBottom: 4 },
  highlight: { borderLeftWidth: 3, borderLeftColor: GOLD, paddingLeft: 8, paddingVertical: 4, marginTop: 4 },
  bold: { fontWeight: 600, color: INK },
  th: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: BLUE, paddingBottom: 4, marginTop: 6, fontWeight: 600, color: INK, fontSize: 8.5 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5, fontSize: 9 },
  cName: { flex: 3.2, paddingRight: 6 },
  cNum: { flex: 1.3, textAlign: "right" },
  cRes: { flex: 1.8, textAlign: "right" },
  note: { fontSize: 9, color: MUTED, marginTop: 6 },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 8, color: MUTED, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
});

const brl = (c: number | null) => (c === null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const int = (n: number) => n.toLocaleString("pt-BR");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const full = (d: string) => d.split("-").reverse().join("/");

function AdsReportPdf({ data, generatedAt }: { data: ReportData; generatedAt: string }) {
  const v = reportValues(data);
  const t = reportTotals(data);
  const kpis: [string, string][] = [
    ["Investimento", v.investimento],
    ["Impressões", v.impressoes],
    ["Cliques no link", v.cliques],
    ["CTR", v.ctr || "—"],
    ["Custo por clique", v.cpc || "—"],
    ["CPM", v.cpm || "—"],
  ];
  if (t.leads) kpis.push(["Leads", v.leads], ["Custo por lead", v.cpl]);
  if (t.messages) kpis.push(["Conversas", v.conversas], ["Custo por conversa", v.custo_conversa]);
  if (t.purchases) kpis.push(["Compras", v.compras], ["ROAS", v.roas || "—"]);
  const spending = data.accounts.filter((a) => a.totals.spend_cents > 0);
  const prepay = data.accounts.filter((a) => a.isPrepay && a.fundsCents !== null);

  return (
    <Document title={`Relatório de anúncios — ${data.clientName} — ${full(data.range.start)} a ${full(data.range.end)}`} author="Agência Extend" language="pt-BR">
      <Page size="A4" style={s.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt; o título do documento diz a marca */}
        <Image src={LOGO} style={s.logo} />
        <Text style={s.h1}>Relatório de anúncios</Text>
        <Text style={s.sub}>
          <Text style={s.bold}>{data.clientName}</Text> · {full(data.range.start)} a {full(data.range.end)}
        </Text>
        <View style={s.bar}>
          <View style={{ flex: 4, backgroundColor: BLUE }} />
          <View style={{ flex: 1, backgroundColor: GOLD }} />
        </View>

        <View style={s.grid}>
          {kpis.map(([label, value]) => (
            <View key={label} style={s.kpi} wrap={false}>
              <View style={s.kpiBox}>
                <Text style={s.kpiLabel}>{label}</Text>
                <Text style={s.kpiValue}>{value}</Text>
              </View>
            </View>
          ))}
        </View>

        {v.top_criativo ? (
          <View wrap={false}>
            <Text style={s.h2}>Destaque do período</Text>
            <View style={s.highlight}>
              <Text>{v.top_criativo}</Text>
            </View>
          </View>
        ) : null}

        {spending.map((a) => (
          <View key={a.name}>
            <Text style={s.h2}>{spending.length > 1 ? `Campanhas · ${a.name}` : "Campanhas"}</Text>
            <View style={s.th} fixed>
              <Text style={s.cName}>Campanha</Text>
              <Text style={s.cNum}>Investimento</Text>
              <Text style={s.cRes}>Resultado</Text>
              <Text style={s.cNum}>Custo cada</Text>
              <Text style={s.cNum}>CTR</Text>
            </View>
            {a.campaigns.filter((c) => c.totals.spend_cents > 0).map((c) => {
              const label = RESULT_LABEL[c.kind];
              const result = c.kind === "impressions" ? `${int(c.totals.impressions)} impressões` : `${int(c.kpis.results)} ${c.kpis.results === 1 ? label.one : label.many}`;
              return (
                <View key={c.name} style={s.tr} wrap={false}>
                  <Text style={s.cName}>{c.name}</Text>
                  <Text style={s.cNum}>{brl(c.totals.spend_cents)}</Text>
                  <Text style={s.cRes}>{result}</Text>
                  <Text style={s.cNum}>{c.kind === "impressions" ? "—" : brl(c.kpis.costPerResultCents)}</Text>
                  <Text style={s.cNum}>{pct(c.kpis.ctr)}</Text>
                </View>
              );
            })}
          </View>
        ))}

        {prepay.length > 0 && (
          <View wrap={false}>
            <Text style={s.h2}>Saldo das contas pré-pagas</Text>
            {prepay.map((a) => (
              <Text key={a.name} style={{ marginTop: 2 }}>
                {a.name}: <Text style={s.bold}>{brl(a.fundsCents)}</Text>
                {a.daysLeft !== null ? ` (dá para cerca de ${a.daysLeft} ${a.daysLeft === 1 ? "dia" : "dias"})` : ""}
              </Text>
            ))}
          </View>
        )}
        <Text style={s.note}>Números da Meta sincronizados pelo sistema da Extend. A Meta ainda pode ajustar a atribuição dos últimos 3 dias.</Text>

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `Agência Extend · ${data.clientName} · gerado em ${generatedAt} · página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}

export async function renderAdsReportPdf(data: ReportData, generatedAt: string): Promise<Buffer> {
  return renderToBuffer(<AdsReportPdf data={data} generatedAt={generatedAt} />);
}
