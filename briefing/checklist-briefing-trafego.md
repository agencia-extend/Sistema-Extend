# Checklist de aceite — Briefing do gestor de tráfego (Luiz)

Fonte: `briefing-trafego-pago-luiz.pdf`. Cada item tem dono de etapa. O MVP só é dado como pronto quando todos os itens "MVP" funcionam com dados reais.

| # | Item do briefing | Requisito | Etapa | Fase |
|---|---|---|---|---|
| 1 | Cadastro central de clientes e contas: cliente, segmento, responsáveis tráfego/mídias, status (ativo, pausado, onboarding); BM, conta de anúncio, página, Instagram, pixel/dataset, WhatsApp, forma de pagamento; verba mensal, renovação, canal de comunicação | RF-CLI-01..04 | 02 | MVP |
| 2 | Ficha de briefing (onboarding): oferta, público, região, diferenciais, objeções, objetivo (lead, WhatsApp, visita ao perfil, venda); restrições de política da Meta (estética, saúde, finanças); identidade visual, tom de voz, materiais autorizados | RF-ONB-01..06 | 02 | MVP |
| 3 | Fluxo de solicitação de criativos: formulário padronizado (cliente, campanha, objetivo, formato, ângulo, público, CTA, referências, prazo, prioridade); status solicitado → em produção → em revisão → aprovado → entregue → no ar; aprovação interna e do cliente com versões; notificação a cada etapa | RF-CRI-01..08 | 04 | MVP |
| 4 | Biblioteca de criativos: vínculo com cliente, campanha, formato e ângulo; copy (texto principal, título, descrição); status em teste, vencedor, fadigado, reprovado pela Meta | RF-BIB-01..05 | 04 + 05 | MVP |
| 5 | Planejamento de campanhas: estrutura por cliente (objetivo, orçamento, público, período, criativos); nomenclatura padrão em todas as contas; calendário compartilhado de datas comemorativas, lançamentos e promoções | RF-PLA-01..05 | 05 | MVP |
| 6 | Rotina e checklists: diário (saldo/cobrança, reprovações, gasto vs. orçamento, entrega parada); semanal (criativos, públicos, custos; pausar/manter/escalar); registro de alterações (o que, quando, por quê) | RF-OTI-01..04 | 06 | MVP |
| 7 | Métricas e relatórios: painel por cliente com KPIs por objetivo (CPM, CTR, CPC, frequência, CPL, custo por conversa no WhatsApp, ROAS) puxados da API; relatório semanal e mensal padronizado | RF-ADS-05..09, RF-REL-01..06 | 05 + 06 | MVP |
| 8 | Feedback para a mídia: números por criativo (CTR, CPL, hook rate…) visíveis para a mídia; alerta de fadiga (frequência alta, CTR caindo) | RF-BIB-03, RF-ALE-01 | 05 + 06 | MVP |
| — | Qualidade dos leads (cliente avalia; retorno volta para a campanha) | RF-T2-01 | 11 | Fase 2 |
| — | Alertas: anúncio reprovado, conta restrita, saldo baixo, CPL acima da meta | RF-ALE-01 | 06 | **antecipado ao MVP** |
| — | Histórico de reprovações da Meta por tipo de criativo | RF-T2-02 | 11 | Fase 2 |
| — | Registro de decisões e aprovações de verba | RF-T2-03 | 11 | Fase 2 |
| — | Permissões por perfil (gestor, mídia, atendimento, diretoria) | RF-PER-* | 01 | **antecipado ao MVP** |
| — | Metas por cliente (CPL, leads, investimento) | RF-T2-04 | 11 | Fase 2 |

## Dores — teste de aceite do MVP
1. Nenhum criativo é pedido fora do formulário (o formulário não envia incompleto; WhatsApp deixa de ser o canal de pedido).
2. A mídia vê a performance do que produziu, por criativo.
3. Qualquer pessoa autorizada vê em que etapa está cada criativo.
4. Histórico e decisões ficam registrados por cliente.
5. Nenhum relatório é montado à mão.
