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
- **Supabase da Extend:** autenticar o MCP `supabase-extend` (`/mcp`) com a conta Google da Extend e criar o projeto `extend-dev` (sa-east-1). Sem isso as migrations não foram aplicadas e o roteiro de teste E2E não rodou.
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
