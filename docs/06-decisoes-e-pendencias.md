# 06 — Decisões e pendências

## Decisões tomadas na reunião (10/11/2026)
- Um sistema único para todos os setores (não um sistema de tráfego à parte).
- Prioridade: demandas do tráfego (Luiz) e de conteúdo/mídias (Jacque) primeiro; comercial depois.
- O cliente é o pilar; onboarding obrigatório libera e define a estrutura do cliente.
- Duas visões: ambiente do cliente e visão do setor.
- Relatórios automáticos vão para um grupo interno de WhatsApp (menos risco de bloqueio).
- Aprovação do cliente principalmente por link enviado no WhatsApp; área/app do cliente depois.
- PWA primeiro; app nas lojas depois.
- Primeira versão até o fim de novembro; uso em dezembro; janeiro implantação com clientes.

## Decisões da etapa 01 (10/11/2026)
- Escopos de permissão em ordem `own < clients < sector < all` (enum `permission_scope`). "Do meu setor" para clientes = clientes que contrataram serviço de um setor da pessoa (aplicado nas tabelas da etapa 02).
- Gerente de tráfego e Coordenação de conteúdo com `clients.read` = setor/todos (nota ¹ da matriz em `docs/03`).
- Papel "Cliente" (fase 3) **não** foi semeado ainda: entra na etapa 12 com a área do cliente.
- Login com Google: oculto até ser configurado no Supabase da Extend (RF-PER-01 diz "só aparece se configurado").
- "Ver como" (RF-PER-07): pré-visualização somente leitura do menu e das permissões efetivas, sem trocar de sessão.
- Chaves VAPID em variáveis de ambiente (como em `docs/04`), não no banco.

## Pendências da etapa 01
- **Supabase da Extend:** autenticar o MCP `supabase` (projeto `iuqcpcrpnwwquxxbleyw`, em `.mcp.json`) com a conta Google da Extend via `claude /mcp` num terminal comum. Sem isso as migrations não foram aplicadas e o roteiro de teste E2E não rodou.
- **Vercel da Extend:** criar o projeto (região gru1) e as variáveis de ambiente; depois rodar `scripts/configure-jobs.mjs`.
- **RF-PER-10 (reatribuir demandas ao desativar):** o acesso já é removido na hora; a reatribuição entra na etapa 03, quando as tarefas existirem.
- **Convite com clientes iniciais (RF-PER-02):** a coluna `invitations.client_ids` existe; a escolha na tela entra na etapa 02.

## Decisões em aberto (resolver antes da etapa indicada)
| # | Decisão | Opções | Recomendação | Etapa |
|---|---|---|---|---|
| D1 | Onde guardar arquivos | Google Drive integrado × Supabase Storage | Drive para vídeos/artes (já usam, cliente baixa de lá; custo), Storage só para anexos leves. Fazer o cálculo: nº clientes × vídeos/mês × tamanho médio | 03 |
| D2 | Agendas por setor | Internas × Google Agenda compartilhada × ambas | Internas no sistema + sincronização opcional por pessoa com Google | 03 |
| D3 | Fluxo de etapas por tipo de demanda | Proposta em RF-TAR-03 | Validar com a Jacque usando os quadros do Trello | 03 |
| D4 | WhatsApp | WAHA (grupos, risco) × Cloud API (oficial, sem grupos) × ambos | WAHA para relatórios/alertas em grupo; Cloud API para atendimento comercial se houver volume | 06/07 |
| D5 | Nomenclatura de campanhas | Sugestão em `docs/02` | Validar com o Luiz | 05 |
| D6 | Limites de fadiga e alertas | Sugestão em `docs/02` | Validar com o Luiz | 06 |
| D7 | Migrar histórico do Trello | Sim × só clientes ativos × não | Só quadros ativos | 03 |
| D8 | Prospectador | Google Places (pago por uso) × outra fonte | Google Places com teto mensal | 08 |
| D9 | TikTok, Canva, Gamma | Depende das APIs | Fora do MVP; avaliar depois | 10+ |
| D10 | IA no sistema ("Mega Brain") | Resumo de performance, copy, pautas | Fora do MVP; escopo e custo a definir | futuro |
| D11 | Domínio do sistema | ex. `sistema.agenciaextend.com.br` | Confirmar | 01 |

## O que pedir à Extend (checklist)
- [ ] Organograma: funcionários, e-mail, setor, função, quem é admin (Henrique vai receber).
- [ ] Planilha "Controle de clientes" e planilha de controle de mídias (Jacque).
- [ ] Exportação JSON dos quadros do Trello (cliente ativo + setores de edição e conteúdo).
- [ ] Briefing de mídias da Jacque (ainda não enviado) e perguntas atuais do onboarding.
- [ ] Lista definitiva de serviços vendidos e unidades mensais.
- [ ] Modelo atual de proposta comercial (Jorge) e o que mais muda nele.
- [ ] Acessos de administrador nas contas da Extend: Supabase, Vercel, BM da Meta (verificado), MCC do Google Ads, Google Cloud, Drive, domínio/DNS, número de WhatsApp dedicado.
- [ ] Manual de marca (se houver) — já temos logos e cores do site.
- [ ] Lista de clientes ativos com serviços e responsáveis (para a carga inicial).
- [ ] Grupo(s) de WhatsApp internos para relatórios e alertas.

## Decisões da etapa 02 (11/11/2026)
- Ficha de onboarding semeada com as seções do RF-ONB-01 e editável em Configurações → Onboarding (versões; fichas em andamento passam para o modelo novo, respostas mantidas por chave). A lista de perguntas da Jacque substitui a semente quando chegar.
- Aviso de cliente novo: por padrão, todas as pessoas com papel Coordenação de conteúdo e Gerente de tráfego; lista ajustável.
- Demandas do mês: prazos distribuídos pelo mês, às 18h de São Paulo (ex.: 4 vídeos → fim de cada semana). Responsável = pessoa marcada no setor do serviço.
- Prazo dos itens do checklist = fim do dia (23:59 em São Paulo), N dias após o fechamento.
- Concluir onboarding exige: perguntas obrigatórias, checklist completo e ao menos uma pessoa marcada na equipe do cliente.
- Visibilidade "do meu setor" para clientes = cliente com serviço vigente de um setor da pessoa, ou com alguém do setor marcado.
- Arquivos: anexos leves (até 10 MB) no Storage privado `anexos`; vídeos são recusados com orientação para usar o Drive (decisão D1 ainda aberta para a integração com o Drive).
- Login: o bloqueio temporário conta só tentativas erradas (5 por e-mail, 20 por IP em 15 min).

## Pendências da etapa 02
- Planilha real "Controle de clientes": o importador adivinha as colunas pelo cabeçalho; validar com a planilha da Jacque.

## Situação em 12/11/2026
- Etapa 03 testada de ponta a ponta (30/30) e publicada no GitHub. Ficaram de fora: integração com o Drive (D1), sincronização com o Google Agenda (D2) e importação do Trello (D7).
- Briefing de mídias recebido (`docs/08-briefing-midias.md`). Comparativo e plano da etapa 03B em `docs/09-comparativo-e-plano-midias.md`, aguardando aprovação.
- **Vercel (12/11/2026):** projeto `hub-extend` publicado em https://hub-extend.vercel.app, região gru1 (São Paulo), na conta Vercel `ohenriquecorreia` (plano Hobby), por decisão do Henrique, até a ida para a VPS. Variáveis de produção e preview configuradas; jobs do banco apontados para o domínio (`scripts/configure-jobs.mjs`). Usa o mesmo Supabase do desenvolvimento (só existe um projeto até agora). A publicação é pela CLI (`vercel deploy --prod`), porque a conta Vercel não tem a conexão de login com o GitHub; com ela, cada push na `main` publicaria sozinho.
- **Pendente (Supabase → Authentication → URL Configuration):** Site URL `https://hub-extend.vercel.app` e Redirect URL `https://hub-extend.vercel.app/**`. Sem isso, o link de recuperar senha e o de convite podem voltar para o endereço antigo.

## Decisões da etapa 03B — Controle de Mídias (12/11/2026)
Tomadas pelo desenvolvedor ao seguir `docs/09` sem resposta às três perguntas do item 5; todas reversíveis por configuração ou migration.
- **Ordem:** a 03B veio antes da etapa 04 (Criativos).
- **Mês do cliente:** começa no dia de início do contrato (`client_months`). Sem data de início, vale o dia em que o cliente ficou ativo. O job diário `extend-slots-mensais` abre o mês novo no dia da virada; alterar serviço vale a partir do próximo mês do cliente.
- **Slots:** continuam sendo um por item contratado de cada serviço ("Vídeo 1/8", "Arte 1/4"), listados juntos e numerados no Controle de Mídias. O formato nasce pelo tipo do serviço e pode ser trocado. Não foi criado um slot genérico "Conteúdo N" (C3 do `docs/09`).
- **Etapas:** os fluxos de vídeo e design **não foram trocados** (decisão D3 segue aberta com a Jackeline). O quadro do setor agrupa as etapas atuais nas 6 colunas do Trello: tudo antes da etapa do setor = Não iniciado; Edição/Criação e Ajustes = Em andamento; Revisão interna = Aprovação interna; Aprovação do cliente = Aprovação cliente; Programado = Inserir no cronograma; Publicado = Finalizado. A regra está em `src/domain/media` e vale também para etapas criadas depois.
- **Em alteração:** entrar na etapa marcada como retrabalho (`workflow_steps.is_rework`, hoje "Ajustes") soma 1 em `task_content.rework_count`. Arrastar de uma aprovação de volta para "Em andamento" leva a essa etapa. Ainda não há tela para marcar outra etapa como retrabalho.
- **Quadro do setor:** existe para os setores que produzem (`workflows.board_sector_id`: Edição para vídeo, Design para arte). O card entra quando alguém é escolhido para editar/criar. Essa pessoa vê e move o card mesmo quando a etapa atual é de outra pessoa; continua sem ver os cards das colegas.
- **Permissões alteradas:** Editor de vídeo, Designer e Gravação passam a abrir a visão do próprio setor; Coordenação de conteúdo abre a de todos os setores e o Controle geral (`dashboards.read`).
- **Drive:** só links nesta etapa (link final, takes brutos, post). D1 segue aberta.

## Pendências da etapa 03B
- Do `docs/09` ficaram para a próxima fatia: código/tipo do cliente, responsável pela comunicação, escopo em texto, lista de clientes em tabela, histórico de contratos, abas Materiais/Documentos/Gravações, briefing por seções A–E, checklist do Miro em dias úteis, cronograma com grid, prazos recorrentes de sexta e segunda, importação da planilha "Controle de Mídias".
- No Controle geral os números ainda não abrem a lista que os compõe (só a linha do cliente leva ao Controle de Mídias dele).
- Rodar `prompts/99-REVISAO-FUNCIONAL.md` completo para as etapas 03 e 03B.

## Correções de 13/11/2026
- **Criar demanda pela tela era negado para todos** ("Você não tem permissão"). A política de leitura de `tasks` consultava a própria tabela e não enxergava a linha recém-inserida. Quem cria, e o responsável, passam a ler direto pela coluna (`20261113000200`). Coberto por teste de banco e pelo roteiro `e2e/04`.
- **Fuso horário:** entre 21h e meia-noite (São Paulo), o fechamento gravava o início do contrato no dia seguinte (data UTC) e concluir o onboarding na mesma noite não criava as demandas do mês. As datas de negócio usam `private.today_sp()` (`20261113000300`).
- Tela de entrada: a foto do escritório saiu; entrou a marca animada (`BrandMotion`).

## Pendências novas
- Gamificação e Treinamentos do prompt ERP: aguardam decisão da Extend (`docs/10`).
