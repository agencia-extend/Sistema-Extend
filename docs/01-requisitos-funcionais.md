# 01 — Requisitos funcionais

Cada requisito tem um código (`RF-XXX-nn`), a etapa em que é construído e critérios de aceite. "Funcional" significa: dados reais, persistidos, com permissão aplicada no banco, notificação quando afeta outra pessoa e teste de ponta a ponta (ver `CLAUDE.md`).

---

## PER — Acesso, usuários e permissões (etapa 01)

- **RF-PER-01 Login.** E-mail + senha; Google opcional (só aparece se configurado); "manter conectado"; recuperar senha por e-mail; bloqueio temporário após tentativas erradas.
  - Aceite: usuário convidado define a senha, entra, sai, recupera a senha; usuário sem convite não consegue criar conta.
- **RF-PER-02 Convite.** Admin convida por e-mail escolhendo papel, setor(es) e clientes iniciais. Token de uso único, 7 dias, guardado só como hash. Reenviar e revogar convite.
- **RF-PER-03 Papéis.** Admin cria/edita papéis com matriz de permissões `módulo.recurso.ação` e escopo `próprio | clientes atribuídos | setor | todos`. Papéis iniciais em `docs/03-permissoes.md`.
- **RF-PER-04 Exceções por usuário.** Conceder/negar permissão específica a um usuário além do papel.
- **RF-PER-05 Visibilidade por cliente.** O funcionário só vê clientes em que está marcado (`client_members`) — exceto quem tem escopo "todos". Vale para clientes, tarefas, criativos, contas de anúncio e relatórios. **No banco (RLS).**
- **RF-PER-06 Gestor de tráfego principal define o acesso dos outros gestores** às contas de anúncio (permissão `ads.access.manage`).
- **RF-PER-07 "Ver como".** Admin visualiza o sistema como outro usuário (somente leitura) para conferir permissões.
- **RF-PER-08 Auditoria.** Registro de quem criou/alterou/excluiu o quê, com antes/depois, filtrável. Somente inserção.
- **RF-PER-09 Trava de autoelevação.** Ninguém concede a si mesmo permissão que não tem.
- **RF-PER-10 Desativar usuário.** Remove o acesso imediatamente sem perder o histórico; reatribuir as demandas abertas dele.

## NOT — Notificações (etapa 01, usadas por todas)
- **RF-NOT-01** Central de notificações (sino) com não lidas, marcar como lida, ir para o item.
- **RF-NOT-02** Web Push no celular/desktop (PWA), com opt-in por usuário e preferências por tipo.
- **RF-NOT-03** Deduplicação por chave; nunca notificar quem fez a ação.
- **RF-NOT-04** Eventos mínimos: atribuído a mim, etapa mudou, comentário/menção, prazo em 24 h, atrasou, aprovação do cliente recebida, criativo pronto, alerta de anúncio, cliente novo em onboarding.

## CLI — Clientes (etapa 02)
- **RF-CLI-01 Cadastro central.** Nome, razão social/CPF-CNPJ, segmento/nicho, status (`onboarding | ativo | pausado | encerrado`), datas de início e fim do contrato, data de renovação, verba mensal de mídia contratada, forma de pagamento, canal de comunicação (ex.: grupo de WhatsApp — link), contatos do cliente.
- **RF-CLI-02 Serviços contratados.** Lista de serviços (catálogo editável pelo admin) com quantidade mensal quando aplicável (vídeos/mês, artes/mês, gravações/mês, posts/mês) e vigência.
- **RF-CLI-03 Contas do cliente.** BM, conta(s) de anúncio, página, Instagram, pixel/dataset, número de WhatsApp, Google Ads customer ID, site, pasta do Drive.
- **RF-CLI-04 Responsáveis.** Para cada cliente: responsável no tráfego, responsável nas mídias e membros por setor (gerenciamento, edição, design, gravação, site). Marcar alguém dá acesso ao cliente e às demandas dele.
- **RF-CLI-05 Visão de clientes.** Grade de cards: logo/nome, status, serviços, responsáveis, **% do contrato entregue no mês e no total**, etapa da jornada (onboarding, planejamento, execução), atrasos. Filtros: ativos, pausados, em onboarding, encerrados, período, serviço, responsável. Busca.
- **RF-CLI-06 Ambiente do cliente.** Abas exibidas conforme serviços **e** permissão: Visão geral · Ficha (onboarding) · Reuniões · Demanda do mês · Quadros (conteúdo, vídeo, design, gravação, site) · Ideias e referências · Criativos · Anúncios · Relatórios · Decisões · Arquivos · Histórico.
- **RF-CLI-07 Visão geral do cliente.** Status, progresso, próximos prazos, atrasos, últimas atividades, timeline filtrável (pendente, em andamento, aguardando aprovação, aprovado, concluído).
- **RF-CLI-08 Reuniões.** Timeline: data, tipo (briefing, planejamento, alinhamento, resultados), participantes, resumo/tópicos, anexos (ata, gravação, link). Agendar reunião futura gera evento na agenda dos participantes.
- **RF-CLI-09 Ideias e referências.** Banco por cliente: texto, link, imagem, tag; pode virar demanda.
- **RF-CLI-10 Importação inicial.** Importar a planilha "Controle de clientes" (CSV/XLSX) com mapeamento de colunas, prévia e desfazer.

## FEC — Fechamento comercial → onboarding (etapa 02)
- **RF-FEC-01** Formulário de fechamento (quem vendeu: comercial/sócios): cliente, contato, serviços e quantidades, valores e forma de pagamento, início e duração do contrato, **promessas comerciais** (prazos combinados, condições especiais), observações, anexos (prints da negociação, contrato).
- **RF-FEC-02** Ao salvar: cria o cliente com status `onboarding`, cria o checklist de onboarding e **notifica** os responsáveis de onboarding (padrão: Jacque e Luiz, configurável) com push.
- **RF-FEC-03** Promessas comerciais viram prazos visíveis no cliente e alertam quando estiverem perto de vencer.
- **RF-FEC-04** (etapa 08) Negócio ganho no funil abre este mesmo formulário pré-preenchido.

## ONB — Onboarding (etapa 02)
- **RF-ONB-01 Ficha de briefing.** Seções: negócio (oferta, produtos/serviços, diferenciais, região de atuação, ticket), público (perfil, dores, objeções comuns), objetivo de campanha (lead, WhatsApp, visita ao perfil, venda), **restrições de política da Meta** (segmento sensível: estética, saúde, finanças, imobiliário…; o que não pode ser dito/mostrado), identidade visual (logo, cores, fontes, manual), tom de voz, materiais autorizados, concorrentes/referências, acessos necessários. Perguntas da Jacque: **[pedir a lista atual e configurar como formulário editável pelo admin]**.
- **RF-ONB-02 Checklist do onboarding** (padrão, editável): repasse dos serviços vendidos, grupo de WhatsApp criado (link), reunião de briefing agendada e realizada, ficha preenchida, acessos recebidos (BM, conta, página, Instagram, Drive), reunião de planejamento realizada, planejamento de mídias aprovado, planejamento de tráfego aprovado, gravação agendada. Cada item com responsável e prazo.
- **RF-ONB-03 Obrigatoriedade.** Enquanto a ficha (campos obrigatórios) e o checklist não estiverem completos, o cliente fica em `onboarding` e só as abas Visão geral, Ficha, Reuniões e Arquivos aparecem. Botão "Concluir onboarding" só habilita quando tudo está completo.
- **RF-ONB-04 Estrutura automática.** Ao concluir: status → `ativo`; para cada serviço, libera a aba correspondente; serviços com quantidade mensal geram os **slots do mês** (ex.: 4 vídeos → 4 cards "Vídeo 1/4 – nov/2026" no quadro de vídeo do cliente, já com o responsável padrão); tráfego libera a aba Anúncios e vincula as contas.
- **RF-ONB-05 Recorrência mensal.** Todo dia 1º (job) gera os slots do mês para clientes ativos dentro da vigência; idempotente (não duplica se rodar de novo).
- **RF-ONB-06 Visibilidade.** A ficha completa só é vista por quem tem `clients.onboarding.read` (sócios, Luiz, Jacque, Joana); os demais veem um resumo operacional (tom de voz, restrições, identidade, materiais autorizados).
- **RF-ONB-07** Alterar serviços depois do onboarding (upgrade/downgrade) ajusta os slots a partir do mês seguinte, com registro na timeline.

## TAR — Produção, tarefas e quadros (etapa 03)
- **RF-TAR-01 Quadros.** Quadros Kanban por cliente e por setor, com colunas configuráveis (nome, cor, ordem, se é coluna de "concluído"). Modelos de quadro por tipo de serviço (vídeo, design, conteúdo, site, gravação). Criar quadro novo.
- **RF-TAR-02 Card/tarefa.** Cliente, tipo de demanda, título, descrição rica, responsável(eis), participantes, prazo (data e hora opcional), prioridade, tags com cor (criadas na hora), checklist, anexos/links (Drive), comentários com @menção, vínculo com slot do mês, criativo ou lead, histórico de alterações.
- **RF-TAR-03 Fluxos com troca de responsável.** Cada tipo de demanda tem um fluxo de etapas; cada etapa tem um responsável padrão (por cliente). Ao mover o card para a próxima etapa, o responsável muda automaticamente e a pessoa nova é notificada. Fluxo padrão de vídeo **[CONFIRMAR com a Jacque]**: Briefing → Roteiro → Aprovação do roteiro → Gravação → Edição → Revisão interna → Aprovação do cliente → Ajustes → Programado → Publicado. Design: Briefing → Criação → Revisão interna → Aprovação do cliente → Ajustes → Programado → Publicado.
- **RF-TAR-04 Arrastar e soltar** entre colunas e reordenar, com atualização em tempo real para quem está olhando o mesmo quadro.
- **RF-TAR-05 Registro de tempo.** Início e fim de cada etapa registrados automaticamente (entrou/saiu da coluna) + botão iniciar/pausar trabalho; tempo total por card e por etapa; aparece na agenda da pessoa como bloco realizado.
- **RF-TAR-06 Minhas tarefas.** Hoje, atrasadas, próximos 7 dias, aguardando outra pessoa; ordenar por prazo/prioridade; visão lista e Kanban; versão mobile.
- **RF-TAR-07 Visão do setor.** Todos os cards do setor, filtráveis por cliente, responsável, etapa, tipo, período (hoje, 7, 30 dias, personalizado). Contadores: no mês, concluídos, atrasados, por pessoa, por cliente.
- **RF-TAR-08 Demanda do mês do cliente** (substitui a planilha de controle de mídias): contratado × produzido × aprovado × publicado por tipo, quem está entregando, status de cada item.
- **RF-TAR-09 Atrasos.** Card vencido fica vermelho, notifica responsável e coordenação; contadores de atraso por setor e pessoa.
- **RF-TAR-10 Dependências simples:** "aguardando" outro card/pessoa.
- **RF-TAR-11 Importação do Trello** (JSON exportado): quadros, colunas, cards, checklists, comentários, anexos como links. **[CONFIRMAR se a Extend quer migrar o histórico]**

## AGE — Agenda (etapa 03)
- **RF-AGE-01** Agenda pessoal: tarefas com prazo/horário, blocos de tempo realizados, reuniões, gravações.
- **RF-AGE-02** Agendas de setor internas (gravação, edição, reuniões com clientes) visíveis conforme permissão; criar evento com cliente, participantes, local/link.
- **RF-AGE-03** Sincronização opcional com Google Agenda por usuário (bidirecional para eventos criados no sistema; útil para freelancers).
- **RF-AGE-04** Gravação agendada fica vinculada ao cliente e aos cards de vídeo correspondentes.

## ARQ — Arquivos (etapa 03)
- **RF-ARQ-01** Pasta do Google Drive por cliente (criada automaticamente no onboarding, dentro da pasta da Extend) **[CONFIRMAR decisão — ver docs/06]**.
- **RF-ARQ-02** Upload pelo sistema envia ao Drive (pasta do cliente/tipo/mês) e o card guarda link + miniatura/preview. Vídeos nunca ficam no Supabase.
- **RF-ARQ-03** Anexos leves (prints, PDFs, imagens de referência) no Supabase Storage privado, com URL assinada.
- **RF-ARQ-04** Aba Arquivos do cliente lista os arquivos do Drive e do sistema.

## CRI — Solicitação de criativos tráfego → mídias (etapa 04) — módulo mais importante
- **RF-CRI-01 Formulário padronizado** (obrigatórios marcados): cliente*, campanha* (existente ou planejada), objetivo*, formato* (imagem, vídeo, story, carrossel, reels), quantidade e variações, ângulo/mensagem*, público*, CTA*, copy sugerida, referências (links/arquivos), prazo*, prioridade*, observações. Mostra ao lado o resumo do onboarding (tom, restrições da Meta, identidade) e o histórico de criativos do cliente (vencedores e reprovados).
- **RF-CRI-02** Não envia incompleto. Ao enviar, cria a demanda no quadro de criativos e atribui à mídia responsável pelo cliente (ou à coordenação para distribuir).
- **RF-CRI-03 Status:** `solicitado → em produção → em revisão → aprovado → entregue → no ar` (+ `ajustes solicitados`, `cancelado`). Quadro Kanban e lista.
- **RF-CRI-04 Versões.** Cada entrega é uma versão (v1, v2…) com arquivos/links e comentários; histórico completo.
- **RF-CRI-05 Aprovação interna** (gestor que pediu) com aprovar/pedir ajuste + comentário.
- **RF-CRI-06 Aprovação do cliente por link público** (sem login): o cliente vê a(s) peça(s) e clica 👍 aprovar ou 👎 pedir alteração (campo obrigatório descrevendo). Registra data/hora e IP. Link enviado pelo WhatsApp (botão copiar/enviar). O resultado volta automaticamente: aprovado → `aprovado` e notifica quem sobe o anúncio; alteração → `ajustes solicitados` e notifica a mídia.
- **RF-CRI-07 Notificação a cada mudança** para quem pediu e quem produz; "criativo pronto" notifica o gestor.
- **RF-CRI-08 Pedido a partir de um anúncio** (etapa 05): botão "Pedir novo criativo" num anúncio saturado pré-preenche cliente, campanha, formato, ângulo e referência.

## BIB — Biblioteca de criativos (etapas 04 e 05)
- **RF-BIB-01** Todo criativo aprovado entra na biblioteca vinculado a cliente, campanha, formato, ângulo e solicitação, com a copy usada (texto principal, título, descrição) e o arquivo/preview.
- **RF-BIB-02 Status:** em teste, vencedor, fadigado, reprovado pela Meta, arquivado. Vencedor/fadigado definidos pelo gestor ou sugeridos pelo sistema (regras do RF-ALE-01).
- **RF-BIB-03 Performance por criativo** (etapa 05): vínculo com o(s) anúncio(s) da API (pela nomenclatura ou manualmente) e métricas: investimento, impressões, CTR, CPC, CPM, CPL, custo por conversa, hook rate, hold rate, frequência, ROAS, dias no ar. **Visível para a equipe de mídias** do cliente.
- **RF-BIB-04** Filtros por cliente, formato, ângulo, status, período, métrica; ordenar por desempenho; "top criativos" do mês.
- **RF-BIB-05 Exportar** o relatório de criativos do período em PDF/CSV + baixar os arquivos (zip/links) para análise e planejamento do mês seguinte.

## ADS — Anúncios Meta e Google (etapa 05)
- **RF-ADS-01 Conexão** Meta (Facebook Login for Business) e Google Ads (OAuth + MCC), pelas contas da Extend. Status da conexão visível; aviso antes de expirar; reconectar.
- **RF-ADS-02** Listar contas disponíveis, escolher quais entram no sistema e vincular cada conta a um cliente.
- **RF-ADS-03 Sincronização** automática (contas, campanhas, conjuntos, anúncios, criativos, métricas diárias por campanha e por anúncio) a cada poucas horas, + "sincronizar agora". Primeira carga 90 dias, depois janela de 7 dias. Idempotente. Um job por conta (não trava se uma falhar).
- **RF-ADS-04 Saldo e limite** (pré-paga e pós-paga), gasto do dia e do mês, **previsão de dias até o saldo acabar** (gasto médio dos últimos 7 dias).
- **RF-ADS-05 Painel do tráfego** (visão principal em tabela): por cliente → contas → campanhas → conjuntos → anúncios; status ativo/pausado; investimento, resultados e KPIs; filtros por cliente, plataforma, status e período (hoje, ontem, 7, 14, 30 dias, mês atual, mês anterior, personalizado); comparação com o período anterior. Gráficos opcionais (recolhíveis).
- **RF-ADS-06 KPIs por objetivo do cliente:** leads → CPL, leads, CTR, CPM, frequência; WhatsApp → custo por conversa, conversas iniciadas; tráfego/perfil → CPC, CTR, visitas; vendas → ROAS, compras, CPA. Fórmulas em `docs/02-arquitetura-e-dados.md#metricas`.
- **RF-ADS-07 Aba Anúncios dentro do cliente** (para quem tem permissão, inclusive mídias): o que está ativo/pausado agora, com miniaturas e números.
- **RF-ADS-08 Google:** campanhas, palavras-chave, termos de pesquisa com métricas.
- **RF-ADS-09 Escopo:** gestor principal vê todas as contas; demais gestores veem só as contas liberadas/dos clientes atribuídos (RF-PER-06).
- **RF-ADS-10 Reprovações:** anúncios reprovados detectados na sincronização (status e motivo); marcam o criativo como "reprovado pela Meta" e geram alerta.
- **RF-ADS-11 UTMs:** gerador de links com UTM por cliente/campanha (modelos Meta/Google) e lista dos links gerados.

## PLA — Planejamento de campanhas (etapa 05)
- **RF-PLA-01 Plano de campanha por cliente:** objetivo, orçamento (diário/total), público, período, plataforma, criativos (da biblioteca ou solicitações), status (`rascunho → aprovado pelo cliente → no ar → encerrado`).
- **RF-PLA-02 Vínculo automático** do plano com a campanha real sincronizada (pelo nome padronizado ou seleção manual).
- **RF-PLA-03 Nomenclatura padrão** configurável pelo admin/gestor principal (padrão sugerido em `docs/02`). Gerador de nome (copiar) e verificador que lista campanhas/conjuntos/anúncios fora do padrão.
- **RF-PLA-04 Calendário de marketing compartilhado:** base de datas comemorativas nacionais pré-carregada + datas de cada cliente (lançamentos, promoções, eventos). Visível para tráfego e mídias.
- **RF-PLA-05** Cada data pode gerar automaticamente uma solicitação de criativo/conteúdo com antecedência configurável (padrão 15 dias).

## OTI — Rotina de otimização (etapa 06)
- **RF-OTI-01 Checklist diário por cliente com tráfego:** saldo/cobrança, anúncios reprovados, gasto vs. orçamento, entrega parada. O sistema **pré-preenche com os dados da API** (ex.: "2 anúncios reprovados", "saldo para 3 dias") e o gestor confirma/comenta.
- **RF-OTI-02 Checklist semanal:** análise de criativos, públicos e custos; decisão por campanha/criativo: pausar, manter ou escalar, com justificativa.
- **RF-OTI-03 Registro de alterações:** o que mudou, quando, por quê, por quem (manual + automático quando o sistema detecta mudança de orçamento/status na sincronização). Timeline por cliente.
- **RF-OTI-04 Painel de pendências** do gestor: checklists do dia não feitos, alertas abertos.

## REL — Relatórios (etapa 06)
- **RF-REL-01 Relatórios automáticos no WhatsApp** para o grupo interno de relatórios (e, opcionalmente, para o grupo do cliente — com aviso do risco): diário, semanal (segunda), mensal (dia escolhido), horário configurável. Uma mensagem por cliente com intervalo entre envios.
- **RF-REL-02 Modelos editáveis** com variáveis (`{cliente}`, `{periodo}`, `{investimento}`, `{impressoes}`, `{cliques}`, `{ctr}`, `{cpc}`, `{cpm}`, `{leads}`, `{cpl}`, `{conversas}`, `{custo_conversa}`, `{roas}`, `{saldo}`, `{dias_saldo}`, `{top_criativo}`) e métricas específicas por cliente.
- **RF-REL-03 Pré-visualizar** e **enviar agora** (para testar).
- **RF-REL-04 Registro de envios** (enviado, falhou, motivo) sem duplicar.
- **RF-REL-05 Relatório semanal e mensal em PDF** padronizado com a marca da Extend, por cliente, para download/envio.
- **RF-REL-06** Relatórios ficam salvos na aba Relatórios do cliente.

## ALE — Alertas (etapa 06)
- **RF-ALE-01 Regras** (limites por cliente/conta, com padrão global): saldo baixo (valor ou dias restantes), gasto do dia acima do limite, conta sem gasto/entrega parada, anúncio reprovado, conta restrita/desativada, CPL acima da meta, **fadiga de criativo** (frequência ≥ 3,0 em 7 dias **e** CTR dos últimos 3 dias ≥ 25% abaixo da média dos 7 anteriores — limites editáveis), conexão expirada/expirando.
- **RF-ALE-02 Entrega:** central de notificações + push para responsáveis do cliente + grupo de WhatsApp de alertas. Deduplicação diária por chave.
- **RF-ALE-03 Painel de alertas:** abertos, reconhecidos, resolvidos; quem resolveu e como.

## DSH — Dashboards gerais (etapa 06)
- **RF-DSH-01 Sócios:** clientes por status, entregas contratado × entregue no período, atrasos por setor e pessoa, produtividade (cards concluídos, tempo médio por tipo), investimento total em mídia gerenciado, alertas abertos, onboardings em andamento.
- **RF-DSH-02 Por setor:** produção do setor no período, atrasos, por pessoa, por cliente.
- **RF-DSH-03 Filtros** comuns: período (hoje, 7, 30, personalizado), cliente, setor, serviço, responsável. Toda métrica clicável leva à lista que a compõe.

## WPP — WhatsApp e atendimento (etapa 07; envio para grupos na etapa 06)
- **RF-WPP-01 Conectar número** por QR Code (WAHA) e/ou API oficial (Cloud API). Status, reconectar, desconectar.
- **RF-WPP-02 Enviar para grupo** (relatórios e alertas) — necessário já na etapa 06.
- **RF-WPP-03 Inbox:** conversas, mensagens em tempo real, enviar texto/mídia/áudio, responsável, etiquetas, não lidas, busca, encerrar, apagar conversa/grupo, respostas rápidas.
- **RF-WPP-04 Importar histórico** ao conectar.
- **RF-WPP-05 Criar lead** a partir da conversa (puxa nome e telefone salvos).
- **RF-WPP-06 Origem do anúncio:** conversa iniciada por anúncio Clique-para-WhatsApp registra campanha/anúncio (referral) e cria o lead no funil na etapa "Lead de anúncio".
- **RF-WPP-07 Radar:** conversas aguardando resposta há mais de X minutos.

## CRM — Comercial, funil e prospecção (etapa 08)
- **RF-CRM-01 Leads** (pessoa/empresa) com origem (anúncio, WhatsApp, indicação, prospecção, orgânico, site) e UTMs; deduplicação por telefone/e-mail.
- **RF-CRM-02 Funis configuráveis** (Kanban) com etapas, cor, tipo (aberta/ganho/perdido) e SLA; padrão: Lead de anúncio/início de conversa → Qualificação → Reunião marcada → Proposta enviada → Negociação → Ganho / Perdido (motivo obrigatório).
- **RF-CRM-03** Atividades e timeline do lead (ligação, mensagem, reunião, nota), próximas ações com lembrete.
- **RF-CRM-04 Importar** planilha de leads com mapeamento, prévia, deduplicação e desfazer.
- **RF-CRM-05 Ganho → fechamento** (RF-FEC-04) → cliente em onboarding.
- **RF-CRM-06 Cadências** de follow-up (tarefas e mensagens agendadas), pausando quando o lead responde; opt-out.
- **RF-CRM-07 Prospectador na nuvem:** busca por nicho + cidade/UF (Google Places API), lista resultados com nome, telefone, site, endereço, nota e nº de avaliações, redes sociais; **score** de oportunidade configurável (ex.: sem site, poucas avaliações, nota baixa, sem Instagram = mais oportunidade para a agência); importar selecionados para o funil sem duplicar. Custo da API exibido/limitado por mês.
- **RF-CRM-08 Dashboard comercial:** leads por origem, conversão por etapa, propostas enviadas/aceitas, valor ganho, tempo médio de fechamento.

## PRO — Propostas comerciais (etapa 09)
- **RF-PRO-01 Modelos** editáveis por quem tem permissão: blocos (capa, sobre a Extend, diagnóstico, serviços, investimento, condições, próximos passos), variáveis (`{cliente}`, `{contato}`, `{servicos}`, `{valor_total}`, `{validade}`…), identidade da Extend.
- **RF-PRO-02 Catálogo de serviços** com descrição e preço padrão (editável na proposta).
- **RF-PRO-03 Gerar proposta** escolhendo modelo + lead/negócio, preenchendo só o que muda (nome, serviços, valores, prazo); prévia ao vivo; salvar versões.
- **RF-PRO-04 PDF** com a marca da Extend + **link público** de visualização com botão "Aceitar proposta" (nome + confirmação) e registro de visualizações.
- **RF-PRO-05 Status:** rascunho, enviada, visualizada, aceita, recusada, expirada. Aceite move o negócio para Ganho e abre o fechamento pré-preenchido.
- **RF-PRO-06 Enviar pelo WhatsApp** a partir do sistema (link + mensagem modelo).

## CON — Conteúdo e publicação (etapa 10)
- **RF-CON-01 Cronograma de conteúdo** por cliente (calendário mensal) e visão do setor de gerenciamento (todos os clientes dela; quais estão com o mês completo).
- **RF-CON-02 Conectar páginas e Instagram** dos clientes (via BM da Extend).
- **RF-CON-03 Publicar e agendar** post (imagem/carrossel), reels/vídeo e story no Facebook/Instagram, com legenda, cliente e horário; editar ou cancelar agendamento; status publicado/falhou com motivo.
- **RF-CON-04** Item aprovado pelo cliente (RF-CRI-06 / fluxo de conteúdo) aparece pronto para agendar.
- **RF-CON-05** TikTok somente se a API de publicação estiver disponível para a Extend **[verificar]**.

## T2 — Tráfego fase 2 (etapa 11)
- **RF-T2-01 Qualidade dos leads:** cliente avalia cada lead (link simples ou área do cliente): bom, médio, ruim, não atendeu; nota ligada à campanha/anúncio; painel com % qualificados e custo por lead qualificado; envio opcional à Meta (Conversions API).
- **RF-T2-02 Histórico de reprovações da Meta** por tipo de criativo, formato, ângulo e motivo; aparece no formulário de solicitação.
- **RF-T2-03 Decisões e aprovações de verba** do cliente: valor, período, quem aprovou, data, comprovante (print/áudio).
- **RF-T2-04 Metas por cliente** (CPL, leads, investimento, ROAS) com progresso do mês e projeção; alerta se o ritmo não bate a meta.
- **RF-T2-05 Gestão de campanhas pelo sistema** (permissão `ads.manage`): pausar/ativar, alterar orçamento, duplicar; tudo registrado no RF-OTI-03.

## ACL — Área do cliente (etapa 12)
- **RF-ACL-01** Convite para usuário do cliente (papel Cliente), somente leitura, vê apenas o próprio cliente.
- **RF-ACL-02** Visão geral do projeto, estratégia/planejamento aprovado, cronograma de conteúdo, materiais para baixar, relatórios, aprovações pendentes (mesmo fluxo do link), avaliação de leads.
- **RF-ACL-03** Notificação (push/e-mail/WhatsApp) quando houver conteúdo para aprovar.
