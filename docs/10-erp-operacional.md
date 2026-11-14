# 10 — Prompt "ERP Operacional" × Sistema Extend

Recebido em 12/11/2026 (`PROMPT-ERP-OPERACIONAL.md`, enviado pelo Henrique). É o modelo de outra agência. Regra combinada: implementar **só o que falta e faz sentido para a Extend**, sem quebrar o que existe e mantendo a identidade visual da Extend (azul e dourado, `docs/07`), não o verde-limão do prompt.

## Mapa

| Item do prompt | No Sistema Extend | Situação |
|---|---|---|
| Perfis e menu só com o permitido | Papéis com matriz de permissões, exceções por pessoa, RLS no banco, menu filtrado (`visibleNavGroups`), "Ver como" | Já existia; cada tela nova entra com permissão própria |
| Tarefa atribuída avisa a pessoa | Aviso no sistema e push ao atribuir, mudar etapa, comentar, prazo e atraso | Já existia; demandas repetidas e rotinas também avisam |
| Busca Ctrl+K, notificações em tempo real | Busca global e sino em tempo real | Já existia |
| Tarefa recorrente | `tasks.repeat_*`: todo dia, toda semana, a cada 2 semanas, todo mês | **Feito em 13/11** |
| Modelos rápidos | `task_templates` + "Começar de um modelo" + Configurações → Rotinas e modelos | **Feito em 13/11** (14 modelos adaptados à Extend) |
| Prazos fixos da semana (briefing de mídias 3.7) | `service_routines`: cronograma na sexta, legendas e posts na segunda, para cada cliente com Gerenciamento | **Feito em 13/11** |
| Dashboard operacional (KPIs, alta prioridade, reuniões, saúde dos clientes, entregas por tipo) | Bloco "Operacional" no Início, para quem tem `dashboards.read` (sócios e coordenação), com período e filtro por pessoa | **Feito em 13/11** |
| Kanban em 5 colunas fixas + status de aprovação | Fluxos por tipo de demanda com etapas e responsável por etapa; quadro do setor com as colunas do Trello | Mantido o modelo da Extend (mais rico); não duplicar |
| Workspace do cliente com abas | Central do cliente com abas por serviço | **14/11**: abas Materiais, Contratos, Documentos (pastas), Gravações e Cronograma com grid |
| Linha do tempo com marcos | Histórico do cliente | **Feito em 13/11**: marcos Abertura, Briefing, Combinados e Conclusão no onboarding |
| Playbooks (etapas com prazo relativo geram tarefas e marcos) | Onboarding com os passos do Miro (ficha do cliente) + `/playbooks` para os outros processos | **Feito em 14/11**: etapas com D+N (úteis ou corridos), setor, tipo e marco; aplicar cria as demandas e os marcos; marco fecha sozinho e avisa se atrasar |
| Tráfego (gasto, CTR, campanhas) | Etapa 05 (API Meta/Google) | No plano; sem tela com dado estático |
| Portal do cliente | Etapa 12 | No plano |
| Gamificação (ons, faixas, ranking, missões, carreira) | — | **Não entra** (decisão da Extend em 13/11) |
| Treinamentos | `/treinamentos`: trilhas com aulas (texto, vídeo do YouTube/Loom/Drive/Vimeo, PDF ou slides), progresso por pessoa, atribuição com prazo, aba Equipe | **Feito em 13/11** (conteúdo da Extend; o do prompt é de outra agência) |
| Assistente de IA | Futuro (D10) | Fora do MVP |
| Presença "N online" | — | Baixa prioridade |

## Decisões de 13/11/2026
- **Repetição:** a próxima da série nasce ao concluir ou quando o prazo passa (a atrasada continua aberta, para não sumir trabalho). Vai para quem estava responsável quando a repetição foi ligada. Copia descrição, checklist (desmarcado), etiquetas e participantes. Se ficou parada semanas, pula para a próxima data futura. Cliente encerrado ou excluído para a série.
- **Rotinas:** criadas de 0 a 6 dias antes (padrão 3), uma por cliente, rotina e data. Tipo "Geral" (A fazer → Fazendo → Feito). Só clientes **ativos** com o serviço vigente.
- **Modelos e rotinas** são configurados por quem tem "Configurar quadros, colunas e fluxos" (admin e coordenação de conteúdo).
- **Treinamentos:** permissões `trainings.read` (todos os papéis) e `trainings.manage` (admin, coordenação de conteúdo e gerente de tráfego). Rascunho só a gestão vê. Atribuir avisa a pessoa (se o treinamento estiver publicado; se for rascunho, avisa ao publicar). Concluir a última aula avisa quem atribuiu. Prazo vencido avisa uma vez (cron `extend-treinamentos`, 06:10). Arquivos até 25 MB no bucket privado `treinamentos`, enviados direto do navegador (a RLS confere). Vem com o treinamento real "Primeiros passos no Sistema Extend".
- **Sem pontuação, ranking ou faixas** (decisão da Extend).
