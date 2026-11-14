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
- **Vercel (13/11/2026):** projeto `hub-extend` movido para a **conta da Extend** (time `extend5`). Região das funções: **iad1 (EUA)**, ao lado do banco Supabase (us-east-1); em gru1 cada consulta cruzava o continente (~120 ms) e as telas levavam em média 911 ms, em iad1 levam 582 ms (varredura `e2e/00-varredura.spec.ts`). Quando o Supabase de produção for criado em São Paulo (sa-east-1), voltar as funções para gru1. Endereço oficial: **https://hub.agenciaextend.com.br** (CNAME `hub` no DNS da HostGator; o site `agenciaextend.com.br` segue no ar). Sem VPS por enquanto. O projeto antigo na conta pessoal `ohenriquecorreia` deve ser excluído.
- **E-mails do sistema (ativo desde 13/11/2026):** envio pela caixa `hub.extend@agenciaextend.com.br` (Titan, contratado na HostGator; `smtp.titan.email:465`; MX e SPF do domínio apontados para o Titan).
  - **Todos os e-mails seguem um layout único** (`src/lib/email/layout.ts`): logo, faixa dourada, título, o "crachá" da pessoa com a situação do acesso, botão azul e rodapé do sistema.
  - **Supabase Auth** envia 8 modelos (`scripts/email-templates.mjs`, aplicados por `node scripts/configure-email.mjs https://hub.agenciaextend.com.br`): convite, recuperar senha, link de entrada, confirmar e-mail, troca de e-mail, código de verificação, aviso de senha alterada e aviso de e-mail alterado. Os dois avisos ficam ligados. O plano grátis do Supabase só aceita modelos próprios com o envio próprio ativo.
  - **O próprio sistema envia** (`src/lib/email/messages.ts`, por `sendEmail`): boas-vindas depois de aceitar o convite, acesso pausado e acesso reativado. Endereços `.test`/`.example` não recebem e-mail, para os testes não gerarem devoluções. Se o envio falha, a tela avisa para contatar a pessoa por outro canal.
  - Site URL e Redirect URLs do Supabase já apontam para o domínio novo. Variáveis de produção e preview configuradas (sem as credenciais de E2E); jobs do banco apontados para o domínio (`scripts/configure-jobs.mjs`). Usa o mesmo Supabase do desenvolvimento (só existe um projeto até agora). A publicação é pela CLI (`vercel deploy --prod --token $VERCEL_TOKEN`, token da Extend no `.env.local`).

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
- ~~No Controle geral os números ainda não abrem a lista que os compõe~~: feito em 14/11. Totais, cada número da produção por pessoa e cada etapa abrem a lista das demandas (`?ver=`), com as mesmas regras do relatório (`drillTasks`).
- Rodar `prompts/99-REVISAO-FUNCIONAL.md` completo para as etapas 03 e 03B.

## Correções de 13/11/2026
- **Criar demanda pela tela era negado para todos** ("Você não tem permissão"). A política de leitura de `tasks` consultava a própria tabela e não enxergava a linha recém-inserida. Quem cria, e o responsável, passam a ler direto pela coluna (`20261113000200`). Coberto por teste de banco e pelo roteiro `e2e/04`.
- **Fuso horário:** entre 21h e meia-noite (São Paulo), o fechamento gravava o início do contrato no dia seguinte (data UTC) e concluir o onboarding na mesma noite não criava as demandas do mês. As datas de negócio usam `private.today_sp()` (`20261113000300`).
- Tela de entrada: a foto do escritório saiu; entrou a marca animada (`BrandMotion`).

## Pendências novas
- Gamificação: **não entra** (decisão da Extend em 13/11/2026). Treinamentos: feito em 13/11 (`docs/10`).
- **Privacidade / LGPD (13/11/2026):**
  - **Páginas públicas:** `/privacidade` e `/termos`, com links no login, nos e-mails e no Meu perfil. O texto descreve só o que o sistema faz de fato: dados, bases legais do art. 7º, operadores, transferência para os EUA (o banco Supabase fica em us-east-1), prazos de guarda, segurança, cookies essenciais e direitos do art. 18.
  - **Ciência da política:**
    - quem entra pelo convite precisa marcar "Li e concordo";
    - (14/11/2026, a pedido do Henrique) não há mais aviso dentro do sistema; as páginas públicas (entrada, política, termos e aprovação do cliente) mostram o aviso de cookies com "Aceitar", guardado no aparelho, e o sistema só usa cookies necessários;
    - fica registrado em `privacy_consents`, por versão (`PRIVACY_VERSION` em `src/domain/privacy`).
    - Quando o texto mudar, troque a versão para todos lerem de novo.
  - **Pedidos dos titulares:**
    - pelo Meu perfil → Privacidade, com prazo legal de 15 dias;
    - o admin é avisado e responde em Configurações → Privacidade (LGPD), e a pessoa é avisada da resposta;
    - "Baixar meus dados" gera um JSON pela RPC `my_personal_data`;
    - permissão `privacy.manage`, só do admin.
  - **Retenção automática** (cron `extend-privacidade`, diário):
    - avisos lidos: 180 dias; avisos não lidos: 1 ano;
    - convites não aceitos: 90 dias;
    - aparelhos sem uso: 1 ano;
    - auditoria e pedidos respondidos: 5 anos.
  - **Pendente com a Extend:**
    - preencher razão social, CNPJ, endereço e encarregado (DPO) em Configurações → Privacidade;
    - revisar o texto com o advogado da agência;
    - avaliar mover o projeto de produção do Supabase para São Paulo (sa-east-1), o que tira a transferência internacional;
    - apagar ou anonimizar, após 5 anos, o histórico de quem saiu (a política promete isso).
- **Onboarding com os passos do Miro (13/11/2026):** o Onboarding continua sendo o mesmo da central do cliente, com ficha, passos, responsáveis e conclusão obrigatória. Os passos padrão viraram os do fluxograma do Miro:
  1. repasse para a coordenação;
  2. grupo de WhatsApp;
  3. briefing agendado em até 2 dias úteis;
  4. briefing realizado;
  5. mídias: metodologia definida e próxima reunião marcada;
  6. tráfego: orçamento, acessos e criativos de teste;
  7. obrigações do cliente.

  Cada passo traz a orientação do Miro.
  - **Prazos:** em dias úteis, sem fim de semana, sem os feriados nacionais e sem a Sexta-feira Santa (`private.add_business_days` e `src/domain/shared/business-days.ts`).
  - **Marcos:** Abertura, Briefing, Combinados com o cliente e Onboarding concluído (`client_milestones`). Cada marco fecha sozinho quando os passos dele terminam e entra na linha do tempo.
  - **Avisos:** o responsável é avisado do passo, também quando o passo muda de pessoa. Passo atrasado avisa o responsável; marco atrasado avisa a coordenação e a equipe do cliente (cron `extend-onboarding`, dias úteis às 9h30).
  - **Ficha:** ganhou a seção "Obrigações do cliente" (versão 2).
  - **Playbooks genéricos:** continuam como recurso à parte, para outros processos.
- **Central do cliente, parte A (14/11/2026):**
  - **Código do cliente:** todo cliente tem Nº (automático e editável, sem repetir). A busca por número procura pelo Nº.
  - **Responsável pela comunicação:** `clients.owner_id`. A pessoa é avisada ao ser escolhida e recebe os avisos de contrato.
  - **Lista de clientes:** virou tabela, com Nº, serviços, responsável, fim do contrato e andamento. Filtros por serviço, responsável, contrato (termina em até 30 dias ou vencido) e data de entrada. No celular, cada linha vira um cartão.
  - **Aba Contratos** (`client_contracts`):
    - histórico com renovação (sugere o dia seguinte e a mesma duração) e sem sobreposição;
    - o contrato mais recente alimenta o fim, a renovação, a mensalidade e o escopo do cadastro;
    - o início do relacionamento (`contract_start`) não muda, porque ancora o ciclo do mês;
    - o valor só é lido por quem tem `clients.onboarding.read` (função `client_contract_fees`; a coluna não é liberada na tabela).
  - **Avisos de fim de contrato:** 30 e 7 dias antes e no dia seguinte ao vencimento sem renovação (cron `extend-contratos`).
  - **Cartão "Dados do cliente":** deixou de editar datas e valor do contrato, que agora ficam só em Contratos.
- **Central do cliente, parte B (14/11/2026):**
  - **Materiais** (`client_materials`): por categoria (identidade visual, catálogo, instruções de perfil, banco de imagens, referências, acessos e outros), cada um com arquivo de até 10 MB ou link do Drive. Quem é da equipe do cliente adiciona; o arquivo vai para Documentos → Mídias. Acessos: só links e instruções, nunca senhas.
  - **Documentos** (aba antiga "Arquivos"): pastas por setor (Geral, Mídias, Tráfego) em `client_files.folder`, com envio para a pasta aberta e opção de mover.
  - **Gravações** (`recording_sessions`, `save_recording`): registro por diária, com data, local, quem gravou, link dos brutos e conteúdos gravados. Os conteúdos recebem data, quem gravou e link dos brutos (sem apagar o que já tinham), e quem edita é avisado. A aba aparece para clientes com vídeos ou gravação.
  - **Cronograma** (aba para clientes com Gerenciamento):
    - lista por semana do mês e grid do Instagram;
    - entram os conteúdos com data de post no mês ou com o destino "Cronograma" ainda sem data;
    - "Programar" define data, legenda, capa (JPG, PNG ou WebP até 5 MB, `task_content.cover_path`) e link do post publicado, que passa o post para "Postado".
  - Permissões revistas no banco: só as colunas permitidas podem ser alteradas (`20261114000400`).
- **Playbooks (14/11/2026):** `/playbooks` (menu Produção).
  - **Permissões:** `playbooks.manage` (admin, coordenação de conteúdo e gerente de tráfego) monta os processos; `playbooks.apply` (esses mais gestor de tráfego e atendimento) aplica, e só em clientes que a pessoa vê.
  - **Etapas:** cada uma tem prazo D+N (úteis ou corridos), setor, tipo de demanda, marco e orientação.
  - **Aplicar** (`apply_playbook`):
    - cria uma demanda por etapa, para a pessoa do setor no cliente (senão o líder do setor), que é avisada;
    - cria os marcos com a data da última demanda de cada um;
    - entra na linha do tempo;
    - antes de confirmar, a tela mostra a prévia das datas.
  - **Marcos:** fecham sozinhos quando as demandas terminam e reabrem se uma voltar; marco atrasado avisa quem aplicou e o responsável pela comunicação (cron `extend-playbooks`).
  - **Na central:** a Visão geral do cliente mostra os playbooks aplicados.
  - **Conteúdo:** nenhum processo inventado. A Extend cadastra os dela. O onboarding continua na ficha do cliente.
- **Etapa 04 — Criativos (14/11/2026):** `/criativos` (menu Produção), com Quadro, Lista, Meus pedidos e Biblioteca.
  - **Permissões:** usa as que já existiam desde a fundação: `creatives.request.create` (pedir), `creatives.produce` (produzir), `creatives.review` (aprovar internamente) e `creatives.library.manage` (organizar a biblioteca).
  - **Fluxo próprio** (tipo `criativo`): Solicitado → Em produção → Em revisão → Ajustes solicitados → Aprovação do cliente → Aprovado → Entregue → No ar.
  - **Pedido** (`create_creative_request`):
    - os campos obrigatórios bloqueiam o envio;
    - o painel lateral mostra o resumo do onboarding e os últimos vencedores, fadigados e reprovados;
    - o pedido vai para a pessoa da Edição (vídeo e reels) ou do Design (o resto) no cliente; se não houver ninguém marcado, vai para o líder do setor.
  - **Versões** (`task_deliveries`, `delivery_assets`, `delivery_comments`; função `add_delivery`):
    - genéricas, servem para qualquer demanda;
    - o arquivo vai do navegador direto para o Storage (até 10 MB); vídeos maiores entram como link do Drive, com player embutido;
    - a entrega muda a etapa para "Em revisão" e avisa quem pediu (`creative_ready`).
  - **Revisão interna** (`review_creative`): pedir ajuste (com comentário obrigatório), aprovar e enviar ao cliente, aprovar direto, entregue e no ar.
  - **Link do cliente** (`approval_links`):
    - o código fica só no navegador de quem gerou, e o banco guarda o hash SHA-256;
    - vale 7 dias e aceita uma decisão;
    - gerar outro substitui o anterior;
    - a página pública `/aprovar/[código]` registra nome, data, hora e IP;
    - a decisão (`decide_approval`) só pode ser chamada pelo servidor;
    - funciona também para demandas comuns com etapa de cliente;
    - há botões "Copiar link" e "Enviar no WhatsApp" (wa.me).
  - **Biblioteca** (`creative_library`): o aprovado entra com a copy. Situações: em teste, vencedor, fadigado, reprovado pela Meta e arquivado. A exportação do mês sai em CSV e PDF (pdf-lib).
  - **Pendente para a etapa 05:** a performance (RF-BIB-03) e o botão "pedir novo criativo" a partir do anúncio (RF-CRI-08). O banco já tem `creative_requests.source_ad_ref` e `creative_library.ad_ref`, e nada falso aparece na tela.
  - **Limitação conhecida:** a página do criativo, para quem não tem acesso, mostra "Página não encontrada" com código HTTP 200. A tela de carregamento começa a responder antes do 404, e nenhum dado do criativo é enviado.
- **Briefing por seções A–E (14/11/2026)** (docs/08, item 3.3): a ficha de onboarding virou o briefing completo, com 70 perguntas em 6 seções: A. Geral, B. Tráfego pago, C. Produção de vídeos, D. Design, E. Site/Landing page e Obrigações do cliente.
  - **Seções por serviço:** cada seção tem `show_for` (abas de serviço). A seção só aparece, só conta no "o que falta" e só entra no resumo operacional se o cliente tiver o serviço, vigente ou com início futuro (`private.section_applies`, `sectionApplies`).
  - **Edição:** em Configurações → Onboarding, cada seção tem "Mostrar para".
  - **Salvamento:** o rascunho é salvo sozinho, como antes.
  - **Valores sensíveis:** investimento, ticket, meta de faturamento, acessos e forma de pagamento dos anúncios ficam só para quem vê a ficha completa.
  - **Gerador:** a ficha é gerada por `scripts/gen-briefing.mjs`.
- **Arquivos escolhidos antes de a página ficar interativa se perdiam** (envio de versões do criativo e importação de planilha). O campo agora só fica ativo depois do carregamento.

## Decisões da etapa 08 — Comercial (14/11/2026)
- Feito agora: leads com origem, UTMs e sem duplicar telefone/e-mail (telefone gravado só com dígitos e DDI 55); funis configuráveis em quadro com cor e prazo de parada por etapa; perda só com motivo; histórico e próximas ações com lembrete; importação com prévia, deduplicação e desfazer; Ganho → fechamento pré-preenchido → cliente em onboarding ligado ao lead; painel em tabelas (por origem, responsável, funil e motivos de perda).
- Visibilidade: escopo "todos" vê o comercial inteiro; "só os meus" (atendimento) vê os leads que tem ou cadastrou. Responsável só pode ser quem tem acesso ao comercial e é avisado ao receber um lead.
- Lembretes (job `extend-comercial`, a cada 30 min das 8h às 19h, seg. a sáb.): próxima ação vencendo e lead parado além do prazo da etapa, uma vez por ocorrência.
- Conversão do painel = ganhos ÷ (ganhos + perdidos) no período. Propostas enviadas/aceitas entram com a etapa 09.
- **Pendente (depende de contas da Extend):** cadências por WhatsApp (RF-CRM-06) esperam o provedor e o número (D4); prospectador (RF-CRM-07) espera a chave do Google Places com teto mensal (D8).
