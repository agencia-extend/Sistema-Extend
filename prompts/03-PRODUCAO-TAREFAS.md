# Prompt 03 — Produção: quadros, tarefas, fluxos, agenda e arquivos

**Objetivo:** substituir o Trello. Demandas de cada cliente andam por etapas; em cada etapa o responsável muda e é avisado; tudo tem prazo e tempo registrado; cada pessoa vê as suas tarefas; cada setor vê o seu volume e os atrasos.

**Leia antes:** `docs/01-requisitos-funcionais.md` seções **TAR, AGE, ARQ**; `briefing/reuniao-2026-11-10/resumo-da-reuniao.md` seções 2, 3, 6 e 9; `docs/06` decisões D1, D2, D3, D7. No HubSystem: `features/tasks/*`, tabelas de tarefas e `src/lib/google/calendar.ts`.

**Antes do plano, me pergunte** as decisões D1 (arquivos), D2 (agendas) e D3 (etapas dos fluxos) se ainda estiverem em aberto. Depois mostre o plano e espere meu ok.

## Escopo
1. **Fluxos (RF-TAR-03):** tela de configuração de fluxos por tipo de demanda (etapas, ordem, setor da etapa, "aguarda cliente?"). Por cliente: responsável padrão de cada etapa (herdado dos responsáveis do cliente). Seed com os fluxos de vídeo e design do RF-TAR-03.
2. **Quadros (RF-TAR-01, 04):** Kanban por cliente e por setor (dnd-kit, tempo real com Supabase Realtime), colunas = etapas do fluxo; também quadros livres com colunas próprias; criar/renomear/arquivar quadro.
3. **Card (RF-TAR-02):** painel lateral com todos os campos, tags com cor criadas na hora, checklist, comentários com @menção (notifica), anexos, histórico, vínculos. Criar card a partir de slot, ideia ou do zero.
4. **Troca de responsável automática** ao mudar de etapa + notificação; etapa "aguarda cliente" destacada.
5. **Tempo (RF-TAR-05):** histórico de etapas com duração; iniciar/pausar trabalho; total por card/etapa/pessoa.
6. **Minhas tarefas (RF-TAR-06)** e **Início** com hoje/atrasadas/semana.
7. **Visão do setor (RF-TAR-07, 09):** página por setor com contadores e lista/Kanban filtrável (cliente, responsável, etapa, tipo, período); atrasos em destaque.
8. **Demanda do mês (RF-TAR-08):** contratado × produzido × aprovado × publicado por tipo; atualiza a barra de progresso do cliente.
9. **Dependências (RF-TAR-10).**
10. **Agenda (RF-AGE-01..04):** visão dia/semana/mês; agendas de setor; eventos com cliente e participantes (notifica); gravações ligadas aos cards; conexão opcional com Google Agenda por usuário.
11. **Arquivos (RF-ARQ-01..04):** conforme D1. Se Drive: conexão da conta da Extend, pasta por cliente criada ao concluir onboarding (e para clientes já existentes), upload retomável direto do navegador, miniatura no card.
12. **Importação do Trello (RF-TAR-11)** se D7 = sim.
13. **Jobs:** prazo em 24 h, atrasou (diário + no vencimento).

## Roteiro de teste (obrigatório)
1. No cliente "Teste Imobiliária", abrir o slot "Vídeo 1/4": Jacque escreve o roteiro e move para "Aprovação do roteiro" → depois "Gravação": responsável muda para a pessoa da gravação, que recebe push.
2. Agendar a gravação → aparece na agenda de gravação e do responsável.
3. Mover para "Edição" → Priscila recebe; ela inicia/pausa o trabalho; o tempo aparece no card e na agenda dela.
4. Priscila anexa o vídeo (Drive) → miniatura aparece; comenta "@Jacque revisar" → Jacque é notificada.
5. Prazo vencido em outro card → fica vermelho, notifica; aparece em "Atrasados" no setor de edição.
6. Página do setor Edição mostra o total do mês, atrasados e por pessoa; filtro "Priscila + últimos 7 dias" funciona.
7. Dois usuários com o mesmo quadro aberto: arrastar em um atualiza o outro.
8. Priscila não vê cards de clientes que não são dela (UI e consulta direta).
9. Demanda do mês e barra de progresso do cliente refletem os cards concluídos.

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
