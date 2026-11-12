# PROMPT — Sistema de Gestão Interna da Agência Extend

> Cole este prompt inteiro na ferramenta de IA que vai construir o sistema (Claude Code, Lovable, Bolt, v0 etc.).
> Montado a partir de: 9 áudios + 5 vídeos de tela do WhatsApp, fluxograma do Miro "Fluxograma Extend – Clientes" e formulário "Briefing Produção de Conteúdo – Vídeos e Design".

---

## 1. Contexto

Você vai construir um **sistema web interno (SaaS de uso interno)** para a **Extend**, uma agência de marketing com cerca de 3 anos, sediada na região da AMESC (SC). A agência vende tráfego pago, produção de conteúdo (vídeo e design), gerenciamento de redes sociais, treinamento comercial e sites.

**A dor hoje:** "tudo muito solto, uma coisa é feita aqui, outra ali, tudo muito manual". A operação está espalhada entre:
- **Google Drive**: funciona como "sistema de cada cliente". Cada cliente tem uma pasta com conteúdos, materiais, reuniões e métricas. Os takes brutos ficam em **outro Drive, de 5 TB, só para isso**.
- **Trello**: um quadro por setor (Edição de Vídeos, Design) e um quadro por cliente (cronograma de posts, ao qual o cliente tem acesso).
- **Planilhas Google**: "Controle de Clientes" (visão geral) e "Controle de Mídias/Vídeos" (um mapa do Drive por conteúdo).
- **Google Forms**: briefing preenchido **pela própria equipe durante a reunião** com o cliente.
- **WhatsApp**: grupo por cliente, aprovações e envios urgentes.

**Objetivo:** centralizar tudo em um único sistema. Cada cliente tem uma "central" (página própria), cada setor tem seu quadro de produção, os status andam sozinhos entre as etapas e os relatórios (ex.: "quantos vídeos a editora X editou no mês") saem automaticamente.

---

## 2. Usuários, papéis e permissões

| Pessoa | Função atual (do fluxograma) | Papel no sistema |
|---|---|---|
| Jorge | Comercial / closer, gestor. Cadastra o cliente após a venda e pede relatórios de produção | Admin / Comercial |
| Fernando | Gestor (início: venda e contrato) | Admin |
| Joana | SDR, cronograma de conteúdo, aprovação interna de vídeos, relatório semanal de tráfego | Gestão / Atendimento |
| Jackeline | Gestora do setor de Mídias: onboarding, estratégia de conteúdo, agenda gravações, organiza edição e design, aprova | Gestor de Mídias |
| Luiz / Ben Hur | Tráfego pago (estrutura, sobe criativos, otimiza campanhas) | Tráfego |
| Madu | Social media: legendas, programação de posts, monitoramento de directs, relatórios (Reportei) | Social Media |
| Caliton | Captação/gravação | Videomaker |
| Juliana (e outras editoras) | Edição de vídeo | Editor |
| Pricila | Design | Designer |
| Cliente | Vê o cronograma, aprova conteúdos | Cliente (portal, fase 2) |

- Permissões por papel (RBAC). Cada colaborador vê só o que é do seu setor e das suas tarefas. Admin e gestores veem tudo.
- Os nomes acima são dados iniciais (seed). Usuários e setores precisam ser cadastráveis e editáveis.

---

## 3. Módulos

### 3.1 Cadastro de Cliente ("ficha principal") — PRIORIDADE ALTA
Etapa separada do onboarding. Quem cadastra é o Jorge, logo após a venda. Ao salvar, o onboarding começa sozinho.

Campos (vindos da planilha "Controle de Clientes"):
- Nº / código, Nome do cliente / empresa, Nicho
- Responsável pela comunicação (quem da Extend atende o cliente)
- Data de início e de fim do contrato, duração, valor
- **Escopo contratado** (texto livre, ex.: "8 vídeos + 4 designs + 4 edições") e quantidade mensal de entregáveis
- **Serviços contratados** (checkboxes, hoje marcados com emoji na planilha): Meta Ads (Facebook/Instagram), Google Ads, Treinamento Comercial, Pacote de Vídeos, Conteúdo Mensal, Gerenciamento, Consultoria de Perfil, Site/Landing Page, Google Meu Negócio
- Perfil do Instagram (link), contato, e-mail
- Tipo: **Cliente fixo** | **Serviço avulso** | **Inativo/antigo** (hoje são pastas separadas no Drive)
- **Dia de virada do mês do cliente**: o "mês" de cada cliente começa no dia de início do contrato (ex.: dia 14 → Mês 1 = 14/08 a 14/09, Mês 2 = 14/09 a 14/10). Todo o controle mensal precisa seguir esse ciclo, e não o mês do calendário.

**Visão geral de clientes:** uma tabela com filtros (serviço, responsável, status, fim de contrato próximo), reproduzindo a planilha "Controle de Clientes" com ícones por serviço.

### 3.2 Central do Cliente (página de cada cliente) — PRIORIDADE ALTA
Substitui a pasta do Drive e o "Trello do cliente". Abas:
1. **Visão geral**: ficha, serviços, contrato, responsáveis, contato, links rápidos (Instagram, Drive, acessos).
2. **Briefing**: formulário de onboarding (ver 3.3).
3. **Materiais**: identidade visual (logo, cores, fontes, manual), catálogo, instruções de perfil, banco de imagens, referências, acessos. Upload de arquivo **ou** link para o Drive.
4. **Controle de Mídias** (o coração do sistema, ver 3.4).
5. **Cronograma de conteúdo**: posts por semana e mês, cada post com legenda, data, link do post publicado e uma visão de **grid do Instagram** (prévia de como o feed vai ficar).
6. **Gravações**: um registro por diária de gravação (data, quem gravou, link dos takes brutos no Drive de 5 TB).
7. **Reuniões**: atas e datas (briefing, aprovação de estratégia, quinzenal/mensal).
8. **Métricas / Relatórios**: relatórios semanais de tráfego e de conteúdo e levantamentos de métricas.
9. **Documentos**: área para anexar planilhas e documentos importantes do cliente, com subpastas por setor (Mídias, Tráfego).
10. **Histórico de contratos**: contratos anteriores e o ativo, cada um com seus meses.

### 3.3 Onboarding + Briefing integrado — PRIORIDADE MÉDIA
Hoje o briefing é um Google Forms que **a equipe preenche junto com o cliente durante a reunião**. O cliente não preenche, porque são empresas maiores que querem praticidade. No sistema, o briefing vira um **formulário dentro da central do cliente**, preenchido pela equipe, com rascunho salvo automaticamente, e mostra só as seções dos serviços contratados.

**Seções e perguntas do briefing** (reproduzir todas):

**A. Geral (sempre)**
- Serviços que vai executar com a Extend (múltipla escolha: Tráfego Google Ads, Tráfego Meta Ads, Produção de vídeos, Produção de designs, Desenvolvimento de site/LP…)
- Nome da empresa/marca; o que a empresa faz hoje (serviços/produtos); há quanto tempo atua
- Como é o processo de vendas hoje
- Principais serviços/produtos a divulgar
- Público: gênero predominante; faixa etária (múltipla); poder aquisitivo; B2C ou B2B; público desejado diferente do atual
- Dores, necessidades e desejos que o produto resolve; o que impede a compra
- Como a marca quer ser percebida (múltipla: profissional/técnica, sofisticada/alto padrão, próxima/acessível, educativa, autoridade…); tom de comunicação; o que a marca NÃO deve transmitir

**B. Tráfego pago**
- Já anunciou no Google/Meta? Em qual ferramenta?
- Acesso às contas; tem programador ou acesso ao painel do site para instalar tags e pixel?
- Objetivo principal (vendas no site, WhatsApp, leads…)
- Investimento mensal em Meta Ads e em Google Ads; ticket médio; meta de faturamento ou de vendas
- Regiões de atuação; horário de atendimento (anúncio 24h ou só no horário comercial)
- 3 principais concorrentes; produto/serviço "carro-chefe"; formas de pagamento; promoções e datas comemorativas
- Palavras-chave (Google); palavras negativas; WhatsApp de atendimento para os anúncios; forma de pagamento dos anúncios

**C. Produção de vídeos**
- Já produziu vídeos? Como foi?
- Estilo e linguagem com que se identifica; perfis de referência
- O que NÃO quer fazer ou mostrar; temas que quer refazer; temas que já queria produzir
- Estilo de gravação (dinâmica, estática, "confio na Extend"); estilo de edição (clean, impactante…); quer legenda em todos os vídeos?; estilo de roteiro (frases curtas, tópicos de direcionamento…)

**D. Design**
- Tem identidade visual? Manual de marca (link); códigos de cor; fontes; logo em alta (upload); fotos profissionais (link)
- Elementos obrigatórios nos posts; elementos proibidos; estilo de design (minimalista, chamativo…); 3 referências

**E. Site / Landing page**
- Tem site? Tem backup? Objetivo (institucional, geração de leads…); cidade/região de foco
- Identidade visual, logo, cores e fontes do site; páginas e seções necessárias; funcionalidades (botão de WhatsApp…); integrações (WhatsApp, Instagram…); 3 sites de referência e por quê; o que NÃO quer no site

**Checklist de onboarding** (a partir do fluxograma do Miro, com prazos e responsáveis):
1. Repasse para a Jackeline da data e dos serviços vendidos (resp.: Jorge, WhatsApp, **imediato**)
2. Registrar o cliente no "Controle de clientes" (vira automático com o cadastro)
3. Criar o grupo de WhatsApp (cliente + equipe) (resp.: Jorge/Joana, **imediato**). Objetivo: ser o canal principal de comunicação
4. Agendar a reunião de briefing (**até 2 dias úteis**, Google Agenda). Objetivo: agendar o mais rápido possível
5. **Reunião de briefing** (resp.: Jackeline + Luiz/Ben Hur, Google Meet). Objetivo: captar o máximo de informações usando o formulário como base
   - Setor Mídias: definir a metodologia de produção, preencher o formulário, agendar a próxima reunião em 7 dias
   - Setor Tráfego: definir o orçamento, pegar acessos às contas, organizar os criativos de teste
6. Definir as **obrigações do cliente**: porta-voz do projeto; prazo de feedback dos leads; prazo de resposta; prazo de aprovação; cliente sem produção entrega no mínimo 5 criativos por mês, no começo do mês; obrigação de responder os relatórios semanais

### 3.4 Controle de Mídias (por cliente e geral) — PRIORIDADE ALTA
Reproduz a planilha "Controle de Vídeos/Mídias". Cada **mês do cliente** tem os slots **Conteúdo 1…N** (N = quantidade contratada, ex.: 8 ou 20), que funcionam como a "contabilidade" do que precisa ser entregue no mês.

Campos de cada conteúdo:
- Formato (vídeo curto, vídeo premium, reels, estático, carrossel, sequência de stories, anúncio…)
- Objetivo (ex.: conexão, autoridade, venda)
- Tema / descrição; roteiro (texto ou anexo); legenda (copy)
- Responsável pela gravação + data da gravação
- Responsável pela edição/design
- **Status**: Não iniciado → Roteiro planejado → Em gravação → Em edição → Aprovação interna → Em alteração → Aprovação cliente → Aprovado → Inserir no cronograma → Postado/Finalizado
- Link do conteúdo final (Drive) e link dos takes brutos
- Data de postagem e link do post

**Regra-chave (automação pedida):** quando o gestor planeja o mês e cadastra os conteúdos com "quem grava" e "quem edita", o card **vai sozinho para o quadro do setor** (Edição ou Design) atribuído ao editor/designer. Ao andar no quadro, o status volta e atualiza o Controle de Mídias do cliente e o **Controle Geral**.

**Controle Geral / Relatórios:** produção por pessoa por período (ex.: "quantos vídeos a Juliana editou em novembro"), entregue × contratado por cliente no mês, gargalos por status, atrasos.

### 3.5 Quadros de produção por setor (Kanban) — PRIORIDADE ALTA
Substituem os Trellos de setor. Um card = um conteúdo (vídeo ou arte), sempre ligado ao cliente e ao slot do Controle de Mídias.

**Setor Edição de Vídeos**: colunas `Não iniciado` → `Em andamento` → `Aprovação interna` → `Aprovação cliente` → `Inserir no cronograma` → `Finalizado`
- Card: título "Cliente – Conteúdo", descrição/instruções, links dos takes (antes/depois), referências, membro (editor), etiquetas, prazo, comentários com histórico, campo "subir vídeo pronto aqui" (link do Drive)
- Etiquetas: **Em alteração**, **Aprovado**, nome do editor
- Fluxo: a editora pega o card → `Em andamento`. Terminou → `Aprovação interna` (Jackeline/Joana assistem). Se precisar de ajuste, entra a etiqueta "Em alteração" e o card volta para a editora. Se estiver ok → `Aprovação cliente`. Cliente aprovou → `Inserir no cronograma` (Joana coloca no cronograma ou envia ao tráfego/Luiz) → `Finalizado`
- Hoje a gestora arrasta e avisa as pessoas manualmente. No sistema, cada mudança de coluna **notifica o próximo responsável**.

**Setor Design**: mesmo modelo. Cada cliente tem uma área "informações gerais" fixa (identidade visual, referências, link do Drive), puxada da central do cliente. Os cards são as artes (estático, carrossel, stories), com instruções, referência e copy. A designer sinaliza quando termina → aprovação → envio ao cliente → alteração → aprovado → link final.

Filtros: por cliente, por responsável e por prazo. Também uma visão "Minhas tarefas" para cada colaborador.

### 3.6 Fluxo de Produção de Conteúdo (do Miro) — base das automações
Gestora: Jackeline. Duração típica: cerca de 10 dias.
1. Início da estratégia de conteúdo: público-alvo, estudo de mercado, temas, metodologia (resp. Jackeline; Google/Trello/ChatGPT/Instagram)
2. Apresentação da estratégia de conteúdo e tráfego na reunião de planejamento
3. **Reunião de aprovação da estratégia de conteúdo e tráfego** (Luiz/Jackeline, Meet). Apresentar: obrigações do cliente, plano de escala, planejamento de conteúdo; tráfego: como funciona, modelos de campanha, divisão de orçamento, públicos, performance dos criativos de teste. Resultado: ✓ Planejamento aprovado ✓ Gravação agendada
4. Vídeos: Agendamento da 1ª gravação (Jackeline) → Execução da gravação (Caliton) → Upload dos arquivos gravados no Drive (Caliton) → Organizar vídeos para edição com prazo (Jackeline) → Edições com status atualizado (Jackeline/Juliana) → Aprovação interna (Jackeline) → Aprovar com o cliente (Jackeline, WhatsApp) → Organizar vídeos (enviar para Tráfego e/ou Drive)
5. Designs: Início (Jackeline) → Execução (Pricila) → Aprovação interna → Aprovação com o cliente → Organizar designs (Tráfego/Drive)

### 3.7 Gerenciamento de redes (social media)
- Organização do cronograma de conteúdo (resp. Joana). **Os cronogramas ficam prontos toda sexta-feira**
- Criação das legendas (resp. Madu). **As legendas precisam estar prontas toda segunda-feira**
- Programação dos posts (resp. Madu, Instagram). **Os posts precisam estar programados toda segunda-feira, até domingo**
- Monitoramento de directs e comentários (Madu)
- Clientes **sem gerenciamento** não têm cronograma, só a área de entrega (Drive/materiais). O sistema precisa respeitar isso pelos serviços contratados.
- Os prazos recorrentes geram tarefas e alertas automáticos.

### 3.8 Tráfego Pago
- Início da estruturação das campanhas: configuração da página, análise de criativos para a campanha de teste, saldo (Luiz/Ben Hur, Gerenciador)
- Criativos de teste para alcance: se o cliente tem conteúdo, o Luiz escolhe o melhor e sobe; se não tem, o Luiz pede arte para a Pricila (gera um card no Design)
- Reunião de aprovação da estratégia de tráfego → ✓ Planejamento aprovado ✓ Nova campanha definida
- Depois da aprovação: manter a campanha de teste e aguardar novos criativos. **Quando receber criativos novos, subir em até 2 dias**
- Monitorar e otimizar as campanhas semanalmente; envio do relatório semanal (Joana, Gerenciador/WhatsApp)
- Quando um vídeo ou design aprovado vai "para o Tráfego", ele aparece numa fila de criativos do tráfego daquele cliente

### 3.9 Entrega de Métricas e Acompanhamento
- **Relatórios semanais de desempenho**
  - Tráfego (Joana, Gerenciador/WhatsApp) → Feedback do cliente: **Negativo** → estudo e ajuste das campanhas; **Positivo** → manter campanhas e aumentar orçamento; **Sem retorno** → realizar ligação
  - Conteúdo (Madu, Reportei) → Reunião semanal de análise dos relatórios → Envio do relatório para o cliente
- **Acompanhamento do cliente**: reunião **quinzenal** se o cliente tem pendência e **mensal** se está estável (Madu/Jacke, Meet). Objetivos: entender como estão os leads e as vendas, analisar resultados e discutir ideias
- Observação do Miro: o levantamento consolidado de métricas hoje **só é feito quando o cliente está encerrando o contrato, e de forma manual**. O sistema deve permitir fazer isso de forma contínua.
- Alertas: contrato perto do fim, cliente sem feedback, relatório atrasado.

### 3.10 Portal do Cliente — FASE 2
Hoje o cliente tem acesso a um Trello próprio para ver o cronograma. Em fase 2: login do cliente para ver o cronograma, o grid, aprovar ou pedir alteração em vídeos e artes, e acessar entregas e relatórios.

---

## 4. Automações e regras de negócio (resumo)
1. Cadastro do cliente → cria a central, o checklist de onboarding e a tarefa "agendar briefing em até 2 dias úteis", e notifica Jackeline e Luiz conforme os serviços.
2. O mês do cliente é calculado pela data de início do contrato. Cada novo mês cria os slots Conteúdo 1…N.
3. Conteúdo com responsável definido → card automático no quadro do setor.
4. Movimento no quadro → atualiza o status no Controle de Mídias e no Controle Geral, e notifica o próximo responsável.
5. "Em alteração" volta o card para o responsável e conta como retrabalho (métrica).
6. Aprovado → destino "Cronograma" e/ou "Tráfego" e/ou "Drive".
7. Prazos recorrentes semanais (sexta: cronograma; segunda: legendas e posts programados; criativos novos no ar em até 2 dias).
8. Relatórios automáticos: produção por pessoa e período; entregue × contratado por cliente e mês.
9. Serviços contratados ligam ou desligam módulos e seções na central do cliente.

## 5. Integrações
- **Google Drive** (essencial): guardar links e, de preferência, criar automaticamente a estrutura de pastas do cliente (`Cliente / Conteúdos / Mês N – dd/mm a dd/mm / Conteúdo X – Tema`, `Materiais`, `Reuniões`, `Métricas`). Considerar a conta separada de 5 TB para takes brutos.
- Google Agenda / Meet (agendamentos de reunião e gravação)
- WhatsApp (fase 2: notificações e link do grupo)
- Reportei / Meta Ads / Google Ads (fase 2: puxar métricas)
- Importação inicial das planilhas "Controle de Clientes" e "Controle de Mídias" (CSV)

## 6. Requisitos técnicos sugeridos
- Web app responsivo, em PT-BR, com login por e-mail (Google OAuth opcional).
- Stack sugerida: Next.js + TypeScript + Tailwind + Supabase (Postgres, Auth, Storage, RLS por papel). Pode trocar se a ferramenta preferir outra.
- Kanban com drag-and-drop, comentários, histórico de atividade (quem moveu o quê e quando), anexos e links.
- Notificações dentro do app (e por e-mail/WhatsApp depois).
- Dashboard inicial por papel: gestor vê pendências e atrasos por cliente; colaborador vê "minhas tarefas".
- Design limpo e profissional (as cores dos status seguem o Trello atual: vermelho = não iniciado, azul = em andamento, roxo = aprovação, laranja = cronograma, verde = finalizado).

## 7. Modelo de dados mínimo
`users`, `roles`, `sectors`, `clients`, `contracts` (início, fim, escopo, valor), `client_services`, `client_months` (nº, período), `contents` (slot, formato, objetivo, tema, roteiro, legenda, status, gravação_resp, gravação_data, edição_resp, link_final, link_bruto, data_post, link_post), `boards`, `board_columns`, `cards` (→ content), `labels`, `comments`, `activity_log`, `briefings` (respostas em JSON por seção), `onboarding_tasks`, `meetings`, `recordings`, `materials/documents`, `reports`, `notifications`.

## 8. Ordem de entrega (MVP primeiro)
1. **MVP**: autenticação e papéis → cadastro de clientes e visão geral → central do cliente (visão geral, materiais, documentos) → Controle de Mídias com ciclo mensal → quadros Edição e Design ligados ao Controle de Mídias → relatório de produção por pessoa.
2. **Fase 1.5**: onboarding com checklist + briefing integrado; cronograma e grid; prazos recorrentes; notificações.
3. **Fase 2**: tráfego e relatórios semanais com o fluxo de feedback; integração com Drive e Agenda; portal do cliente; métricas automáticas.

## 9. Critérios de aceite do MVP
- Cadastrar um cliente com data de início no dia 14 gera "Mês 1: 14/mm a 14/mm+1" com N slots de conteúdo.
- Definir o editor de um conteúdo cria o card no quadro de Edição para esse editor.
- Mover o card até "Finalizado" atualiza o status no Controle de Mídias do cliente.
- O relatório mostra quantos vídeos cada editor finalizou em um período escolhido.
- Um colaborador comum não vê clientes ou tarefas fora do seu escopo.
