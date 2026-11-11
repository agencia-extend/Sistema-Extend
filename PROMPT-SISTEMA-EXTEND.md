# PROMPT MESTRE — Sistema Operacional da Agência Extend

> **Como usar:** abra o Claude Code numa pasta **nova e vazia** (ex.: `D:\MEU SERVIDOR\Extend - Sistema`) e cole este documento inteiro como primeira mensagem. Ele foi montado a partir de três fontes: (1) a gravação da reunião de briefing de 10/11/2026 com a equipe da Extend, (2) o PDF "Briefing: Sistema de Gestão — Tráfego Pago" apresentado pelo Luiz na reunião e (3) a análise técnica do HubSystem (`D:\MEU SERVIDOR\HubSystem - Sistema`), que serve de **referência de código**, não de base para copiar inteira.
>
> Os itens marcados com **[CONFIRMAR]** são pontos que a reunião deixou em aberto ou que a transcrição automática não deixou claros. Resolva-os com a Extend antes da fase em que aparecem.

---

## 0. Papel e regras de trabalho para o Claude

Você é o engenheiro full-stack responsável por construir **do zero** um sistema interno para a **Extend Agência** (agência de marketing: tráfego pago, produção de conteúdo, gerenciamento de redes sociais, vídeo, design, gravação e sites). O sistema será usado pelos sócios e funcionários da Extend e, numa fase posterior, terá uma área de visualização para os clientes da agência.

Regras inegociáveis:

1. **Infraestrutura 100% da Extend.** Supabase, Vercel, app da Meta, projeto do Google Cloud, conta do Google Ads (MCC), número de WhatsApp e domínio ficam **nas contas da Extend**. Nada pode depender de contas pessoais do desenvolvedor. Todas as chaves ficam em variáveis de ambiente da Extend; nunca comite segredos.
2. **Projeto novo.** O HubSystem é referência de padrões e de trechos de código (principalmente a pasta `src/lib/ads/`, o modelo de permissões com RLS e o fluxo de aprovação por link). Leia os arquivos citados antes de reaproveitar, adapte-os ao domínio da Extend e não traga módulos que a Extend não usa (financeiro pessoal, avaliações Google, Stripe, prospectador local em Docker).
3. **Construa por fases e por lógica.** Cada fase termina utilizável e testada antes da próxima. Antes de codar cada fase, mostre o plano (tabelas, telas, permissões) e espere aprovação.
4. **Interface:** carregue a skill `frontend-design` antes de desenhar qualquer tela e rode a skill `web-design-guidelines` ao final de cada fase, corrigindo o que ela apontar. Português do Brasil em toda a interface, UTF-8 desde a primeira migration, datas no fuso `America/Sao_Paulo`, valores em centavos (`bigint`).
5. **Mobile-first de verdade.** A equipe vai usar no celular (notificações push, tarefas do dia, aprovação). Entregue como PWA instalável; app nativo nas lojas fica para depois.
6. **Pergunte quando houver ambiguidade de regra de negócio.** Não invente fluxo de agência; use as seções abaixo.

---

## 1. Contexto: por que este sistema existe

**Objetivo (nas palavras do briefing):** dar à agência inteira uma visão única do que está rodando, do que está travado e do que depende de cada setor. A prioridade é a **ponte entre tráfego e mídias (criativos)**.

**Dores atuais que o sistema precisa eliminar:**

- Criativo pedido por WhatsApp ou áudio, sem briefing completo, gerando retrabalho.
- O setor de mídias não sabe se o que produziu performou.
- Ninguém sabe em que etapa está cada criativo/conteúdo.
- Histórico e decisões ficam na cabeça de quem gerencia a conta.
- Relatório montado à mão toda semana (hoje uma pessoa faz isso manualmente).
- Informações do fechamento comercial e do onboarding se perdem em grupos de WhatsApp lotados.
- Ferramentas espalhadas: Trello (um quadro por cliente + quadros por setor), planilha "Controle de clientes", planilha de controle de mídias/entregas do mês, Google Drive, Google Agenda, grupos de WhatsApp.

**Prazo combinado:** primeira versão utilizável **até o fim de novembro/2026**, para a equipe começar a usar no início de dezembro. Janeiro/2027 é o mês de implantação com os clientes (área do cliente, aprovação).

---

## 2. Pessoas, setores e papéis

### Setores da Extend
| Setor | Macro-área | O que faz |
|---|---|---|
| Administrativo / Comercial | Gestão | Vende, fecha contrato, define serviços contratados, enxerga tudo |
| Tráfego pago | Tráfego | Meta Ads e Google Ads, relatórios, otimização, alertas |
| Conteúdo (planejamento) | Criação de conteúdo | Briefing, planejamento mensal, roteiros, distribui demandas |
| Gerenciamento (social media) | Criação de conteúdo | Programa e publica nas redes dos clientes |
| Edição de vídeo | Criação de conteúdo | Recebe vídeo bruto + roteiro, entrega editado |
| Design | Criação de conteúdo | Artes, carrosséis, criativos estáticos |
| Gravação | Criação de conteúdo | Agenda e executa gravações |
| Sites | Criação de conteúdo | Desenvolvimento de sites |

### Pessoas citadas na reunião **[CONFIRMAR nomes, e-mails e funções]**
- **Jorge e Fernando** — sócios / administradores gerais (acesso total). Jorge também é o comercial que fecha contratos.
- **Luiz** — gestor de tráfego principal (vê todos os clientes de tráfego) e autor do briefing de tráfego.
- **Segundo gestor de tráfego** (nome soou como "Ben-Hur") — vê apenas os clientes em que foi marcado (ex.: só Google Ads de 3–4 clientes).
- **Jacqueline (Jacque)** — coordena conteúdo/mídias, faz onboarding e briefing, distribui demandas.
- **Joana** — conteúdo/planejamento, entrou recentemente.
- **Madu** — gerenciamento (publicação nas redes dos clientes).
- **Priscila / Juliana** — edição de vídeo.
- **Júlia** — hoje monta relatórios manualmente (função que será automatizada).

### Modelo de acesso
- Login individual por funcionário (e-mail + senha, com opção Google). Entrada **somente por convite** do administrador.
- O **administrador** cria papéis e decide, por papel e por usuário, o que cada um pode ver e fazer (módulo → recurso → ação, com escopo `próprio | equipe/cliente | todos`).
- **Regra de visibilidade central:** o funcionário só vê os clientes em que está marcado como responsável (tag) e só as abas do seu setor. Ex.: de 20 clientes, 5 têm "Gerenciamento" → a Madu vê só esses 5.
- O editor de vídeo não vê o que o outro editor está fazendo, a menos que tenha permissão de visão do setor.
- Papéis iniciais sugeridos: Administrador, Coordenação de Conteúdo, Gestor de Tráfego, Social Media, Editor de Vídeo, Designer, Gravação, Sites, Comercial, Somente leitura, e (fase 3) Cliente.
- Recursos de segurança: tela "Ver como" usuário, auditoria de alterações, trava contra autoelevação de permissão.

---

## 3. Conceito central: o CLIENTE é o pilar

Tudo nasce do cliente. A jornada real da Extend (fluxograma "Fluxograma Extend – Clientes" no Miro) é:

```
Venda e contrato (Jorge/Fernando)
  → Onboarding (Jacqueline/Luiz)
      1. Repasse para a Jacque da data e dos serviços vendidos  [objetivo: registrar no "Controle de clientes"]
      2. Criação do grupo no WhatsApp (cliente + equipe)          [canal principal de comunicação]
      3. Agendar reunião de briefing                              [o mais rápido possível]
  → Reunião de planejamento (Luiz/Jacqueline)
      - Setor Mídias apresenta: obrigações do cliente, plano de escala, planejamento de conteúdo
        → saída: planejamento aprovado + gravação agendada
      - Setor Tráfego apresenta: como funciona o tráfego, modelos de campanha, divisão de orçamento,
        definição de públicos, performance de criativos teste
        → saída: planejamento aprovado + nova campanha definida
  → Execução mensal por setor → Relatórios → Renovação
```

**Serviços vendidos** (viram "pilares"/tags do cliente): Facebook Ads, Google Ads, Treinamento Comercial, Pacote de Vídeos, Conteúdo Mensal, Gerenciamento, Sites **[CONFIRMAR lista completa]**.

### Regras que o sistema deve aplicar
1. **Fechamento comercial → onboarding automático.** O comercial (Jorge) cadastra o fechamento no sistema (cliente, serviços, valores, prazos prometidos, observações, prints/documentos da negociação). Isso cria o cliente com status `onboarding` e notifica os responsáveis pelo onboarding. Promessas comerciais (ex.: "entregar X em 5 dias") ficam registradas e visíveis.
2. **Onboarding obrigatório.** O ambiente do cliente só libera as demais abas quando a ficha de onboarding estiver completa (campos obrigatórios + checklist). Apenas os papéis principais (sócios, Luiz, Jacque, Joana) veem a ficha completa.
3. **O onboarding define a estrutura do cliente.** Os serviços e quantidades preenchidos geram automaticamente as abas e os "slots" de demanda:
   - "Tem tráfego pago?" → libera a aba Tráfego.
   - "Quantos vídeos por mês? 4" → cria 4 cards de vídeo por mês de contrato na aba Vídeos.
   - "Quantos designs por mês? 4" → cria 4 cards de design por mês.
   - "Gerenciamento?" → o cliente aparece para o social media marcado.
4. **Responsável marcado = demanda na mão da pessoa.** Ao marcar alguém como responsável de um card/etapa, a demanda aparece automaticamente em "Minhas tarefas" dessa pessoa, com notificação (sistema + push). Ao mudar a etapa, o responsável muda conforme o fluxo (ex.: roteiro → gravação → edição → aprovação → publicação).
5. **Duas visões sempre:** (a) **ambiente do cliente** — tudo daquele cliente; (b) **visão do setor** — todos os clientes juntos, filtrável (ex.: "edição: 15 vídeos no mês, 5 atrasados, de quais clientes").

---

## 4. Módulos

Legenda de fase: **F1** = MVP (fim de novembro) · **F2** = segunda leva (dezembro) · **F3** = implantação com clientes e extras (janeiro em diante).

### 4.1 Autenticação, usuários e permissões — F1
- Login, recuperar senha, convite por link (token de uso único, 7 dias, guardado como hash), "manter conectado".
- Tela de papéis e permissões (matriz módulo × ação), overrides por usuário, setores e squads, auditoria.
- Base técnica: reaproveitar o modelo do HubSystem (`src/domain/permissions/index.ts`, funções `private.has_perm()` / `perm_scope()` / `can_read_client()` nas migrations de fundação, `src/lib/auth/dal.ts`, `src/lib/actions.ts → defineAction`).

### 4.2 Clientes — F1
**Cadastro central de clientes e contas** (do briefing do Luiz):
- Cliente, segmento/nicho, responsável no tráfego, responsável nas mídias, status (`onboarding | ativo | pausado | encerrado`).
- Datas de início e fim do contrato, serviços contratados com quantidades mensais, verba mensal contratada, data de renovação, canal de comunicação com o cliente, forma de pagamento.
- Dados da conta: BM, conta de anúncio, página, Instagram, pixel/dataset, número de WhatsApp, links (site, Drive do cliente).

**Ficha de briefing (onboarding):** oferta, público, região, diferenciais, objeções comuns, objetivo (lead, WhatsApp, visita ao perfil, venda), restrições de política da Meta (estética, saúde e finanças mudam o que a mídia pode produzir), identidade visual, tom de voz, materiais autorizados, arquivos complementares.

**Ambiente do cliente** (abas aparecem conforme serviços e permissão):
- Visão geral: status, % do contrato concluído, etapa da jornada, próximos prazos, atrasos.
- Ficha/onboarding.
- **Timeline de reuniões:** cada reunião com data, pauta/resumo, anexo (ata ou gravação).
- **Demanda mensal** (o substituto da planilha de controle de mídias): contratado × entregue no mês, por tipo, por responsável, com status.
- Conteúdo (planejamento/cronograma), Vídeos, Design, Gravação, Site — quadros Kanban do cliente.
- Banco de ideias e referências.
- Tráfego: campanhas ativas e desempenho do que está rodando agora (somente para quem tem permissão).
- Registro de decisões e de aprovações de verba (F2).
- Arquivos (links do Drive — ver 4.12).

**Visão geral de clientes:** grade de cards por cliente com barra de progresso (onboarding pendente, % do contrato entregue, setor/etapa atual), filtros por ativos, inativos, em onboarding, período (7/30/90 dias/personalizado), serviço e responsável.

### 4.3 Tarefas e fluxos de produção (o "Trello" da Extend) — F1
- Quadros Kanban com colunas configuráveis, por cliente e por setor. Arrastar e soltar.
- Card: cliente, tipo de demanda (vídeo, design, roteiro, post, site, criativo de tráfego…), título, descrição, responsável(eis), prazo, prioridade, checklist, anexos/links, comentários, tags com cor (criadas na hora), histórico.
- **Registro de tempo:** início/fim de cada etapa fica salvo (ex.: "edição levou 1h30") e aparece na agenda da pessoa.
- Fluxo padrão de conteúdo **[CONFIRMAR etapas com a Jacque]**: Ideia/Roteiro → Gravação → Edição → Revisão interna → Aprovação do cliente → Programado → Publicado. A cada mudança de etapa o responsável muda e a pessoa é notificada.
- "Minhas tarefas" (hoje, atrasadas, da semana) e visão do setor com filtros por cliente, tipo, responsável, status e período.
- Notificações no sistema + push em cada evento relevante (atribuído, mudou de etapa, comentado, prazo chegando, atrasou).
- Referência: `features/tasks/*` e tabelas `tasks`, `task_boards`, `task_columns`, `task_checklist_items`, `task_comments` do HubSystem.

### 4.4 Solicitação de criativos (Tráfego → Mídias) — F1 · **módulo mais importante**
- Formulário padronizado de pedido: cliente, campanha, objetivo, formato (imagem, vídeo, story, carrossel), ângulo/mensagem, público, CTA, referências, prazo e prioridade. Pedido incompleto não é enviado.
- Quadro de status: `solicitado → em produção → em revisão → aprovado → entregue → no ar`.
- Aprovação interna e do cliente registrada, com versões (v1, v2…).
- Notificação automática para o gestor de tráfego quando o criativo fica pronto, e para a mídia a cada mudança.
- Botão no painel de anúncios: "Pedir novo criativo" a partir de um criativo saturado (pré-preenche cliente, campanha e referência).

### 4.5 Biblioteca de criativos — F1
- Todo criativo vinculado a cliente, campanha, formato e ângulo, com a copy usada (texto principal, título, descrição).
- Status: em teste, vencedor, fadigado, reprovado pela Meta.
- **Feedback de performance para a mídia:** cada criativo mostra seus números (CTR, CPL, hook rate etc.) puxados da API, para a mídia produzir com base em dado.
- **Definição das métricas** (calcular a partir dos dados brutos da API, no domínio, com testes):
  - CPM = gasto / impressões × 1000 · CTR = cliques no link / impressões · CPC = gasto / cliques no link · Frequência = impressões / alcance.
  - CPL = gasto / leads (`lead` + `onsite_conversion.lead_grouped`) · Custo por conversa = gasto / `onsite_conversion.messaging_conversation_started_7d` · ROAS = valor de conversão / gasto.
  - **Hook rate** (só vídeo) = reproduções de 3 s (`video_play_actions` / ação `video_view`) / impressões · Hold rate = `video_thruplay_watched_actions` / reproduções de 3 s.
  - **Fadiga de criativo:** frequência acima do limite (padrão 3,0 em 7 dias) **e** CTR dos últimos 3 dias ao menos 25% abaixo da média dos 7 dias anteriores. Limites editáveis por cliente.
- **Reprovações da Meta:** ler `effective_status = DISAPPROVED` e `ad_review_feedback` de cada anúncio. O criativo vai automaticamente para o status "reprovado pelo Meta", com o motivo salvo (alimenta o histórico de reprovações por tipo de criativo na F2).
- Exportar relatório do mês (PDF/CSV + download dos criativos) para análise e planejamento do mês seguinte. **F2:** resumo gerado por IA ("o que funcionou e por quê").

### 4.6 Anúncios — Meta Ads e Google Ads — F1 (leitura) / F2 (gestão)
Reaproveitar a base de `D:\MEU SERVIDOR\HubSystem - Sistema\src\lib\ads\` (OAuth com `state` em cookie, tokens cifrados AES-256-GCM, sync idempotente 90 dias → 7 dias, métricas em centavos, descoberta de contas na MCC, retry em rate limit).
- Conectar contas pelo botão (Facebook Login for Business / OAuth Google). Selecionar quais contas entram no sistema e vincular cada conta a um cliente.
- Painel geral e por cliente: investimento, impressões, cliques, conversões, CTR, CPC, CPM, CPL, custo por conversa no WhatsApp, frequência, ROAS — **os KPIs exibidos mudam conforme o objetivo do cliente**. Filtros por cliente, plataforma e período (hoje, 7, 30 dias, personalizado). Comparação com período anterior.
- Campanhas, conjuntos e anúncios com status ativo/pausado; criativos ativos com miniatura.
- Saldo da conta, limite de gasto, previsão de dias até o saldo acabar.
- Google: palavras-chave, termos de pesquisa, campanhas.
- Escopo por usuário: o gestor principal vê todas as contas; outros gestores veem só as contas dos clientes em que estão marcados.
- **Importante:** há gestores que não gostam de dashboard; o painel deve ser enxuto, com a tabela de campanhas como visão principal e gráficos opcionais.
- F2: pausar/ativar, alterar orçamento, duplicar (com permissão `ads.manage`).

### 4.6b Planejamento e organização das campanhas — F1 (item 5 do MVP do gestor)
- **Plano de campanha por cliente:** objetivo, orçamento (diário/total), público, período (início/fim), criativos usados (vínculo com a biblioteca) e status do plano (`rascunho → aprovado → no ar → encerrado`). Quando a campanha real é sincronizada da API, ela é vinculada ao plano pelo nome.
- **Padrão único de nomenclatura** aplicado em todas as contas. O sistema tem um gerador de nome (o gestor escolhe os campos e o sistema monta o nome para copiar) e um verificador que marca na sincronização as campanhas, conjuntos e anúncios fora do padrão. Padrão sugerido, editável pelo admin: `[CLIENTE]_[OBJETIVO]_[PÚBLICO]_[AAAA-MM]` para campanha, `[PÚBLICO]_[POSICIONAMENTO]` para conjunto e `[FORMATO]_[ÂNGULO]_[V#]` para anúncio. **[CONFIRMAR padrão com o Luiz]** O nome padronizado é o que permite ligar o anúncio da API ao criativo da biblioteca e ao ângulo, e é isso que faz os relatórios por ângulo/formato funcionarem.
- **Calendário compartilhado** com datas comemorativas (com uma base nacional pré-carregada), lançamentos e promoções de cada cliente. Cada data pode gerar uma solicitação de criativo com antecedência configurável (ex.: 15 dias antes), para a mídia produzir a tempo.

### 4.7 Alertas e relatórios automáticos — F1
- **Relatórios automáticos via WhatsApp em grupo** (diário, semanal às segundas, mensal no dia escolhido; horário configurável). Uma mensagem por cliente, enviada para o grupo interno de relatórios; modelos editáveis com variáveis (`{cliente}`, `{investimento}`, `{cpc}`, `{ctr}`, `{cpl}`, `{saldo}`…) e métricas específicas por cliente. A pessoa responsável só repassa ao cliente. Referência: `src/lib/ads/reports.ts`, `src/domain/ads/report-message.ts`, tabela `ads_report_settings`.
- **Alertas:** saldo baixo (com antecedência em dias), gasto do dia acima do limite, conta sem gasto, conexão expirada, anúncio reprovado, conta restrita, CPL acima da meta, **fadiga de criativo** (frequência alta + CTR caindo). Entrega: central de notificações, push e grupo de WhatsApp. Deduplicação diária por chave. Referência: `src/lib/ads/alerts.ts`.
- **Rotina e checklists de otimização:**
  - Checklist diário por cliente: saldo/cobrança, reprovações, gasto vs. orçamento, entrega parada.
  - Checklist semanal: análise de criativos, públicos e custos; decisão de pausar, manter ou escalar.
  - **Registro de alterações** (o que mudou, quando e por quê) por cliente, para não depender da memória de ninguém.
- Modelo de relatório semanal e mensal padronizado (também exportável em PDF).
- F2 (itens "Importantes, mas podem vir numa 2ª fase" do briefing do gestor):
  - **Qualidade dos leads:** o cliente (principalmente imobiliário) avalia cada lead (ex.: bom / médio / ruim / não atendeu) por um link simples ou pela área do cliente. A nota fica ligada à campanha/anúncio de origem, aparece no painel como "% de leads qualificados" e "custo por lead qualificado", e pode voltar para a Meta pela Conversions API como evento de lead qualificado.
  - **Histórico de reprovações da Meta** por tipo de criativo, formato, ângulo e motivo, visível para a mídia antes de produzir.
  - **Registro de decisões e aprovações de verba** do cliente: quem aprovou, valor, data e anexo (print/áudio do WhatsApp).
  - **Metas por cliente** (CPL, leads, investimento) com barra de progresso no mês e alerta quando o ritmo indicar que a meta não será batida.
  - **Permissões por perfil** gestor, mídia, atendimento e diretoria. Já entram na F1 pelo modelo de papéis da seção 2; aqui só se refina o que cada perfil vê nos painéis de tráfego.

### 4.8 WhatsApp / Atendimento — F2
- Conectar números por QR Code (WAHA, como no HubSystem) e/ou WhatsApp Cloud API oficial. **Atenção:** a Cloud API não envia para grupos; os relatórios em grupo dependem do WAHA (não oficial, com risco de bloqueio). Usar um número dedicado da Extend.
- Inbox com conversas, responsável, etiquetas, "criar lead" a partir da conversa (puxa nome e telefone salvos), radar de conversas sem resposta.
- Rastreamento de origem: lead que vem de anúncio Clique-para-WhatsApp chega com a campanha (referral/UTM) e cai direto no funil.
- Referência: `src/lib/waha.ts`, `src/lib/whatsapp.ts`, `features/inbox/*`.

### 4.9 Comercial: funil de vendas — F2
- Leads, negócios, funis configuráveis (Kanban), etapas com SLA, motivos de perda, histórico de etapa, atividades, importação de planilha com deduplicação.
- Etapa "Ganho" → abre o formulário de fechamento → cria o cliente em onboarding (ver regra 3.1).
- Origem do lead (anúncio, indicação, prospecção, orgânico) com UTMs.
- Prospectador: reaproveitar a ideia do HubSystem, mas **rodando na nuvem** (Google Places API ou worker hospedado) com **score** (nota e nº de avaliações no Google, tem site, tem redes sociais) — não acoplado a um PC. **[CONFIRMAR se a Extend quer prospecção ativa]**
- Referência: migration `crm.sql`, `features/crm/*` do HubSystem.

### 4.10 Propostas comerciais — F2
O HubSystem **não tem** esse módulo; construir do zero.
- Modelos (templates) de proposta editáveis por quem tiver a permissão `proposals.templates.manage`: blocos de texto, serviços, preços, condições, identidade visual da Extend.
- Gerar proposta preenchendo só o que muda (nome do cliente, serviços, valores, prazo) → PDF com a identidade da Extend + link público para o cliente visualizar e aceitar.
- Status: rascunho, enviada, visualizada, aceita, recusada, expirada. Vinculada ao negócio do funil; aceite pode mover o negócio para "Ganho".
- Enviar pelo WhatsApp a partir do sistema.
- **[CONFIRMAR]** pedir à Extend o modelo de proposta usado hoje e quais campos mais mudam (citado: nome, valor e serviço).

### 4.11 Agenda — F1 (básica) / F2 (setores)
- Agenda pessoal sincronizada com Google Agenda (opcional por pessoa) mostrando tarefas com horário e reuniões.
- Agendas internas por setor (gravação, edição, reuniões com clientes) visíveis para quem tem permissão, sem depender do Google. **[CONFIRMAR]** — o tema ficou em aberto na reunião.
- Agendamento de gravações vinculado ao cliente e à demanda.

### 4.12 Arquivos — F1 (decisão necessária)
Hoje tudo está no Google Drive, inclusive o material que o cliente baixa. Recomendação: **integração com Google Drive** (pasta por cliente, upload pelo sistema cai no Drive, card guarda o link/preview) em vez de armazenar vídeos no Supabase, pelo custo. Supabase Storage só para anexos leves (PDFs, imagens de referência, prints de negociação). **[CONFIRMAR com cálculo de volume: nº de clientes × vídeos/mês × tamanho médio]**

### 4.13 Conteúdo e publicação nas redes — F2
- Cronograma de conteúdo por cliente (calendário) e visão do setor de gerenciamento (todos os clientes dela).
- Programar e publicar posts, reels e stories no Facebook/Instagram pela API, sem precisar entrar na conta de cada cliente; qualquer pessoa autorizada pode publicar se a responsável estiver ausente. Referência: `src/lib/content-publisher.ts`.
- TikTok: verificar disponibilidade da Content Posting API. **[CONFIRMAR]**

### 4.14 Aprovação pelo cliente — F2 (link) / F3 (área do cliente)
- Link público por entrega (vídeo, arte, roteiro), enviado no WhatsApp: cliente vê, clica 👍 (aprovado → vai para quem publica/sobe o anúncio) ou 👎 (abre campo para descrever a alteração → volta para o responsável). Referência: `task_deliveries` e `/aprovar/[token]` do HubSystem.
- F3: **área do cliente** com login (convite), somente leitura: visão geral do projeto, estratégia, cronograma de conteúdo, materiais para baixar, conteúdos para aprovar, notificações. Base para um app nas lojas no futuro.

### 4.15 Dashboards gerais — F1
- Visão do sócio: clientes ativos/em onboarding/inativos, entregas do período (contratado × entregue), atrasos por setor e por pessoa, produtividade (tarefas concluídas, tempo médio por tipo), investimento total em mídia.
- Filtros: período (hoje, 7, 30 dias, personalizado), cliente, setor, serviço, responsável.

### 4.16 Futuro (não construir agora, mas não impedir)
- Assistente de IA dentro do sistema (resumos de performance, sugestões de pauta, geração de copy).
- Integrações com Canva e Gamma, se as APIs permitirem.
- App nativo (lojas Apple/Google) a partir do PWA.

---

## 5. Arquitetura técnica

Usar a mesma stack do HubSystem (já validada pelo desenvolvedor), com as correções apontadas na análise:

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript estrito. No Next 16 o middleware se chama `proxy.ts`. |
| UI | Tailwind CSS 4, shadcn/ui, lucide-react, sonner, dnd-kit (Kanban), Recharts. Identidade visual da Extend **[pedir logo, cores e fontes]**. |
| Formulários | React Hook Form + Zod |
| Dados | Server Components lendo com o JWT do usuário (RLS filtra); escrita por Server Actions com `defineAction` (Zod + sessão + permissão + `ActionResult`). Supabase Realtime onde precisar de tempo real (quadros, notificações, inbox). |
| Banco | Supabase (Postgres) **da Extend**, região sa-east-1. RLS em todas as tabelas, funções de permissão `SECURITY DEFINER` no schema `private`, `search_path=''`. Testes pgTAP para RLS. |
| Jobs | Fila (`pgmq` ou equivalente) com **um job por conta de anúncio** em vez de um sync único sequencial; `pg_cron` + `pg_net` chamando rotas Next com token para os relógios (alertas, relatórios, notificações). |
| Tipos | Gerar com `supabase gen types` (não escrever tipos à mão). |
| Deploy | Vercel da Extend. Migrations aplicadas por comando/CI explícito, não escondidas no build. |
| Observabilidade | Sentry (ou equivalente) desde a F1. |
| PWA | manifest + service worker + Web Push (VAPID). |

Estrutura de pastas sugerida (como no HubSystem): `src/app/(auth)`, `src/app/(app)`, `src/app/api`, `src/domain` (regras puras com testes Vitest), `src/features/<modulo>/{actions,queries,schemas,components}`, `src/lib` (integrações server-only), `supabase/migrations`, `supabase/tests`.

Correções obrigatórias em relação ao HubSystem:
- Persistir o `login-customer-id` do Google Ads **por conta** (no HubSystem ele ficava num `Map` em memória e se perdia entre execuções).
- Definir explicitamente os escopos da Meta (`ads_read` na F1; `ads_management` só quando a F2 de gestão entrar) e planejar a **verificação do app pela Meta no BM da Extend** (a análise da Meta leva tempo — iniciar na semana 1).
- Renovação de token da Meta: usar token de System User do BM da Extend ou fluxo de reconexão com aviso antecipado (o token longo dura ~60 dias).
- Confirmar a situação atual do developer token do Google Ads antes de integrar (o código do HubSystem traz um comentário dizendo que ele foi aposentado em 09/2026 — verificar na documentação oficial).
- Componentes com no máximo ~300 linhas; quebrar telas grandes.

### Modelo de dados (rascunho para a F1)
- **Fundação:** `organizations`, `profiles`, `sectors`, `profile_sectors`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permission_overrides`, `invitations`, `audit_logs`, `notifications`, `push_subscriptions`.
- **Clientes:** `clients` (status, segmento, datas de contrato, verba, canal), `client_services` (serviço, quantidade mensal, ativo), `client_members` (pessoa + função/setor no cliente), `client_accounts` (BM, conta de anúncio, página, Instagram, pixel, WhatsApp), `client_onboarding` (respostas da ficha + `completed_at`), `client_meetings` (timeline), `client_decisions` (F2), `client_links`/`attachments`, `commercial_handoffs` (fechamento: serviços, valores, promessas, anexos).
- **Produção:** `boards`, `board_columns`, `tasks` (cliente, tipo, setor, mês de referência, slot), `task_assignees`, `task_checklist_items`, `task_comments`, `task_attachments`, `task_stage_history` (com tempo por etapa), `task_time_entries`, `tags`, `task_tags`, `deliveries` + `delivery_reviews` (aprovação por link).
- **Criativos:** `creative_requests` (formulário), `creative_versions`, `creatives` (biblioteca, status, copy, vínculo com `ads.external_id`).
- **Anúncios:** como no HubSystem — `integration_connections`, `ad_accounts` (com `client_id`, `login_customer_id`, regras de alerta), `ad_campaigns`, `ad_sets`, `ads` (com `effective_status` e `review_feedback`), `ad_insights_daily`, `ad_insights_ad_daily` (acrescentar `reach`, `frequency`, `link_clicks`, `leads`, `messaging_conversations`, `video_3s_views`, `thruplays`), `campaign_plans`, `naming_conventions`, `marketing_calendar_events`, `ads_report_settings`, `ads_report_log`, `optimization_checklists`, `optimization_logs` (registro de alterações).
- **F2:** CRM (`leads`, `deals`, `pipelines`, `stages`, `activities`…), `proposals`, `proposal_templates`, `proposal_items`, WhatsApp (`whatsapp_numbers`, `conversations`, `messages`…), conteúdo social.

Geração automática de slots: ao concluir o onboarding (e todo dia 1º do mês, para contratos ativos), um job cria os cards do mês conforme `client_services.quantidade_mensal`, no quadro do setor correspondente, com o responsável padrão do cliente.

---

## 6. Plano de entrega

| Fase | Período | Entregas | Critério de pronto |
|---|---|---|---|
| **F0 — Setup** | semana 1 | Repositório, Supabase/Vercel da Extend, auth por convite, papéis/permissões, layout base, PWA. **Iniciar pedido de verificação do app Meta e acesso ao Google Ads.** | Admin convida um funcionário, define o papel e o funcionário só vê o que foi liberado. |
| **F1a — Cliente e onboarding** | semana 2 | Fechamento comercial → cliente → ficha de onboarding obrigatória → serviços geram abas e slots → visão geral de clientes. | Cadastrar um cliente real do início ao fim e ver os cards do mês aparecerem para os responsáveis. |
| **F1b — Produção** | semana 3 | Quadros por cliente e por setor, Minhas tarefas, fluxo de etapas com troca de responsável, notificações + push, registro de tempo, solicitação de criativos, biblioteca de criativos. | Um vídeo percorre roteiro → gravação → edição → aprovação, notificando cada pessoa. |
| **F1c — Tráfego** | semana 4 | Conexão Meta/Google, painel por cliente, planejamento de campanhas + nomenclatura + calendário, relatórios automáticos no grupo, alertas, checklists e registro de alterações, performance por criativo e alerta de fadiga. | Relatório semanal chega no grupo sem ninguém montar à mão; alerta de saldo baixo dispara; todos os itens "MVP" da seção 9 funcionam com dados reais. |
| **Uso real** | dezembro | Equipe usando; ajustes; F2 (WhatsApp, funil, propostas, publicação, aprovação por link, gestão de campanhas, metas, qualidade de leads). | — |
| **F3** | janeiro+ | Área do cliente, app, IA, integrações extras. | — |

A cada fase: migrations + testes pgTAP das novas tabelas, testes Vitest das regras de domínio, revisão `web-design-guidelines`, e uma demo curta para a Extend validar.

---

## 7. Informações que preciso receber da Extend antes/durante a F1

1. Lista de funcionários (nome, e-mail, setor, função) e quem é admin.
2. Planilha "Controle de clientes" e planilha de controle de mídias/entregas (para importar clientes e copiar a lógica).
3. Quadros do Trello (exportação JSON) de um cliente bem ativo e dos setores (edição, conteúdo), para replicar colunas e fluxo.
4. Documentação do Luiz (briefing de tráfego já recebido) e da Jacque (briefing de mídias — ainda não enviado).
5. Perguntas da ficha de onboarding usadas hoje pela Jacque.
6. Lista definitiva de serviços vendidos e unidades (vídeos/mês, artes/mês, gravações/mês…).
7. Modelo atual de proposta comercial.
8. Acessos (como administrador, nas contas da Extend): Supabase, Vercel, BM da Meta (verificado), Google Ads MCC, Google Cloud, domínio, número de WhatsApp dedicado, Google Drive da agência.
9. Identidade visual da Extend (logo, cores, fontes).

---

## 8. Decisões em aberto
- **Arquivos:** Google Drive integrado vs. Supabase Storage (custo × praticidade).
- **Agendas por setor:** internas, Google Agenda compartilhada, ou ambas.
- **WhatsApp:** WAHA (QR, grupos, risco de bloqueio) vs. Cloud API oficial (sem grupos) — ou os dois, cada um para um uso.
- **TikTok, Canva e Gamma:** depende do que as APIs liberam.
- **Prospectador:** a Extend quer prospecção ativa ou só funil de entrada?
- **Assistente de IA:** escopo e custo mensal (citado como evolução futura).

---

## 9. Checklist de aceite: briefing do gestor de tráfego

Fonte: `Briefing Sistema de Gestão — Tráfego Pago.pdf` (Luiz). Todo item abaixo é obrigatório na fase indicada; a F1 só é dada como pronta quando todos os itens "MVP" estiverem funcionando com dados reais.

| # | Item do briefing | Seção deste prompt | Fase |
|---|---|---|---|
| 1 | Cadastro central de clientes e contas (segmento, responsáveis tráfego/mídias, status, BM, conta, página, Instagram, pixel, WhatsApp, pagamento, verba, renovação, canal) | 4.2 | MVP |
| 2 | Ficha de briefing/onboarding (oferta, público, região, diferenciais, objeções, objetivo, restrições Meta, identidade, tom, materiais) | 4.2 | MVP |
| 3 | Solicitação de criativos tráfego → mídias (formulário, quadro de status, aprovações com versões, notificação) | 4.4 | MVP |
| 4 | Biblioteca de criativos (vínculos, copy, status teste/vencedor/fadigado/reprovado) | 4.5 | MVP |
| 5 | Planejamento de campanhas, nomenclatura padrão, calendário compartilhado | 4.6b | MVP |
| 6 | Checklists diário e semanal + registro de alterações | 4.7 | MVP |
| 7 | Painel por cliente com KPIs por objetivo, via API, relatório semanal/mensal padronizado | 4.6, 4.7 | MVP |
| 8 | Números por criativo para a mídia + alerta de fadiga | 4.5, 4.7 | MVP |
| — | Qualidade dos leads | 4.7 (F2) | 2ª fase |
| — | Alertas: anúncio reprovado, conta restrita, saldo baixo, CPL acima da meta | 4.7 | **antecipado para MVP** (base pronta no HubSystem) |
| — | Histórico de reprovações por tipo de criativo | 4.7 (F2) | 2ª fase |
| — | Registro de decisões e aprovações de verba | 4.7 (F2) | 2ª fase |
| — | Permissões por perfil (gestor, mídia, atendimento, diretoria) | 2, 4.1 | **antecipado para MVP** |
| — | Metas e acompanhamento por cliente (CPL, leads, investimento) | 4.7 (F2) | 2ª fase |

Dores que a F1 precisa resolver de forma comprovável: (1) nenhum criativo pedido fora do formulário; (2) a mídia vê a performance do que produziu; (3) qualquer pessoa vê a etapa de cada criativo; (4) histórico e decisões registrados por cliente; (5) zero relatório montado à mão.

---

**Primeira ação esperada:** leia este documento, leia os arquivos de referência do HubSystem citados nas seções 4.1, 4.3, 4.6 e 4.7, e me devolva (1) as dúvidas que bloqueiam a F0/F1, (2) o modelo de dados detalhado da F1 e (3) a lista de telas da F1 com o que cada papel vê. Não escreva código antes da minha aprovação desse plano.
