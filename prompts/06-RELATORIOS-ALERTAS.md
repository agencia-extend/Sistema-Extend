# Prompt 06 — Relatórios automáticos, alertas, rotina de otimização e dashboards

**Objetivo:** zero relatório montado à mão; alertas chegam antes do problema (saldo acabando, reprovação, fadiga, CPL alto); o gestor tem a rotina diária/semanal registrada; os sócios e setores têm dashboards com filtros. **Fecha o MVP.**

**Leia antes:** `docs/01-requisitos-funcionais.md` seções **OTI, REL, ALE, DSH, WPP-01/02**; `docs/04-integracoes.md` (WhatsApp/WAHA); `docs/06` decisões D4 e D6; `briefing/checklist-briefing-trafego.md` itens 6–8; `briefing/reuniao-2026-11-10/resumo-da-reuniao.md` seção 6 (relatórios no grupo). No HubSystem: `src/lib/ads/{reports,alerts}.ts`, `src/domain/ads/report-message.ts`, `features/ads/components/reports-panel.tsx`, `src/lib/waha.ts`, `infra/waha`.

**Antes do plano, confirme comigo:** servidor WAHA da Extend (onde hospedar), número dedicado, grupos internos de relatórios e de alertas, limites de alerta (D6). Depois mostre o plano e espere meu ok.

## Escopo
1. **WhatsApp mínimo (RF-WPP-01, 02):** conectar número por QR (WAHA da Extend), status/reconectar, listar grupos, enviar texto para grupo com fila, intervalo entre mensagens e registro de envio. (A inbox completa é a etapa 07.)
2. **Relatórios automáticos (RF-REL-01..04, 06):** configuração por cliente e global (diário/semanal/mensal, horário, dia do mês, destino = grupo interno ou grupo do cliente com aviso de risco); modelos editáveis com as variáveis de RF-REL-02, métricas por cliente conforme o objetivo; pré-visualizar com dados reais; enviar agora; job a cada 15 min com janela; log sem duplicar.
3. **Relatório em PDF (RF-REL-05):** semanal e mensal por cliente, com a marca da Extend (KPIs, comparação, campanhas, top criativos com miniatura), salvo na aba Relatórios do cliente e enviável.
4. **Alertas (RF-ALE-01..03):** regras com padrão global + exceção por cliente/conta; avaliação a cada 15 min e após cada sincronização (saldo/gasto consultados ao vivo na API); entrega no sino, push para os responsáveis do cliente e no grupo de alertas; deduplicação diária; painel de alertas (aberto/reconhecido/resolvido, quem e como). Fadiga marca o criativo como "fadigado" (sugestão) e oferece "pedir novo criativo".
5. **Rotina de otimização (RF-OTI-01..04):** checklist diário por cliente pré-preenchido com os dados da API; checklist semanal com decisão por campanha/criativo (pausar/manter/escalar + justificativa); registro de alterações manual + automático (mudança de status/orçamento detectada na sincronização); painel de pendências do gestor no Início.
6. **Dashboards (RF-DSH-01..03):** visão dos sócios e por setor, com filtros comuns e drill-down para as listas.

## Roteiro de teste (obrigatório)
1. Conectar o número da Extend por QR; listar e escolher o grupo interno de relatórios.
2. Configurar relatório diário às HH:MM+5 para 2 clientes → chegam 2 mensagens no grupo no horário, com números que batem com o painel; rodar o job de novo → não duplica.
3. Editar o modelo de um cliente adicionando `{custo_conversa}` → pré-visualização e próximo envio refletem.
4. Gerar o PDF mensal de um cliente e baixar.
5. Definir saldo mínimo acima do saldo atual de uma conta → alerta no sino, push e no grupo de alertas uma única vez no dia; reconhecer e resolver.
6. Simular fadiga (dados de teste em `extend-dev`) → criativo sugerido como fadigado + botão pedir novo criativo funciona.
7. Gestor faz o checklist diário (itens pré-preenchidos corretos) e o semanal com decisão "pausar" → aparece no registro de alterações do cliente.
8. Pausar uma campanha direto na Meta → após a sincronização, o registro automático aparece.
9. Dashboard dos sócios com filtro "30 dias" e clique em "atrasados" leva à lista correta.
10. Desconectar o WhatsApp → relatório falha com registro e alerta "WhatsApp desconectado" no sistema.

## Fechamento do MVP
Depois do `99-REVISAO-FUNCIONAL.md`, confira todos os itens "MVP" de `briefing/checklist-briefing-trafego.md` e as 5 dores do fim do arquivo, e me entregue um **roteiro de demonstração** (10–15 min) para apresentar à Extend, mais um **guia rápido de uso** por papel (1 página cada) em `docs/guias/`.
