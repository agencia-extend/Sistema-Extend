# 03 — Permissões

Formato: `módulo.recurso.ação` com escopo `own` (meu), `clients` (clientes em que estou marcado), `sector` (meu setor), `all` (todos). O admin edita tudo pela tela de Papéis; esta é a configuração inicial.

## Papéis iniciais
| Papel | Quem | Resumo |
|---|---|---|
| Administrador | Jorge, Fernando | Tudo, inclusive usuários, papéis, integrações, auditoria |
| Gerente de tráfego | Luiz | Todos os clientes com tráfego; anúncios, relatórios, alertas, checklists, planejamento; libera contas para outros gestores; vê ficha completa de onboarding |
| Gestor de tráfego | 2º gestor | Igual ao gerente, mas escopo `clients` e só as contas liberadas |
| Coordenação de conteúdo | Jacque, Joana | Onboarding completo; todos os clientes de conteúdo; todos os quadros de criação; distribui demandas; vê performance de criativos |
| Social media (gerenciamento) | Madu | Clientes com gerenciamento; cronograma e publicação; aprovações |
| Editor de vídeo | Priscila, Juliana | Só tarefas atribuídas (`own`) + dados operacionais do cliente (tom, restrições, identidade) |
| Designer | — | Igual ao editor, para design |
| Gravação | — | Agenda de gravação + tarefas atribuídas |
| Sites | Henrique | Tarefas de site + clientes com site |
| Comercial | Jorge (também admin) | Funil, leads, prospectador, propostas, fechamento |
| Atendimento | — | Inbox do WhatsApp, leads (fase 2) |
| Somente leitura | — | Vê, não altera |
| Cliente (área do cliente) | usuários dos clientes | Não é papel: perfil marcado com o cliente (`portal_client_id`). Vê só o próprio cliente pelas funções `portal_*` e aprova conteúdos. Convite e acesso em `clients.portal.manage` |

## Matriz (✔ = sim, escopo entre parênteses)
| Permissão | Admin | Ger. tráfego | Gestor tráfego | Coord. conteúdo | Social media | Editor/Designer/Gravação | Comercial |
|---|---|---|---|---|---|---|---|
| clients.read | all | all¹ | clients | all¹ | clients | clients | all |
| clients.manage | all | — | — | all | — | — | — |
| clients.onboarding.read (ficha completa) | all | all | clients | all | — | — | all |
| clients.onboarding.manage | all | all | — | all | — | — | — |
| commercial.handoff.create | all | — | — | — | — | — | all |
| tasks.read | all | clients | clients | all | clients | own | — |
| tasks.manage | all | clients | clients | all | clients | own | — |
| tasks.assign | all | clients | clients | all | clients | — | — |
| sector.dashboard.read | all | tráfego | — | todos de criação | gerenciamento | — | — |
| creatives.request.create | all | clients | clients | all | — | — | — |
| creatives.produce | all | — | — | all | clients | own | — |
| creatives.performance.read | all | all | clients | all | clients | own | — |
| ads.read | all | all | clients² | clients (aba do cliente) | — | — | — |
| ads.connect | all | all | — | — | — | — | — |
| ads.access.manage | all | all | — | — | — | — | — |
| ads.manage (fase 2) | all | all | clients² | — | — | — | — |
| reports.manage | all | all | clients | — | — | — | — |
| alerts.read | all | all | clients | — | — | — | — |
| optimization.manage | all | all | clients | — | — | — | — |
| content.publish | all | — | — | all | clients | — | — |
| crm.* / prospector.* / proposals.* | all | — | — | — | — | — | all |
| proposals.templates.manage | all | — | — | — | — | — | all |
| inbox.* | all | — | — | — | — | — | all |
| settings.* / users.* / audit.read | all | — | — | — | — | — | — |

¹ todos os clientes que contrataram o serviço do setor. ² somente contas liberadas pelo gerente de tráfego.

Regras gerais:
- Ninguém concede permissão que não tem; só Administrador mexe em papéis.
- O menu (`config/navigation.ts`) mostra só o que o usuário pode usar; a RLS garante no banco.
- Mudança de papel vale na hora (sessão revalidada).
