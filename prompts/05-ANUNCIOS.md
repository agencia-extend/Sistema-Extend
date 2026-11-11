# Prompt 05 — Anúncios: Meta Ads e Google Ads, planejamento e performance por criativo

**Objetivo:** puxar tudo das APIs (sem digitar à mão), mostrar o painel do tráfego enxuto em tabela, os KPIs que importam para o objetivo de cada cliente, a performance de cada criativo para a equipe de mídias, e organizar campanhas com plano, nomenclatura e calendário.

**Leia antes:** `docs/01-requisitos-funcionais.md` seções **ADS, PLA, BIB-03, CRI-08**; `docs/02-arquitetura-e-dados.md` (métricas, nomenclatura, jobs); `docs/04-integracoes.md` (Meta e Google Ads); `docs/05-referencias-hubsystem.md` (O que NÃO repetir, itens 1–4); `briefing/checklist-briefing-trafego.md` itens 4, 5, 7 e 8. No HubSystem: `src/lib/ads/{oauth,meta,google-ads,tokens,sync}.ts`, `src/lib/crypto.ts`, `src/domain/ads/{conversions,utm}.ts`.

**Antes do plano, confirme comigo:** status da verificação do app da Meta no BM da Extend, acesso à MCC do Google Ads, se o developer token ainda é exigido (verifique a documentação oficial atual) e o padrão de nomenclatura (D5). Depois mostre o plano e espere meu ok.

## Escopo
1. **Conexões (RF-ADS-01, 02):** OAuth Meta e Google (state em cookie httpOnly, tokens cifrados AES-256-GCM, tabela sem grant); System User token da Meta quando disponível; status, expiração, reconectar. Tela de contas: escolher quais entram e vincular a um cliente (usa `client_accounts` da etapa 02 para sugerir o vínculo).
2. **Sincronização (RF-ADS-03):** fila `pgmq` com um job por conta, agendado a cada 3 h + "sincronizar agora"; 90 dias na primeira vez, 7 depois; upsert em lotes; retry exponencial; registro de execução e erro por conta; `login-customer-id` persistido por conta; renovação de miniaturas dos criativos. Campos de insights de `docs/02` (inclui alcance, cliques no link, leads, conversas, vídeo 3 s, ThruPlays).
3. **Métricas (RF-ADS-06):** `src/domain/ads/metrics.ts` com todas as fórmulas de `docs/02#metricas` e testes (inclusive divisão por zero). KPIs exibidos conforme o objetivo do cliente (do onboarding).
4. **Saldo (RF-ADS-04):** saldo, limite, gasto do dia/mês, dias restantes.
5. **Painel do tráfego (RF-ADS-05, 09):** tabela hierárquica cliente → conta → campanha → conjunto → anúncio, com status, investimento e KPIs; filtros (cliente, plataforma, status, período com presets) e comparação com o período anterior; gráficos recolhíveis; exportar CSV. Escopo por gestor.
6. **Gerente libera contas** para outros gestores (RF-PER-06) — tela de acesso por gestor.
7. **Aba Anúncios no cliente (RF-ADS-07)** para quem tem permissão (inclusive mídias): ativos/pausados agora, com miniatura e números.
8. **Google (RF-ADS-08):** campanhas, palavras-chave e termos de pesquisa com métricas.
9. **Reprovações (RF-ADS-10):** detectar `DISAPPROVED`/motivo na sincronização; marcar o criativo vinculado como "reprovado pela Meta".
10. **Performance por criativo (RF-BIB-03):** vínculo automático criativo ↔ anúncio pelo nome padronizado (`FORMATO_ANGULO_V#`) + vínculo manual; métricas por criativo na biblioteca e no card do criativo, visíveis para a mídia; sugestão automática de "vencedor" (melhor KPI do objetivo com investimento mínimo) e "fadigado" (regra de fadiga) — o gestor confirma.
11. **Pedir novo criativo a partir do anúncio (RF-CRI-08).**
12. **Planejamento (RF-PLA-01..05):** plano de campanha por cliente com status e vínculo com a campanha real; configuração e gerador de nomenclatura + relatório "fora do padrão"; calendário de marketing com datas nacionais pré-carregadas e datas por cliente; gerar solicitação de criativo com antecedência configurável (job diário).
13. **UTMs (RF-ADS-11).**

## Roteiro de teste (obrigatório) — com contas reais da Extend
1. Conectar Meta e Google; escolher 2 contas e vincular a clientes; a sincronização inicial termina e mostra campanhas dos últimos 90 dias.
2. Conferir 3 números (gasto, cliques, leads) de uma campanha com o Gerenciador de Anúncios/Google Ads no mesmo período → batem (diferença só de fuso/atribuição, explicada).
3. Painel com filtro "últimos 7 dias" e comparação; exportar CSV.
4. Liberar só 1 conta para o 2º gestor → ele vê só essa (UI e consulta direta).
5. Saldo e dias restantes de uma conta pré-paga conferem com a Meta.
6. Revogar o token no Facebook → a conexão aparece como expirada com aviso; reconectar resolve.
7. Criativo da biblioteca com nome padronizado → números aparecem nele e na visão da mídia.
8. Criar um plano de campanha, gerar o nome padrão, criar a campanha na Meta com esse nome → após a sincronização, o plano fica vinculado; uma campanha com nome fora do padrão aparece no relatório.
9. Data no calendário daqui a 15 dias → a solicitação de criativo é criada pelo job.
10. Simular falha de uma conta na fila → as outras sincronizam normalmente; o erro aparece na tela de contas.

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
