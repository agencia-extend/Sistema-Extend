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
- ~~**RF-PER-10 (reatribuir demandas ao desativar)**~~: feito em 14/11/2026. "Desativar acesso" mostra o que a pessoa tem em aberto e, se houver algo, exige escolher quem assume (`admin_open_work`, `admin_deactivate_user`, `admin_successors`). Passa, na mesma transação da desativação:
  - demandas abertas (responsável, quem edita e quem grava) e a dona das demandas que se repetem;
  - equipes de cliente, responsável pela comunicação e pessoa padrão por etapa;
  - passos de onboarding não feitos;
  - leads abertos e propostas não decididas (aí quem assume precisa ter acesso ao Comercial);
  - pedidos de criativo agendados no calendário de marketing.

  O que já foi concluído continua no nome de quem fez. Quem assume recebe **um** aviso com o resumo (os avisos item a item dos gatilhos são trocados por ele), com link para Minhas tarefas, Comercial ou Clientes conforme o acesso. Reativar não devolve o trabalho. Coberto por `21_desativar_com_repasse.test.sql` e `e2e/17`.
- **Convite com clientes iniciais (RF-PER-02):** a coluna `invitations.client_ids` existe; a escolha na tela entra na etapa 02.

## Decisões em aberto (resolver antes da etapa indicada)
| # | Decisão | Opções | Recomendação | Etapa |
|---|---|---|---|---|
| D1 | Onde guardar arquivos | Google Drive integrado × Supabase Storage | Drive para vídeos/artes (já usam, cliente baixa de lá; custo), Storage só para anexos leves. Fazer o cálculo: nº clientes × vídeos/mês × tamanho médio | 03 |
| D2 | Agendas por setor | Internas × Google Agenda compartilhada × ambas | Internas no sistema + sincronização opcional por pessoa com Google | 03 |
| D3 | Fluxo de etapas por tipo de demanda | Proposta em RF-TAR-03 | Validar com a Jacque usando os quadros do Trello | 03 |
| D4 | WhatsApp | WAHA (grupos, risco) × Cloud API (oficial, sem grupos) × ambos | WAHA para relatórios/alertas em grupo; Cloud API para atendimento comercial se houver volume | 06/07 |
| D5 | Nomenclatura de campanhas | Sugestão em `docs/02` | **Decidido (14/11/2026): usar a sugestão do `docs/02`, editável em Configurações** | 05 |
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
- [ ] Modelo atual de proposta comercial (Jorge) e o que mais muda nele. O modelo inicial do sistema segue os blocos do RF-PRO-01 e é editável em Configurações › Propostas; com o modelo do Jorge em mãos, ajustar o texto e a ordem lá (sem código).
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
- **Em alteração:** entrar na etapa marcada como retrabalho (`workflow_steps.is_rework`, hoje "Ajustes") soma 1 em `task_content.rework_count`. Arrastar de uma aprovação de volta para "Em andamento" leva a essa etapa. Desde 15/11, qualquer etapa pode ser marcada ou desmarcada em Configurações › Fluxos (“Conta como retrabalho”).
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
  - ~~**Pendente para a etapa 05:** o botão "pedir novo criativo" a partir do anúncio (RF-CRI-08).~~ Feito em 18/11/2026 (ver "Pedir novo criativo a partir do anúncio"). A performance (RF-BIB-03) foi feita em 17/11/2026. O banco já tem `creative_requests.source_ad_ref` e `creative_library.ad_ref`, e nada falso aparece na tela.
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

## Decisões da etapa 09 — Propostas (14/11/2026)
- **Modelo inicial**: o modelo atual do Jorge ainda não chegou. O sistema nasce com “Proposta padrão” (capa, sobre, diagnóstico, serviços, investimento, condições, próximos passos, contato), todo editável em Configurações › Propostas. Cada salvamento vira uma versão; dá para restaurar versões e duplicar modelos.
- **Preços**: descrição comercial e preço padrão ficam em `service_offers` (separado do catálogo para que só quem tem `proposals.read` veja preço; quem edita é `proposals.templates.manage`). Os preços começam vazios: a Extend preenche. Na proposta, valor, quantidade e desconto (em reais, por item) são editáveis; itens mensais e de valor único somam separados.
- **Texto rico**: formatação simples e previsível (parágrafo, lista com “- ”, **negrito**) e variáveis `{cliente}`, `{contato}`, `{vendedor}`, `{servicos}`, `{valor_mensal}`, `{valor_unico}`, `{valor_total}`, `{forma_pagamento}`, `{validade}`, `{data}`, `{numero}`, `{observacoes}`. Variável desconhecida é recusada ao salvar. Bloco de texto vazio some da proposta.
- **Prévia = PDF**: o mesmo documento (`buildDoc`) alimenta a prévia, a página pública e o PDF (`@react-pdf/renderer`, fontes Inter e Outfit embutidas). O teste compara valores, nome e validade entre os dois.
- **Versões da proposta**: cada salvamento grava um retrato completo (blocos do modelo + dados). O link mostra só a versão **enviada**; salvar de novo pede “Enviar esta versão”. Proposta aceita não muda mais.
- **Link público** `/proposta/<código>`: código aleatório de 32 caracteres, sem indexação. Cada abertura é registrada (data/hora); abertura de quem está logado no sistema não conta. O vendedor é avisado (no máximo um aviso por hora por proposta).
- **Aceite**: nome completo + confirmação. Move o lead para Ganho (com o valor mensal), registra no histórico do lead e avisa o vendedor para registrar o fechamento, que abre preenchido com serviços, valores, taxa única e forma de pagamento.
- **Vencimento**: job diário `extend-propostas` (00h05 de Brasília) marca “expirada” e avisa o vendedor; a página pública e a lista já mostram vencida antes do job.
- **WhatsApp (RF-PRO-06)**: até o número da Extend estar ligado ao sistema (etapa 07), “Abrir no WhatsApp” usa o WhatsApp de quem envia (wa.me) com a mensagem do modelo já preenchida. Quando a etapa 07 existir, o mesmo botão passa a enviar pelo número da Extend.
- **Painel comercial**: ganhou “Propostas enviadas” e “Propostas aceitas” no período.

## Pendências do briefing de mídias (14/11/2026)
- **Cliente sem retorno (docs/09, 3.9):** conteúdo na etapa de aprovação do cliente, com versão enviada (ou roteiro, ou link de aprovação aberto), parado há **2 dias úteis** avisa o responsável pela comunicação e quem está com a demanda; há **5 dias úteis**, avisa de novo. Um aviso por marco; se a demanda sai da etapa e volta (novo envio ao cliente), a contagem recomeça. Cliente pausado ou encerrado não gera aviso. Cron `extend-cliente-sem-retorno` (dias úteis, 9h45). Tipo de aviso novo nas preferências: “Cliente sem retorno em aprovação”.
- **Links rápidos:** o topo da central do cliente mostra Instagram, Drive, site, Facebook, TikTok e WhatsApp, montados a partir de “Contas e acessos”. Só entra o que vira endereço válido (`src/domain/clients/quick-links.ts`).
- **Reuniões:** tipos “Aprovação de estratégia” e “Acompanhamento”.
- **Catálogo:** “Consultoria de perfil” e “Google Meu Negócio” (setor Gerenciamento, sem unidade mensal). Ajustáveis em Configurações.
- **Papel Videomaker:** o papel “Gravação” passou a se chamar “Videomaker” (só o nome; a chave `gravacao`, o setor e a etapa “Gravação” continuam).
- **Criativo no ar em até 2 dias (15/11/2026):** criativo em “Aprovado” ou “Entregue” há 2 dias úteis sem ir para “No ar” avisa quem pediu; se essa pessoa não estiver ativa, avisa a equipe de tráfego do cliente. Um aviso por entrada na etapa. Cron `extend-criativo-no-ar` (dias úteis, 9h50). Tipo de aviso novo nas preferências.
- **Continua com a Extend:** a planilha “Controle de Mídias” para importar e o cadastro da equipe (hoje só o administrador está no sistema).

## Etapa 05, planejamento: calendário de marketing (14/11/2026)
As contas da Meta e do Google ainda não existem (passo a passo entregue ao Henrique em 14/11). Enquanto isso, entrou a parte da etapa 05 que não depende das APIs:
- **Tela** `/calendario-marketing` (menu Produção), por mês, de 3 em 3 meses, com filtro por cliente.
- **Datas nacionais** calculadas no banco (`national_marketing_dates`), sem manutenção ano a ano: Ano Novo, Carnaval, Dia da Mulher, Dia do Consumidor, Páscoa, Dia do Trabalhador, Dia das Mães, Namorados, São João, Dia dos Pais, Independência, Dia do Cliente, Dia das Crianças, Halloween, Black Friday, Cyber Monday, Natal e Réveillon. “Usar para um cliente” abre a data do cliente já preenchida.
- **Datas do cliente** (`marketing_dates`): lançamento, promoção, evento, data sazonal ou outra. Permissões novas `marketing_calendar.read` (tráfego, mídias e somente leitura) e `marketing_calendar.manage` (admin, gerente de tráfego e coordenação de conteúdo em todos; gestor de tráfego e social media nos clientes em que estão). A RLS e as funções `save_marketing_date`/`delete_marketing_date` conferem no banco.
- **Pedido de criativo automático (RF-PLA-05):** a data pode levar o briefing (formato, objetivo, quantidade, ângulo, público, CTA, prioridade). Só quem pode pedir criativos para o cliente agenda. O pedido sai N dias antes (padrão 15), em nome de quem cadastrou, com prazo de 5 dias antes da data (nunca menos de 2 dias a partir de hoje), e vai para a fila de Criativos. Se a data já está dentro da antecedência, sai ao salvar. Job `extend-calendario-marketing` (todo dia às 8h). Se o pedido falhar (por exemplo, a pessoa saiu da equipe do cliente), o erro aparece na data e quem cadastrou e o responsável pela comunicação são avisados; alterar a data tenta de novo. Depois de criado, o briefing não muda (o pedido segue em Criativos).
- **Ficam para quando as contas existirem:** plano de campanha com vínculo à campanha real (RF-PLA-01/02) e o gerador e verificador de nomes (RF-PLA-03), que precisa das campanhas sincronizadas para o relatório “fora do padrão”.

## Decisões da etapa 12 — Área do cliente (14/11/2026)
- **Quem é o usuário do cliente:** um perfil marcado com `profiles.portal_client_id`, ligado a **um** cliente. Não é um papel: ele não tem papel, setor nem permissão. `private.org_id()` e `private.user_perm_scope()` devolvem nulo para ele, então nenhuma política interna o deixa ler nada (clientes, demandas, comentários, arquivos, contratos, perfis da equipe). Gatilhos impedem dar papel, setor, equipe do cliente, participação ou responsabilidade em demanda a ele.
- **O que ele vê** sai só das funções `portal_*` (security definer, colunas escolhidas):
  - visão geral: serviços contratados (quantidade, sem valor), etapas do projeto, progresso do mês por serviço, próximos posts e o nome do contato na Extend;
  - cronograma do mês (mesma regra da aba Cronograma);
  - aprovações pendentes (demanda na etapa que aguarda o cliente, com versão enviada ou roteiro) e decisões recentes;
  - relatórios e materiais: Documentos › **Relatórios** e › **Para o cliente** (pastas novas) e conteúdos concluídos com link final do Drive;
  - estratégia/planejamento publicado (`client_strategies`: rascunho da equipe, o cliente vê só o publicado).
- **O que nunca vê:** valores (mensalidade, contrato, preços), notas e comentários internos, nota da entrega, ficha de onboarding, equipe por setor, outros clientes. Coberto por `18_area_do_cliente.test.sql` e pelo roteiro `e2e/14`.
- **Convite (RF-ACL-01):** aba **Área do cliente** no ambiente do cliente. Usa o mesmo convite da equipe (`invitations.portal_client_id`, sem papel). Quem convidou é avisado do aceite. Permissão nova `clients.portal.manage` (admin, coordenação de conteúdo e gerente de tráfego: todos; gestor de tráfego e social media: clientes em que estão). Pausar acesso derruba a sessão e avisa por e-mail.
- **Aprovar pelo portal:** mesma regra do link (`private.apply_client_decision`, usada pelo link e pelo portal). Só a pessoa do cliente decide; a equipe na prévia não. A decisão fica registrada em `approval_links` com o nome de quem aprovou.
- **Avisos (RF-ACL-03):** no sistema e push (PWA) quando chega conteúdo para aprovar, relatório ou arquivo novo, e estratégia publicada. Os avisos no celular são ligados em Área do cliente › Ajuda. WhatsApp para o cliente fica para a etapa 07 (depende do provedor e do número, D4).
- **Prévia:** “Ver como o cliente” abre o portal daquele cliente para a equipe que o vê (somente leitura).
- **Manual do cliente:** página Ajuda do portal.
- **Fora agora (não aparece na tela):** relatórios automáticos (etapa 06, depende da Meta/Google Ads) e avaliação de leads (etapa 11). Por enquanto os relatórios são os PDFs que a equipe envia para a pasta Relatórios.
- **Correção encontrada no teste:** a checagem de acesso do portal devolvia “nulo” para acesso pausado e deixava passar; agora é `coalesce(..., false)`.

## Etapa 05, parte 1: conexões com a Meta e o Google (15/11/2026)
Pedido do Henrique: deixar o sistema pronto para conectar a agência (BM e MCC) e cada pessoa (Google Agenda, Facebook), e entregar o passo a passo das contas (`docs/11-passo-a-passo-meta-google.md`).
- **Configurações › Integrações** (permissão `ads.connect`: admin e gerente de tráfego):
  - mostra o que falta configurar no servidor e o endereço de retorno para cadastrar no app da Meta e no Google Cloud;
  - **Meta da agência:** token do usuário do sistema do BM (recomendado; validado na Meta pelo `debug_token`, recusado se for de outro app) ou login do Facebook (Login do Facebook para Empresas, com `config_id` quando houver);
  - **Google Ads da agência:** login com a conta que administra a MCC; a MCC é encontrada sozinha (sem developer token, aposentado pelo Google, e sem variável de MCC) e cada conta guarda o `login_customer_id`;
  - **Contas de anúncio:** BMs/MCCs e contas encontradas (próprias do BM, de clientes compartilhadas com o BM e dentro da MCC). A tela sugere o cliente quando ele já tem a conta em "Contas e acessos". Incluir exige cliente, e ligar a conta a um cliente a acrescenta em "Contas e acessos" sem duplicar (`save_ad_account`).
- **Meu perfil › Conexões:** Google Agenda de cada pessoa (`calendar.app.created`: agenda separada "Sistema Extend" criada pelo app, sem acesso às outras agendas) e Facebook pessoal de quem tem `ads.manage` (contas de clientes fora do BM; a conta que já vem pela agência continua com a agência). Só aparece o que está configurado no servidor.
- **Google Agenda:** salvar ou excluir um evento leva a mudança para a agenda "Sistema Extend" dos participantes conectados e de quem criou. Roda depois da resposta (`after`), sem atrasar a tela. Falha fica registrada na conexão da pessoa.
- **Segurança:**
  - tokens cifrados (AES-256-GCM) em `integration_connections`, tabela sem grant para usuários;
  - a tela lê `integration_status()`, sem tokens: a agência para quem lê ou conecta anúncios, e cada um vê só as próprias conexões;
  - o OAuth usa `state` aleatório em cookie httpOnly de 10 minutos, comparado em tempo constante, com a permissão conferida na ida e na volta;
  - desconectar revoga na plataforma e apaga o token.
- **Avisos:**
  - conexão da agência vencendo em 7 dias avisa quem tem `ads.connect` uma vez;
  - conexão parada avisa uma vez por dia (cron `extend-integracoes`, 9h);
  - desconectar a agência avisa os demais.
- **Política de privacidade (versão 2026-11-15):** nova seção "Conexões com Meta e Google" com o que é lido, a declaração de Uso Limitado do Google e como desconectar e apagar (`/privacidade#exclusao`, endereço de exclusão de dados exigido pela Meta).
- **Testado sem as chaves:**
  - banco: `23_integracoes.test.sql`;
  - regras: `src/domain/integrations`;
  - tela: `e2e/19` (situação da configuração, endereço de retorno, conectar sem configuração volta com aviso, contas ligadas a clientes e sugestão, gestor sem acesso).
- **Falta testar com as chaves:** a troca do código pelo token na Meta e no Google, a busca real de BMs, MCC e contas, e o envio para a Google Agenda. Será feito assim que as chaves estiverem no `.env.local`.
- **Riscos levantados nas páginas oficiais:**
  - Google em "Testing" derruba as conexões a cada 7 dias (publicar o app);
  - o acesso Explorer da Google Ads API exige faturamento ativo no projeto;
  - contas de anúncio que pertencem aos clientes podem exigir o acesso completo da Meta (verificação da empresa e análise do app).
- **Briefing do Luiz revisto:**
  - itens 1 a 4 prontos;
  - item 5: calendário pronto; plano e nomenclatura esperam as campanhas sincronizadas;
  - itens 6 a 8 (checklists com números da API, registro de alterações automático, KPIs, relatórios e números por criativo) dependem da sincronização, que é a próxima entrega depois das chaves.

- **Preparação para as verificações (15/11/2026, a pedido do Henrique):**
  - página inicial pública em `/` (sem login): o que o sistema faz, o uso dos dados do Google e da Meta, resumo em inglês para os revisores, links de privacidade e termos. Quem está logado vai para `/inicio`;
  - botões "Continuar com o Google" no padrão de marca do Google;
  - ícone do app 1024×1024 em `/brand/app-icon-1024.png`;
  - agenda com o escopo mínimo (`calendar.app.created`).
  - **Ordem combinada (docs/11):** a análise da Meta (acesso avançado) só pode ser enviada depois da sincronização, do painel e das páginas (fase 3), porque cada permissão precisa de um vídeo com o dado em uso. Os textos em inglês para as análises estão prontos no docs/11.
  - **Para a fase 3:** a Meta pede uso real de `pages_show_list` e `pages_read_engagement`, que são dependências de `business_management`. Entram com a lista de páginas e o vínculo ao cliente, e os últimos posts ao lado do cronograma. Também uma conta de revisor.

## Briefing do Luiz: verba aprovada e registro de alterações (15/11/2026)
Feito sem depender das chaves da Meta e do Google.
- **Aba Tráfego no cliente** (`/clientes/[id]/trafego`):
  - aparece para clientes com serviço de anúncios (aba de serviço `anuncios`);
  - quem vê: tem `ads.read` ou `optimization.manage`;
  - quando a sincronização existir, o painel de números entra nesta mesma aba.
- **Verba aprovada pelo cliente (RF-T2-03):**
  - campos: valor, plataforma, período, quem aprovou no cliente, data e canal (WhatsApp, e-mail, reunião, ligação);
  - comprovante (print, áudio ou PDF até 10 MB) guardado em Documentos › Tráfego;
  - a tela destaca a verba vigente e a média por dia;
  - registrar avisa a equipe de tráfego do cliente e entra no histórico;
  - quem otimiza o cliente (`optimization.manage`) registra, completa e apaga.
  - **Fica para a sincronização:** o alerta de gasto acima da verba aprovada.
- **Registro de alterações (RF-OTI-03, parte manual):**
  - campos: o que mudou, quando, por quê, tipo e plataforma; o autor vem do login;
  - aparece agrupado por mês e entra no histórico do cliente;
  - só quem registrou corrige ou apaga; a origem (`source`) não vem do formulário;
  - registros automáticos (`source = 'sync'`, mudança de orçamento/status detectada) entram com a sincronização e não podem ser alterados.
- **Permissões no banco:** RLS por cliente (`can_client`), colunas liberadas uma a uma, organização e autor preenchidos por gatilho. Coberto por `24_registro_trafego.test.sql` e `e2e/21`.

## Briefing do Luiz: checklists e rotina do tráfego (15/11/2026)
Feito sem depender das chaves (item 6 do briefing; RF-OTI-01, 02 e 04).
- **Checklist diário** por cliente: saldo e cobrança, anúncios reprovados, gasto x orçamento, entrega. Cada item: Ok, Problema (com o que aconteceu, obrigatório) ou Não se aplica.
- **Checklist semanal** (identificado pela segunda-feira): criativos, públicos, custos e as decisões da semana (campanha, conjunto ou anúncio → pausar, manter ou escalar, com o motivo).
- Um checklist por cliente e período (`traffic_checks`); salvar de novo atualiza. Organização, autor, hora e contagem de problemas vêm do banco; itens e decisões são validados no banco (`private.traffic_check_error`) e no Zod. Não dá para fazer o de um dia futuro.
- **Problema** vai para o histórico do cliente; **saldo/cobrança com problema** avisa o responsável pela comunicação do cliente (para cobrar o pagamento).
- **Rotina do tráfego** (`/trafego`, menu Produção, `optimization.manage`): tabela dos clientes ativos com anúncios que a pessoa otimiza, com o checklist de hoje e o da semana, em aberto primeiro (`public.traffic_routine`). Na aba Tráfego do cliente, os dois do período no topo e os anteriores com problemas e decisões.
- **Lembretes** (job `extend-checklists-trafego`, dias úteis às 11h): um aviso por pessoa da equipe de tráfego com os clientes sem o checklist do dia; no último dia útil da semana, também o semanal. Tipo de aviso `traffic_check` (pode ser desligado em Notificações).
- **Com a sincronização:** os itens do diário chegam pré-preenchidos com os números da API (saldo em dias, reprovados, gasto de ontem x verba, campanhas sem entrega), e as decisões passam a escolher a campanha da lista sincronizada.
- Coberto por `25_checklists_trafego.test.sql` e `e2e/22`.

## Relatório semanal e retorno do cliente (15/11/2026)
Briefing de mídias 3.9 ("Entrega de métricas e acompanhamento"), feito sem depender das chaves nem do WhatsApp.
- **Registro do envio** (`client_reports`): um relatório por cliente, área e semana (identificada pela segunda-feira). Áreas: **tráfego** (cliente com anúncios; envia quem tem `reports.manage`) e **conteúdo** (cliente com gerenciamento; envia quem tem `content.publish`). Data do envio (não pode ser futura), link do relatório (Reportei, PDF no Drive, print) e observações. Quem enviou vem do login.
- **Retorno do cliente:** Positivo, Negativo (com o que o cliente achou ruim, obrigatório) ou Sem retorno. Registra quem envia a área ou o responsável pela comunicação do cliente. Vai para o histórico do cliente.
  - **Negativo** avisa a equipe da área no cliente e o responsável pela comunicação (estudar e ajustar as campanhas / rever o conteúdo).
  - **Sem retorno** cria a demanda "Ligar para {cliente}: sem retorno do relatório de …", prioridade alta, para o responsável pela comunicação (ou quem enviou), com prazo no próximo dia útil ao meio-dia.
- **Telas:** aba **Relatórios** no cliente (com anúncios ou gerenciamento): a semana atual no topo e as anteriores com o retorno; página **Relatórios da semana** (`/relatorios`, menu Produção) com a tabela por cliente e área e a lista dos que esperam retorno de semanas anteriores.
- **Avisos** (job `extend-relatorios-retorno`, dias úteis às 10h, tipo `client_report`): a partir de quarta, relatório da semana sem envio (equipe da área, uma vez por semana); retorno não registrado 2 dias úteis depois do envio (quem enviou, uma vez por relatório).
- **Com a etapa 06:** o envio automático pelo WhatsApp e o PDF gravam a mesma linha; o retorno continua manual.
- Coberto por `26_relatorios_retorno.test.sql` e `e2e/23`.

## Briefing do Luiz: histórico de reprovações da Meta (15/11/2026)
RF-T2-02, feito sem depender das chaves (registro manual; a sincronização passa a trazer as reprovações sozinha).
- **Registro** (`ad_rejections`) na aba **Tráfego** do cliente, seção "Reprovações da Meta": data (não pode ser futura), plataforma, formato, ângulo, motivo, o que a Meta disse, nome do anúncio, desfecho (em aberto, corrigido e reenviado, contestado e aprovado, contestado e mantida, descartado) e "o que evitar da próxima vez".
  - **Motivos** (lista fixa, para consolidar): atributos pessoais, antes e depois / imagem corporal, promessa de resultado, saúde e procedimentos, serviços financeiros, conteúdo sensacionalista, conteúdo adulto ou sugestivo, marca ou direitos autorais, página de destino, funcionalidade falsa, tema social ou político, outro.
  - Pode ser ligada a um **criativo da biblioteca**: o formato e o ângulo vêm dele, e a peça passa a "Reprovado pela Meta".
  - Registra, corrige e apaga quem otimiza o cliente (`optimization.manage`). Lê também quem pede ou produz criativos para o cliente. Registros automáticos (`source = 'sync'`) não mudam pela tela.
- **Avisos** (tipo `ad_alert`): a equipe de tráfego do cliente (abre a aba Tráfego) e quem pediu e quem produziu a peça (abre o criativo), menos quem registrou. Entra no histórico do cliente.
- **Consolidado:** "Motivos que mais se repetem" na aba Tráfego; na página do criativo, o quadro "Reprovado pela Meta"; no **pedido de criativo**, o quadro "O que evitar" com os motivos dos últimos 12 meses do cliente, formatos, ângulos e as lições anotadas (`avoidSummary` em `src/domain/creatives/rejections.ts`).
- **Com a sincronização:** reprovações detectadas na API entram sozinhas (`source = 'sync'`) e o alerta de anúncio reprovado (RF-ALE-01) usa a mesma tabela.
- Coberto por `27_reprovacoes_meta.test.sql` e `e2e/24`.
- Correção junto: no pedido de criativo, ângulos longos na lista "Últimos criativos com resultado" alargavam a página no computador.

## Links com UTM (16/11/2026)
RF-ADS-11, feito sem depender das chaves.
- **Onde:** aba **Tráfego** do cliente, seção "Links com UTM" (`utm_links`). Lê quem vê o tráfego do cliente (`ads.read` ou `optimization.manage`); gera e apaga quem otimiza o cliente. Link não se edita: "Gerar parecido" abre o formulário preenchido.
- **Modelos** (`src/domain/traffic/utm.ts`):
  - **Meta Ads:** `utm_source={{site_source_name}}&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}`. A Meta troca as chaves em cada clique. Botão "Copiar parâmetros" para o campo "Parâmetros de URL" do anúncio.
  - **Google Ads:** `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}` (ValueTrack). Botão "Copiar modelo de acompanhamento" (`{lpurl}?…`).
  - **Outro** (bio, e-mail, WhatsApp, QR Code): tudo à mão.
- **Regras:** o que é digitado vira minúsculas, sem acento e com "_" no lugar de espaço; as chaves das plataformas ficam como estão. O destino precisa ser http(s) com domínio; UTMs antigas do destino são trocadas e os outros parâmetros e a âncora ficam. O banco confere que o link parte do destino e tem source, medium e campaign, e não deixa gerar o mesmo link duas vezes no cliente.
- **Com a sincronização:** a campanha poderá ser escolhida da lista sincronizada.
- Coberto por `28_links_utm.test.sql`, `utm.test.ts` e `e2e/25`.
- Correção junto: o botão de fechar dos diálogos e painéis era lido como "Close" pelo leitor de tela; agora é "Fechar".

## Cronogramas do mês (16/11/2026)
RF-CON-01, visão do setor de gerenciamento (o cronograma por cliente já existia desde 14/11).
- **Página** `/cronogramas` (menu Produção, "Cronogramas do mês"): para quem publica conteúdo (`content.publish`: social media, coordenação de conteúdo, admin) ou tem o Controle geral (`dashboards.read`).
- **Tabela por cliente** ativo com **Gerenciamento de redes** vigente no mês: Nº e nome (abre o cronograma do cliente no mesmo mês), social media (quem está no setor Gerenciamento do cliente), posts **contratados** (quantidade do serviço), **programados** (com data no mês), **postados** (com o link do post) e **sem data** (marcados para o cronograma). Situação: **Completo** quando os programados cobrem o contratado; senão "Faltam N posts". Os que faltam mais aparecem primeiro.
- **Filtro:** "Meus clientes" (padrão para quem está no gerenciamento de algum cliente) ou "Todos"; navegação por mês.
- **No banco:** `public.schedule_overview(início, fim)` faz as contagens e só devolve clientes que a pessoa pode ver (`can_client` de `content.publish` ou `dashboards.read`); período de até 62 dias. Regras puras em `monthStatus` e `byMissing` (`src/domain/schedule`).
- O mês é o do calendário, como na aba Cronograma (não o mês do contrato do Controle de Mídias).
- Coberto por `29_cronogramas_do_mes.test.sql` e `e2e/26`.
- Correção junto: o mês aparecia como "Novembro De 2026" na aba Cronograma; agora "Novembro de 2026".

## Quem está online (16/11/2026)
- **Topo de todas as telas:** botão "N online" (no celular, só o ícone e o número). Abre a lista de quem está com o sistema aberto agora: você primeiro, depois por nome, com o papel e desde que horas. Várias abas da mesma pessoa contam como uma; quem fecha o sistema some da lista em alguns segundos.
- **Acesso no banco:** canal privado do Realtime `equipe:{organização}`. As políticas em `realtime.messages` (`20261116000300`) só deixam ler e anunciar presença quem é da equipe ativa da organização (`private.org_id()`, que já exclui a área do cliente e quem foi desativado), e só presença (nada de mensagens no canal). Testes em `30_presenca_online.test.sql`.
- Nada fica gravado: a presença vive só enquanto a pessoa está conectada. Se o canal não conectar, o botão não aparece e o resto da tela segue normal.

## Facebook do cliente (17/11/2026)
A pedido do Henrique: muitas contas de anúncio ficam no perfil do Facebook do cliente, e não no BM da Extend. Além da conexão da agência (usuário do sistema do BM) e da pessoal de cada gestor, cada cliente pode ter **o próprio Facebook conectado**.
- **Onde:** aba Tráfego do cliente, seção "Facebook do cliente". Lista também em Configurações › Integrações ("Facebook dos clientes").
- **Dois jeitos de conectar:**
  - **Gerar link para o cliente:** página pública `/conectar/{código}`, que mostra o que a agência vê e o que não faz. O cliente toca em "Continuar com o Facebook" e autoriza, sem login no sistema. O link vale 7 dias e serve para uma autorização. Gerar outro cancela o anterior. Só o hash do código fica no banco, então o link aparece uma vez só, com "Copiar" e "Enviar no WhatsApp".
  - **Conectar agora:** o gestor entra com o Facebook do cliente no próprio navegador.
- **Contas encontradas:** já ficam com o cliente. Quem cuida do tráfego do cliente liga "Entra no sistema" na própria aba. Contas que já vêm pelo BM da Extend continuam pela conexão da agência.
- **Quem pode:** gerar link, conectar, reconectar, buscar contas e desconectar exige `ads.manage` no cliente (gestor do cliente, gerente de tráfego, admin). Quem só lê anúncios vê a situação. Regras no banco: `can_manage_client_ads`, `create_client_connect_link`, `revoke_client_connect_link`, `toggle_client_ad_account` e `integration_status` com as conexões de cliente. Testes em `31_facebook_do_cliente.test.sql` e `e2e/28-facebook-do-cliente.spec.ts`.
- **Avisos:**
  - Quando o cliente autoriza pelo link, quem gerou o link e o tráfego do cliente recebem "{cliente} conectou o Facebook", com o número de contas.
  - Conexão parada ou vencendo (o token de login da Meta dura cerca de 60 dias) avisa o tráfego do cliente, ou quem conecta a agência se ninguém cuidar do cliente (cron `extend-integracoes`).
- **Limite da Meta:** enquanto o app está em desenvolvimento, só conecta quem estiver cadastrado no app (Funções do app › Testadores). A seção mostra esse aviso até `META_APP_LIVE=1`, que deve ser ligado na Vercel quando a Meta aprovar o app e ele for para Live.
- **Next.js 16.4.6:** o build de produção passou a recusar a 16.4.3 por uma falha de segurança conhecida.

## Sincronização da Meta, painel do tráfego e alertas (17/11/2026)
Primeira parte da fase 3 (RF-ADS-03/04/05/07/10, RF-ALE-01/02), conferida contra a Meta com a conexão real da agência:
- **Teste com dados reais:** EXTEND - 02 e HG BRASIL. O gasto de 30 dias gravado bate com o da Meta (R$ 632,81 na HG BRASIL) e é igual nos níveis de conta, campanha e anúncio. O saldo pré-pago foi lido do texto da Meta (R$ 68,71 e R$ 279,68).
- **Sincronização** (`src/lib/ads/meta-sync.ts`, job `ads-sync`, cron `extend-anuncios-sync` a cada 3 horas):
  - só as contas ligadas ("Entra no sistema") com conexão ativa, das mais atrasadas para as mais recentes, dentro de cerca de 45 s; o que não couber fica para a rodada seguinte;
  - grava a situação e o saldo da conta, as campanhas, os conjuntos, os anúncios (com miniatura e o retorno da análise) e os números por dia de conta, campanha e anúncio;
  - na primeira vez busca 90 dias (37 por anúncio); depois, os últimos 3 dias, porque a Meta ainda ajusta a atribuição;
  - cada rodada fica em `ad_sync_runs` (60 dias) e o erro aparece na conta;
  - "Sincronizar agora" no painel (quem conecta) e na aba Anúncios (quem cuida do tráfego do cliente).
- **Resultado por objetivo** (`src/domain/ads`): leads, conversas, compras, cliques no link, visualizações ou impressões. Em objetivos genéricos (engajamento, tráfego), vale o que aconteceu: conversas, depois leads, depois cliques. Indicadores: CTR, CPC, CPM, custo por resultado e ROAS.
- **Painel do tráfego** (`/trafego/painel`, `ads.read`): por conta ligada, mostra o saldo e a previsão de dias (gasto médio dos 7 dias completos), o gasto do período e as campanhas no ar ou com gasto. Períodos: hoje, ontem, 7 dias, 30 dias e este mês.
- **Aba Anúncios do cliente** (`ads.read`, para clientes com serviço de anúncios): a mesma tabela e os anúncios com miniatura, situação, números e o motivo de reprovação.
- **Alertas** (`private.ads_alerts_tick`, 20 min depois de cada sincronização, um aviso por dia por conta e regra, para o tráfego do cliente):
  - saldo para 3 dias ou menos;
  - conta com restrição;
  - campanha ativa sem gasto ontem.
- **Reprovação automática:** anúncio "Reprovado" entra no histórico de reprovações (origem "sincronização", sem formato, com o texto da Meta) uma vez por anúncio, e o aviso existente segue para o tráfego.
- **Ainda não feito nesta parte** (próximas rodadas):
  - limites editáveis por cliente;
  - ~~painel de alertas com reconhecer e resolver (RF-ALE-03)~~ (feito: ver "Painel de alertas");
  - fadiga de criativo, que precisa da frequência de 7 dias por anúncio;
  - CPL acima da meta, que depende das metas (RF-T2-04);
  - ~~números por criativo na biblioteca (RF-BIB-03)~~ (feito: ver "Performance por criativo na biblioteca");
  - ~~checklist já preenchido~~ (feito: ver "Checklist diário já preenchido");
  - ~~páginas e Instagram~~ (feito: ver "Páginas e Instagram dos clientes").

## WhatsApp por QR Code com WAHA (17/11/2026)
Decisão do Henrique: WAHA, para usar os grupos que a Extend já tem. Por enquanto roda no Docker da máquina dele e depois vai para uma VPS da Extend. Todo o resto roda no sistema.
- **Infra** (`infra/waha`): contêiner `extend-waha` em `127.0.0.1:3032`, separado do WAHA do HubSystem; volumes próprios; chave em `infra/waha/.env`, fora do Git. O túnel (`extend-waha-tunnel`, Cloudflare Quick Tunnel, perfil `tunnel`) deixa o sistema publicado alcançar a máquina. O endereço muda quando o túnel reinicia. Passo a passo e ida para a VPS no `infra/waha/README.md`.
- **Configurações › WhatsApp** (`integrations.manage`, só o admin):
  - endereço e chave do servidor: a chave é conferida antes de salvar e fica cifrada no banco; trocar para a VPS não exige deploy;
  - conectar o número por QR Code (atualiza sozinho) ou por código de 8 letras;
  - situação da conexão;
  - grupos do número, cada um ligado ao cliente dele, e um marcado como "alertas internos";
  - mensagem de teste e os últimos envios.
- **Eventos do WAHA:** chegam em `/api/whatsapp/webhook/{conexão}`, assinados com HMAC-SHA512 por um segredo da conexão. Atualizam a situação (conectado, caiu) e gravam as mensagens em `whatsapp_messages`, base da futura caixa de entrada (`inbox.read`).
- **Alertas no grupo** (RF-ALE-02): a cada 5 minutos (`extend-whatsapp-alertas`, job `whatsapp-alerts`), os alertas de anúncios das últimas 2 horas vão para o grupo de alertas internos, um por alerta, mesmo que tenham avisado várias pessoas. Cada envio fica em `whatsapp_outbox`; a falha aparece na tela e na conexão.
- **Retenção:** mensagens por 1 ano e envios por 90 dias.
- **Grupo de relatórios** (decisão do Henrique): todos os relatórios dos clientes vão para **um grupo interno**, e o gestor encaminha manualmente a cada cliente. Em Configurações › WhatsApp, um grupo marcado como "Relatórios", que pode ser o mesmo dos alertas.
  - **Automático:** toda segunda às 9h (`extend-whatsapp-relatorios`, job `whatsapp-reports`), relatório da semana anterior (segunda a domingo) de cada cliente ativo com conta ligada, só se houve gasto. Um por cliente por semana.
  - **Na hora:** "Enviar relatório" na aba Anúncios do cliente (`ads.manage` no cliente), com o período escolhido na tela.
  - **Texto** (`src/domain/ads/report.ts`): investimento, impressões, cada campanha com gasto, resultado principal, custo por resultado e CTR, e o saldo da conta pré-paga com a previsão de dias.
- **Histórico:** ao ler o QR Code, o servidor carrega as conversas e os grupos do aparelho (`fullSync`).
- **Próximas partes:** ~~modelos de relatório editáveis com variáveis (RF-REL-02), PDF (RF-REL-05)~~ (feitos em 18/11/2026, ver "Modelos de relatório, prévia e PDF") e ~~a caixa de entrada (RF-WPP-03)~~ (feita).

## Metas de anúncios por cliente (17/11/2026)
RF-T2-04, com os números já sincronizados da Meta.
- **Onde:** aba Anúncios do cliente, quadro "Metas de {mês}". Quem otimiza as contas do cliente (`optimization.manage`) define; quem vê os anúncios dele (`ads.read`) acompanha. Regras no banco (`ad_goals`, RLS, gatilho) e testes em `35_metas_anuncios.test.sql`.
- **O que se define por mês** (só o que foi combinado):
  - resultado (leads, conversas, compras ou cliques no link) e a quantidade;
  - investimento;
  - custo máximo por resultado;
  - ROAS mínimo.
- **Progresso** (`src/domain/ads/goals.ts`):
  - o realizado vai até ontem, nas contas ligadas do cliente;
  - a projeção é linear (realizado ÷ dias completos × dias do mês) e só aparece a partir do 3º dia completo;
  - "No ritmo": a projeção chega a 80% da meta; investimento dentro de ±15% do planejado; custo dentro do limite; ROAS acima do mínimo.
- **Avisos** (RF-ALE-01, "CPL acima da meta"): nos dias úteis às 10h (`extend-metas-anuncios`), a partir do 6º dia do mês, o tráfego do cliente recebe "Custo por … acima da meta" e "Ritmo abaixo da meta" (projeção abaixo de 80%). No máximo um de cada por semana. Chegam também ao grupo de alertas do WhatsApp.

## Painel de alertas (17/11/2026)
RF-ALE-03. Cada problema encontrado pelas verificações automáticas vira um alerta com situação, além do aviso no sino.
- **Onde:** `/trafego/alertas` (menu "Alertas", `ads.read`), com as abas Abertos, Reconhecidos e Resolvidos. A aba Anúncios do cliente mostra os alertas em aberto dele.
- **Tipos:** saldo acabando, conta com restrição, sem entrega, anúncio reprovado (só em campanha ativa), custo acima da meta, ritmo abaixo da meta e conexão parada ou vencendo.
- **Situações:**
  - **aberto:** o tráfego do cliente recebe o aviso, no máximo um por dia, como antes;
  - **reconhecido:** alguém está cuidando, e os avisos diários desse alerta param;
  - **resolvido à mão:** com a nota de como foi resolvido; o restante do tráfego do cliente recebe a nota;
  - **resolvido sozinho:** quando a verificação seguinte não encontra mais o problema (saldo recarregado, conta liberada, mês virou…).
- **Condição que continua:** se o problema continuar depois de resolvido à mão, a verificação seguinte abre um alerta novo. Anúncio reprovado é exceção: um alerta por anúncio.
- **Quem pode:** vê quem lê os anúncios do cliente; reconhece e resolve quem cuida do tráfego dele (`ads.manage` no cliente). Alertas de conexão da agência: quem conecta as integrações (`ads.connect`). Regras no banco (`ad_alerts`, `ack_ad_alert`, `resolve_ad_alert`, `raise_ad_alert`, `settle_ad_alerts`) e testes em `36_painel_alertas.test.sql` e `e2e/31-painel-alertas.spec.ts`.
- **Retenção:** resolvidos saem depois de 180 dias.
- **Limites, gasto do dia e fadiga:** ver "Limites dos alertas e fadiga de criativo".

## Limites dos alertas e fadiga de criativo (17/11/2026)
Fecha o RF-ALE-01 ("limites por cliente/conta, com padrão global").
- **Padrão da agência:** botão "Limites padrão" em `/trafego/alertas`, para quem conecta as integrações (`ads.connect`: admin e gerente de tráfego). Sem nada salvo, valem os do sistema: saldo para 3 dias, fadiga com frequência 3,0 e CTR 25% menor, aviso de entrega parada ligado.
- **Por cliente:** botão "Limites dos alertas" na aba Anúncios, para quem cuida do tráfego do cliente (`ads.manage` no cliente). Os limites do cliente substituem o padrão inteiro. "Usar o padrão da agência" apaga os limites próprios. A aba e o painel mostram em uma linha os limites que valem.
- **O que se ajusta:**
  - saldo para N dias (0 desliga) e/ou abaixo de um valor;
  - gasto do dia acima de um valor (regra nova, alerta "Gasto do dia", resolve sozinho no dia seguinte);
  - aviso de campanha ativa sem gasto ontem (liga ou desliga);
  - fadiga: liga ou desliga, frequência mínima e queda mínima do CTR.
- **Fadiga de criativo** (alerta "Criativo cansado", um por anúncio ativo):
  - a sincronização lê da Meta a frequência dos últimos 7 dias completos de cada anúncio (`date_preset=last_7d`, que já vem calculada com o alcance único; somar o alcance diário daria errado). Conferido com as contas reais: a EXTEND - 02 trouxe frequências de 1,66 e 2,19, e a HG BRASIL, parada na semana, nenhuma linha;
  - avisa quando a frequência chega ao limite **e** o CTR dos últimos 3 dias completos fica pelo menos X% abaixo do CTR dos 7 dias anteriores, com no mínimo 1.000 impressões em cada janela;
  - resolve sozinho quando a condição deixa de valer (anúncio pausado ou trocado, CTR recuperado).
- **Regras no banco:** `ad_alert_settings`, `alert_limits`, `save_alert_limits`, `reset_alert_limits` e `set_ad_frequency` (só a sincronização). Testes em `37_limites_alertas.test.sql` e `e2e/31-painel-alertas.spec.ts` (o teste devolve o padrão da agência ao que era).
- **Fadigado na biblioteca:** feito, ver "Performance por criativo na biblioteca".

## Performance por criativo na biblioteca (17/11/2026)
Fecha o RF-BIB-03 e a sugestão de "fadigado" do RF-BIB-02.
- **Ligação criativo ↔ anúncio** (`creative_ads`):
  - cada criativo da biblioteca tem um código (`ref_number`, mostrado como **CR-42**). A nomenclatura padrão (RF-PLA-03) ainda não existe no sistema, e o padrão de nome de anúncio do `docs/02` (`FORMATO_ANGULO_V#`) não identifica um criativo só. Por isso a ligação automática usa o código: a sincronização liga todo anúncio das contas do mesmo cliente que tenha o código no nome (`CR42`, `CR-42`, `cr-0042`; `CR-420` não conta);
  - o tráfego do cliente (ou quem organiza a biblioteca) liga outros anúncios à mão e desliga os que não são do criativo; o desligado fica marcado e o código não o religa.
- **Números** (`creative_performance`, soma dos anúncios ligados em `ad_insights_daily`): investimento, impressões, CTR, CPC, CPM, leads e CPL, conversas e custo por conversa, hook rate (visualizações de 3 s ÷ impressões), hold rate (ThruPlays ÷ impressões; a sincronização passou a ler `video_thruplay_watched_actions`), frequência de 7 dias (a maior entre os anúncios ligados), ROAS e dias no ar (dias com gasto).
  - Período: tudo o que foi sincronizado por anúncio (37 dias na primeira sincronização, depois acumula).
  - **Quem vê:** quem vê o criativo na biblioteca e tem "Ver performance dos criativos" no cliente (tráfego, social media, edição e design dos clientes deles). A gravação vê o criativo, mas não os números.
- **Telas:**
  - biblioteca: código e uma linha de números em cada cartão, e "Ordenar" (maior investimento, maior CTR, menor custo por resultado);
  - página do criativo: seção "Desempenho nos anúncios" com a tabela completa, os anúncios ligados (miniatura, situação, conta e campanha, como foi ligado, frequência) e o "Ligar anúncio".
- **Fadigado (RF-BIB-02):** com alerta "Criativo cansado" em aberto num anúncio ligado, o criativo em teste ou vencedor mostra "Sugestão: fadigado" e o botão "Marcar como fadigado" para quem edita a biblioteca. "Vencedor" sugerido pelo sistema fica para quando houver regra definida (o RF-ALE-01 só define a fadiga).
- **Regras no banco:** `link_creative_ad`, `unlink_creative_ad`, `creative_linked_ads`, `creative_linkable_ads`, `creative_performance` e `sync_link_creatives` (só a sincronização). Testes em `38_performance_criativos.test.sql` e `e2e/32-performance-criativos.spec.ts`.
- **Ainda não feito:** filtro por período e "top criativos do mês" (RF-BIB-04) e os números no relatório de criativos exportado (RF-BIB-05).

## Checklist diário já preenchido (17/11/2026)
Fecha o "pré-preenche com os dados da API" do RF-OTI-01.
- Ao abrir o checklist do dia, o sistema busca os números da última sincronização das contas da Meta ligadas ao cliente e sugere a situação e o comentário de cada item. Só preenche os itens ainda em branco: o que a pessoa já marcou ou salvou não muda. Embaixo de cada item fica "Na sincronização: …".
  - **Saldo e cobrança:** saldo e dias restantes de cada conta pré-paga (gasto médio dos 7 dias completos) e conta com restrição. É problema pelos mesmos limites dos alertas do cliente (dias e/ou valor mínimo).
  - **Anúncios reprovados:** quantos e quais estão reprovados em campanha ativa.
  - **Gasto x orçamento:** gasto de ontem contra a soma do orçamento diário das campanhas ativas (em %). Só vira problema acima do "Gasto do dia acima de" do cliente: a Meta pode gastar até 75% a mais num dia, então a diferença sozinha não é problema.
  - **Entrega:** campanha ativa desde antes de ontem que não gastou ontem; sem campanha ativa, "Não se aplica".
- A caixa no topo diz de quando são os números e avisa se a última sincronização de alguma conta falhou. Cliente sem conta ligada abre vazio com o aviso.
- Leitura com o login da pessoa (a RLS filtra as contas). Regras puras em `src/domain/traffic/prefill.ts` (testes Vitest) e tela em `e2e/33-checklist-preenchido.spec.ts`.

## Páginas e Instagram dos clientes (17/11/2026)
RF-CON-02 ("conectar páginas e Instagram dos clientes via BM da Extend"), sem publicar (RF-CON-03 é a próxima parte).
- **Descoberta** (`social_profiles`): a sincronização (job `social-sync`, 8h05 e 16h05) lê `/me/accounts` de cada conexão ativa da Meta e grava as páginas e o Instagram ligado a cada uma (nome, @, foto, seguidores, nº de publicações). Conexão do Facebook do cliente: o que ele autorizou já fica com o cliente. Página alcançada pelas duas conexões fica com a da agência.
- **Ligar ao cliente:** Configurações › Integrações › "Páginas e Instagram" (admin e gerente de tráfego, `ads.connect`), com "Buscar páginas agora". Ao ligar, a página e o @ entram em "Contas e acessos" do cliente (links rápidos), se ainda não estiverem lá.
- **Aba "Redes sociais" do cliente** (clientes com gerenciamento ou anúncios; quem vê o cliente): perfil, seguidores, publicações e as últimas 9 publicações de cada um (imagem, legenda, data, tipo e link). Há o botão "Atualizar agora".
- **Nenhum token novo guardado:** o token da página é pedido à Meta na hora com o token da conexão (já cifrado).
- **Conferido com a conta real da Extend** (as 2 páginas autorizadas no login, Gastrô e Agência Extend, e os Instagram @gastro_praia e @agencia_extend):
  - Facebook: as publicações vêm (texto, imagem, link e compartilhamentos). Reações e comentários da página pedem uma permissão que o app não tem (erro 10), por isso ficam de fora.
  - Instagram: nome, seguidores e nº de publicações vêm pela página. A **lista de publicações exige a permissão `instagram_basic`**, que não está na configuração do login do app. Até ela entrar, o perfil mostra o motivo em vermelho ("A conexão da Meta não tem a permissão do Instagram…").
- **Para o Instagram funcionar (do lado do Henrique):** no app da Meta, incluir `instagram_basic` na configuração do "Login do Facebook para Empresas" (`META_LOGIN_CONFIG_ID`) e reconectar a Meta em Integrações, marcando as páginas e os Instagram dos clientes. Para clientes fora do BM, usar o Facebook do cliente. O `META_SCOPES` (usado sem `config_id`) já pede `instagram_basic`.
- **Regras no banco:** `save_social_profile`, `can_refresh_social` e RLS de `social_profiles`/`social_posts`. Testes em `39_paginas_instagram.test.sql` e `e2e/34-paginas-instagram.spec.ts`.

## Pedido do Henrique de 17/11/2026: tráfego Meta + Google, publicações e atendimento
Decisões dele: atendimento e funis **da própria Extend** (caixa de entrada do WhatsApp da Extend ligada ao Comercial); gestão de campanhas só com **ajustes do dia a dia** (sem criar campanha pelo sistema); ordem: 1) tráfego Meta + Google, 2) programar publicações (Feed, carrossel, Reels, Stories, vídeo), 3) atendimento e funis.
- **Depende do Henrique:** chaves do Google Cloud da Extend (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, passo a passo entregue; a Google Ads API já está ativada no projeto "Agencia Extend") e as permissões `ads_management`, `pages_manage_posts`, `instagram_basic` e `instagram_content_publish` na configuração do login do app da Meta, com reconexão. Para clientes de fora conectarem o Facebook, o app precisa passar pela análise da Meta.

## Ajustes das campanhas da Meta pelo sistema (17/11/2026)
- **O quê:** botão "Ajustar" em cada campanha (painel do tráfego e aba Anúncios do cliente), com um diálogo:
  - pausar ou ativar;
  - orçamento diário da campanha ou, se o orçamento for dos conjuntos, de cada conjunto;
  - renomear;
  - duplicar (com conjuntos e anúncios; a cópia nasce pausada).
  Na aba Anúncios, cada anúncio tem "Pausar" ou "Ativar". Há um campo de motivo opcional.
- **Quem pode:** o tráfego do cliente (`ads.manage` no cliente), e só em contas ligadas cuja conexão está ativa e tem `ads_management` (`ad_accounts_manageable`). Sem a permissão, o botão não aparece.
- **Na Meta:** POST na Graph API com `locale=pt_BR`, para a Meta explicar o motivo em português (ex.: orçamento abaixo do mínimo). Se a Meta recusar, nada muda no sistema e o motivo aparece no diálogo.
- **Histórico:** todo ajuste aceito entra no registro de alterações do cliente como "feita pelo sistema", com quem fez e o motivo (`record_ad_change`; `change_logs.source = 'sistema'`, que só essa função consegue gravar).
- **Testado:** `40_gestao_campanhas.test.sql`, Vitest dos textos e erros, e `e2e/35-gestao-campanhas.spec.ts`. O E2E usa uma conexão de teste com token inválido: a Meta recusa de verdade e a tela mostra o motivo. **A alteração aceita pela Meta só pode ser conferida quando a conexão real tiver `ads_management`.**

## Programar publicações no Facebook e no Instagram (17/11/2026)
RF-CON-03 e RF-CON-04.
- **Onde:** cliente › Redes sociais › "Programação" (botão "Programar publicação"); agenda geral em `/publicacoes` (Próximas, Com erro, Publicadas; menu Produção); no cronograma do mês, "Publicar nas redes" abre a programação já com a legenda, o formato e a data do conteúdo.
- **Quem:** "Programar e publicar nas redes" (`content.publish`: admin, coordenação de conteúdo e social media dos clientes dela). Vê a programação quem tem também `content.read`.
- **Formatos:** Feed (1 a 10 imagens; mais de uma vira carrossel), Reels, Vídeo e Stories (uma imagem ou um vídeo, sem legenda). Mídia por arquivo (JPG, PNG, MP4 ou MOV até 50 MB, bucket `publicacoes`) ou link do Drive (arquivo aberto para qualquer pessoa). No Instagram valem 2.200 caracteres e 30 hashtags. A mesma publicação pode ir para a página e o Instagram juntos.
- **Perfis prontos:** só perfis cuja conexão da Meta está ativa e tem as permissões. Facebook: `pages_manage_posts` e `pages_read_engagement`. Instagram: `instagram_basic` e `instagram_content_publish`. O diálogo mostra o que falta em cada perfil, e o banco recusa (`publish_targets`, `schedule_post`).
- **Fila** (job `publish-posts` a cada 5 minutos):
  - a Meta baixa a mídia por link assinado (1 hora) ou do Drive;
  - no Instagram, o vídeo pode levar mais de uma rodada para processar (até 8);
  - publicação interrompida no meio sem contêiner não é refeita, para não duplicar o post: vira erro com "confira no perfil";
  - publicada ou com erro, avisa quem programou (tipo de aviso `post`);
  - publicada a partir do cronograma, o link vai para o conteúdo (`task_content.post_url`).
- **Cancelar e reagendar:** cancelar a agendada ou a com erro; reagendar a agendada, a com erro ou a cancelada (volta para a fila).
- **Testado:** `41_publicacoes.test.sql`, Vitest das regras e `e2e/36-publicacoes.spec.ts`, que programa com envio do arquivo, roda a fila e recebe a recusa real da Meta (conexão de teste com token inválido).
- **Pendente do lado da Extend:** a conexão real (usuário do sistema "Sistema-Extend") ainda não tem `pages_manage_posts`, `instagram_basic` e `instagram_content_publish`. Sem elas, os perfis aparecem como "falta …" e nada sai. Também é preciso atribuir ao usuário do sistema as páginas e os Instagram dos clientes (hoje são 2 páginas).

## Atendimento da Extend: caixa de entrada do WhatsApp (17/11/2026)
RF-WPP-03, como o Henrique decidiu: o atendimento é da própria Extend, ligado ao Comercial.
- **Conversas** (`wa_conversations`): toda mensagem de contato que chega ao número da Extend pelo WAHA (`whatsapp_messages`) vira ou atualiza uma conversa. Desde 18/11 os grupos também entram (ver a seção seguinte).
  - Cada conversa guarda telefone, nome do WhatsApp, última mensagem, não lidas, "aguardando resposta", responsável, aberta ou encerrada e o lead ligado.
  - O contato escrever de novo reabre a conversa encerrada.
- **Telas:**
  - `/atendimento` (menu Comercial): abas Abertas, Aguardando resposta, Minhas e Encerradas, com contagem; aviso quando o WhatsApp da Extend não está conectado; atualiza ao vivo pelo Realtime;
  - `/atendimento/[id]`: mensagens, resposta (Enter envia, Shift+Enter quebra a linha), responsável, encerrar ou reabrir, e o lead.
- **Lead:** "Criar lead no funil" cria o lead no início do funil padrão, com origem WhatsApp, o telefone e o responsável da conversa como dono. Lead com o mesmo telefone é ligado sozinho, inclusive quando é cadastrado depois no Comercial.
- **Avisos** (tipo `inbox`): conversa nova sem responsável vai para quem responde o atendimento; conversa reaberta vai para o responsável; conversa passada para alguém vai para essa pessoa.
- **Permissões:** ver (`inbox.read`), responder, encerrar e assumir (`inbox.reply`): papéis Comercial, Atendimento e admin. Criar lead pede também `crm.leads.manage`.
- **Resposta:** sai pelo WAHA. Antes de enviar, confere se a sessão está conectada. A mensagem entra na conversa na hora, com o mesmo id que o webhook manda, então não duplica.
- **Testado:** `42_atendimento.test.sql`, Vitest e `e2e/37-atendimento.spec.ts`. O E2E roda só local, com o WAHA da `infra/waha`, e não mexe numa conexão real: mensagem pelo webhook assinado, leitura, resposta recusada pelo WAHA (sessão de teste), lead criado e conversa encerrada.
- **Para usar de verdade:** ligar o túnel (`docker compose --profile tunnel up -d` em `infra/waha`), salvar o endereço em Configurações › WhatsApp e ler o QR Code com o número da Extend. Mídia: ver a seção "Fotos, áudios, vídeos e documentos no Atendimento" (18/11).

## Atendimento como no HubSystem: conectar com um clique e compilar conversas (18/11/2026)
Pedido do Henrique: "só conectando, abre o QR Code, escaneia e já faz toda a conexão; um botão para compilar as mensagens, na mesma esquematização do HubSystem".
- **Servidor já configurado:** a `WAHA_API_KEY` está na Vercel (secreta). O endereço vem sozinho: o contêiner `extend-waha-anuncio` (perfil `tunnel` do `infra/waha/compose.yaml`) lê o endereço do túnel e avisa `POST /api/whatsapp/servidor`, assinado com HMAC-SHA256 pela chave e com horário (vale 5 minutos). O sistema só troca o endereço se o WAHA responder nele com a chave. Na VPS, `WAHA_URL` fixa faz o mesmo papel. O formulário manual ficou recolhido em "Servidor do WhatsApp" (Configurações).
- **Conectar WhatsApp** (no Atendimento e em Configurações, para `inbox.manage` ou `integrations.manage`, ou seja, Comercial e admin): um clique, e o QR Code aparece e se renova sozinho (gera outro se expirar, até 3 vezes). Também dá para conectar com o código de 8 letras. Conectado, o mesmo diálogo passa para a compilação. Desconectar continua só para o admin.
- **Compilar conversas** (`wa_imports` + `wa_import_chat`, adaptado de `src/lib/whatsapp-import.ts` do HubSystem):
  - traz conversas individuais e/ou grupos, com até 500 mensagens recentes de cada; a mídia antiga vira aviso, sem o arquivo;
  - roda em etapas: a tela chama de novo até terminar e o relógio do banco (`extend-whatsapp-compilar`, a cada minuto, só quando há compilação na fila) continua com a tela fechada;
  - faz 3 passadas (2 e 5 minutos depois) porque o aparelho manda o histórico aos poucos;
  - não avisa conversa por conversa (`extend.wa_import`) e avisa quem compilou ao terminar;
  - conversa parada há mais de 30 dias entra encerrada; contato que falou por último nos últimos 3 dias entra "aguardando"; o lead é ligado pelo telefone;
  - quem tem id oculto (@lid) tem o telefone buscado no WAHA;
  - se o número foi conectado sem guardar o histórico, oferece "Conectar de novo e trazer tudo".
- **Grupos no Atendimento:** nova aba Grupos. A prévia mostra quem escreveu e a conversa mostra o nome de cada pessoa. No lugar do lead aparece o cliente ligado ao grupo. Grupo novo não avisa ninguém; reaberto avisa só o responsável. Grupo desconhecido entra em `whatsapp_groups` e o nome de "Buscar grupos" passa para a conversa.
- **Testado:** `43_whatsapp_compilar.test.sql` (14), Vitest (`domain/whatsapp/history`) e `e2e/38-whatsapp-compilar.spec.ts` (local). O E2E cobre:
  - o aviso do túnel, recusando assinatura errada e aviso vencido;
  - o QR Code real do WAHA local, aberto pela pessoa do Comercial;
  - a compilação contra um servidor de teste que responde como o WAHA: 1 conversa, 1 grupo e 3 mensagens no Atendimento.
- **Pendente do lado do Henrique:** rodar uma vez `docker compose --profile tunnel up -d` em `infra/waha` (com o Docker aberto) e ler o QR Code. A leitura real e a compilação com o celular de verdade só podem ser conferidas com o número conectado.

## Fotos, áudios, vídeos e documentos no Atendimento (18/11/2026)
Adaptado do HubSystem (`domain/whatsapp/media.ts`, `api/whatsapp/media`, `composer-tools.tsx`).
- **Recebida:** o arquivo do WAHA expira em 1 hora (`WHATSAPP_FILES_LIFETIME`). Por isso o webhook baixa a mídia na hora e guarda no armazenamento privado `whatsapp-midia`, uma vez só por mensagem. A mensagem guarda `media_path`, `media_mime` e `media_name`. Se o download falhar, a mensagem entra assim mesmo, sem o arquivo.
- **Na conversa:** foto (abre em tamanho real), player de áudio e de vídeo, documento para baixar. A prévia da lista diz o tipo: [foto], [áudio], [vídeo], [documento] ou [figurinha]. A mídia do histórico compilado aparece como "Foto antiga: abra no WhatsApp para ver".
- **Quem vê:** `/api/whatsapp/midia/[id]` lê a mensagem com o login da pessoa (RLS do Atendimento) e só então entrega o arquivo. Só serve tipos conhecidos, com `nosniff` e CSP `sandbox`. O armazenamento não tem nenhuma regra de leitura ou envio direto.
- **Enviar:**
  - o clipe anexa foto JPG/PNG (5 MB), vídeo MP4 (16 MB), áudio (16 MB) ou documento PDF/Word/Excel/PowerPoint/texto (50 MB); o texto vira a legenda;
  - o microfone grava até 5 minutos e envia ao parar, como mensagem de voz;
  - o arquivo sobe do navegador direto para o armazenamento, por um link de envio criado pelo servidor;
  - o WAHA baixa o arquivo por um link assinado de 1 hora.
- **Corrigido:** o cabeçalho `Permissions-Policy` bloqueava o microfone em todo o site. Agora vale `microphone=(self)`.
- **Testado:** `44_whatsapp_midia.test.sql` (8), Vitest (`domain/whatsapp/media`) e `e2e/39-atendimento-midia.spec.ts`. O E2E roda local, com um servidor de teste no formato do WAHA, e cobre:
  - a foto recebida pelo webhook assinado, que aparece na conversa, enquanto quem não atende recebe 403;
  - o PDF com legenda, baixado pelo "WhatsApp" pelo link temporário;
  - o tipo recusado;
  - o áudio gravado com o microfone de teste do navegador e enviado como voz.
- **Só com o número conectado:** a foto real chegando do celular e o áudio tocando no WhatsApp do contato.

## Pedir novo criativo a partir do anúncio (18/11/2026)
RF-CRI-08. O botão "Pedir novo criativo" aparece para quem pede criativos (`creatives.request.create`):
- no alerta de criativo cansado, no painel de alertas e na aba Anúncios do cliente;
- em cada anúncio da aba Anúncios (cliente ativo ou em onboarding);
- no anúncio ligado e cansado, na página do criativo.

Ele abre `/criativos/novo?anuncio={id}`. O anúncio é lido com o login da pessoa (RLS das contas). O pedido já vem com:
- o cliente da conta;
- a campanha e o objetivo (traduzido do objetivo da Meta);
- o formato e o ângulo do criativo ligado ("Nova versão: …");
- o link do anúncio no Gerenciador de Anúncios como referência;
- prioridade alta se houver fadiga aberta;
- uma observação com o código do criativo e a frequência.

Público, CTA e prazo ficam com a pessoa. O pedido guarda `source_ad_ref` (`meta:{id do anúncio}`), e a página do criativo mostra "Pedido a partir do anúncio …". Se o anúncio não abrir (sem acesso, removido ou cliente inativo), o pedido abre em branco com o aviso.

Testado em `src/domain/creatives/from-ad.test.ts` e `e2e/40-criativo-do-anuncio.spec.ts`.

## Modelos de relatório, prévia e PDF (18/11/2026)
RF-REL-02, RF-REL-03 e RF-REL-05.

**Modelos** (`report_templates`, em Configurações › Relatórios):
- Texto de WhatsApp com variáveis: `{cliente}`, `{periodo}`, `{investimento}`, `{impressoes}`, `{cliques}`, `{ctr}`, `{cpc}`, `{cpm}`, `{leads}`, `{cpl}`, `{conversas}`, `{custo_conversa}`, `{compras}`, `{roas}`, `{saldo}`, `{dias_saldo}`, `{top_criativo}` e `{campanhas}` (a lista das campanhas, em várias linhas).
- As variáveis entram por botões, e a prévia usa números de exemplo. Variável desconhecida não salva.
- **Linha com variável sem valor some.** Exemplos: o saldo de uma conta pós-paga, o CPL sem leads. Assim um modelo serve a clientes diferentes.
- CPL e custo por conversa usam o gasto das campanhas daquele objetivo. Se não houver nenhuma, usam o gasto total.
- `{top_criativo}` é o anúncio com mais resultados no período; no empate, o de menor custo por resultado. Impressões não contam.
- A agência nasce com "Relatório padrão", o mesmo texto de antes, com cliques, CTR e destaque. Só existe um padrão: ele não é excluído e não perde a marca sem outro no lugar. O nome não pode repetir.
- **Quem edita:** quem tem "Configurar relatórios" para todos os clientes (`reports.manage` = all: admin e gerente de tráfego). O gestor lê os modelos.

**Modelo do cliente** (`client_report_settings`): é escolhido no diálogo "Relatório" da aba Anúncios por quem configura os relatórios do cliente. Vale também para o envio automático. Ao excluir um modelo, os clientes que o usavam voltam ao padrão.

**Diálogo "Relatório"** (aba Anúncios, para quem vê os anúncios):
- período: começa em "Semana passada", e há também hoje, ontem, 7 dias, 30 dias e este mês;
- prévia com os números reais que a pessoa vê (RLS);
- "Baixar PDF";
- "Enviar no WhatsApp" para o grupo de relatórios (`ads.manage`). Ele substitui o antigo botão "Enviar relatório".
- Sem gasto no período: avisa e não envia nem gera PDF.

**PDF** (`/clientes/{id}/anuncios/relatorio?periodo=…`, `@react-pdf/renderer`):
- marca da Extend: logo, faixa azul e dourada, fontes Outfit e Inter;
- indicadores do período (os de leads, conversas e compras só aparecem quando houver);
- destaque, tabela de campanhas por conta e saldo das contas pré-pagas;
- rodapé com a data de geração e as páginas.

Os números são lidos com o login da pessoa: quem não vê o cliente recebe 404.

**Testes:**
- `45_modelos_relatorio.test.sql` (14);
- Vitest: `domain/ads/report` e `features/ads/pdf`;
- `e2e/41-modelos-relatorio.spec.ts`: criar o modelo com os botões, a prévia real, escolher o modelo do cliente, o PDF, e o envio a um servidor de teste no formato do WAHA;
- `e2e/29` atualizado.

**Depois:** ~~RF-REL-06 e o envio diário ou mensal (RF-REL-01)~~ (feitos em 18/11/2026, ver "Agenda do relatório e PDFs guardados").

## Agenda do relatório e PDFs guardados (18/11/2026)
RF-REL-01 e RF-REL-06.

**Agenda por cliente** (`client_report_settings`: `frequency`, `month_day`, `send_hour`; RPC `set_client_report_schedule`):
- no diálogo "Relatório" da aba Anúncios, quadro "Envio automático no grupo de relatórios", para quem configura os relatórios do cliente (os demais veem a agenda em texto);
- frequências: não enviar sozinho; todo dia (dia anterior); toda segunda (semana passada, o padrão); todo mês no dia 1 a 28 (mês passado);
- horário das 6h às 22h (padrão 9h). Voltar ao modelo padrão não apaga a agenda.

**Job** (`extend-whatsapp-relatorios`, agora `5 * * * *`, `sendScheduledReports`):
- de hora em hora, pega os clientes ativos com conta ligada cuja frequência cai hoje e cujo horário já chegou (`src/domain/ads/report.ts`: `spClock`, `scheduleDue`, `scheduleRange`, `scheduleKey`);
- o registro de envios (`whatsapp_outbox.dedupe_key`) impede repetir o mesmo período; a semanal mantém a chave antiga;
- um cliente por vez, com 3 s entre os envios; o que não couber em ~45 s sai na hora seguinte.

**PDF junto e guardado** (`ads_report_files`, bucket privado `relatorios`):
- todo envio (botão ou automático) manda o texto e, logo abaixo, o PDF como documento (o WAHA baixa por link assinado de 1 h);
- o PDF fica guardado, um por cliente e período (reenviar substitui), e aparece na aba Relatórios do cliente em "PDFs dos relatórios de anúncios" (período, tipo, quando e quem enviou, baixar);
- download por `/clientes/{id}/relatorios/pdf/{arquivo}`: a linha é lida com o login da pessoa (vê quem vê os anúncios do cliente ou configura os relatórios dele); o arquivo sai pelo servidor;
- se o texto foi e o PDF falhou, o envio vale e a mensagem avisa.

**Testes:** `46_relatorios_agenda_pdf.test.sql` (12); Vitest da agenda em `domain/ads/report`; `e2e/41` (passo 4): agendar pela tela, o job manda texto e PDF uma vez só, a aba Relatórios lista e baixa, quem não vê anúncios recebe 404.
