# 11 — Passo a passo: Meta e Google, da criação à publicação

Para o Henrique, ou quem administra as contas da Extend.
- **Contas:** tudo é feito nas contas da Extend, nunca em conta pessoal.
- **Fontes:** conferido nas páginas oficiais em 15/11/2026.
- **Menus:** a Meta e o Google mudam nomes de menu com frequência. Se algo estiver diferente, procure o item mais parecido e avise.

Versão para seguir no celular, com caixas de marcar e botões de copiar: https://claude.ai/artifact/9SfsRU4vFKSM2KzUx12EJK

## Visão geral: por que em fases

| Fase | O que acontece | Quem |
|---|---|---|
| 1. Preparar | Criar o projeto do Google e o app da Meta; verificar domínio, marca e empresa | Henrique |
| 2. Conectar e usar | Chaves no sistema; a agência conecta; o sistema já funciona para a equipe | Henrique + desenvolvedor |
| 3. Completar o sistema | Sincronização dos números, painel do tráfego e páginas, que os vídeos das análises precisam mostrar | Desenvolvedor |
| 4. Verificações e análises | Verificação do Google (escopos) e análise da Meta (acesso avançado) com vídeos e textos | Henrique, com os textos deste guia |
| 5. Publicar | Google já publicado; Meta em modo Live; acesso completo da API de Marketing | Henrique |

**Por que a Meta só vem na fase 4:**
- Para a equipe e as contas dos clientes usarem o app, cada permissão precisa de "acesso avançado".
- O acesso avançado exige a verificação da empresa e a análise do app.
- A análise pede, para cada permissão, um vídeo mostrando o dado em uso dentro do sistema. Para `ads_read`, o vídeo precisa mostrar gasto, impressões, cliques, alcance e conversões na tela.
- Por isso a análise só é enviada depois que a sincronização e o painel existirem (fase 3).
- O botão de pedir acesso também só libera depois que o app fez pelo menos uma chamada à API com cada permissão.

**O que o sistema já tem para as verificações:**

| Exigência | Onde está |
|---|---|
| Página inicial pública que explica o app (não pode ser só o login) | `https://hub.agenciaextend.com.br` |
| Política de privacidade com o uso dos dados do Google e da Meta e a declaração de Uso Limitado | `https://hub.agenciaextend.com.br/privacidade` (seção 5) |
| Instruções de exclusão de dados (Meta) | `https://hub.agenciaextend.com.br/privacidade#exclusao` |
| Termos de uso | `https://hub.agenciaextend.com.br/termos` |
| Botões do Google no padrão de marca do Google | "Continuar com o Google" em Integrações e em Meu perfil |
| Ícone do app 1024×1024 (Meta) | `https://hub.agenciaextend.com.br/brand/app-icon-1024.png` |
| Escopo mínimo da agenda | `calendar.app.created`: o sistema cria uma agenda separada "Sistema Extend" e não vê as outras agendas da pessoa |
| Endereço de retorno do Google | `https://hub.agenciaextend.com.br/api/integracoes/google/retorno` |
| Endereço de retorno da Meta | `https://hub.agenciaextend.com.br/api/integracoes/meta/retorno` |

---

## Fase 1 — Preparar

### Google

Use a **conta Google que administra a MCC da Extend**. Se a MCC não existe, crie em <https://ads.google.com/home/tools/manager-accounts/> e vincule as contas dos clientes.

**G1. Projeto.**
1. Abra <https://console.cloud.google.com/projectcreate>.
2. Nome: **Sistema Extend**. Clique em **Create**.

**G2. Faturamento.**
1. Em **Billing**, vincule uma conta de faturamento da Extend.
2. A API não cobra pelo uso, mas sem faturamento ativo o pedido de acesso da Google Ads API é recusado.

**G3. APIs.**
1. Google Ads API: <https://console.cloud.google.com/flows/enableapi?apiid=googleads.googleapis.com>, depois **Enable**.
2. Google Calendar API: em **APIs & Services › Library**, procure "Google Calendar API" e clique em **Enable**.

**G4. Domínio verificado.**
1. No <https://search.google.com/search-console>, adicione a propriedade de domínio `agenciaextend.com.br`.
2. Crie no DNS da HostGator o registro TXT que o Google mostrar e clique em **Verificar**.
3. Faça isso com a mesma conta Google que é dona do projeto.

**G5. Google Auth Platform › Branding** (<https://console.cloud.google.com/auth/branding>)
- **App name:** `Sistema Extend` (o mesmo nome da página inicial).
- **User support email** e **Developer contact information:** e-mail da Extend.
- **App logo:** o ícone em `https://hub.agenciaextend.com.br/brand/app-icon-1024.png`. Baixe e reduza para 120×120 se o Google pedir. A logo faz parte da verificação da marca (G9).
- **Application home page:** `https://hub.agenciaextend.com.br`.
- **Application privacy policy link:** `https://hub.agenciaextend.com.br/privacidade`.
- **Application terms of service link:** `https://hub.agenciaextend.com.br/termos`.
- **Authorized domains:** `agenciaextend.com.br`.

**G6. Google Auth Platform › Audience** (<https://console.cloud.google.com/auth/audience>)
1. **User type:** External.
2. Clique em **Publish app** para passar para **In production**.
   - Em "Testing", as conexões caem a cada 7 dias.
   - Enquanto os escopos não forem verificados (fase 4), aparece a tela "app não verificado". Clique em **Avançado** e depois em **Acessar Sistema Extend**. O limite é de 100 pessoas, suficiente para a equipe.

**G7. Google Auth Platform › Data Access.** Em **Add or remove scopes**, marque:
- `openid`
- `.../auth/userinfo.email`
- `https://www.googleapis.com/auth/adwords`
- `https://www.googleapis.com/auth/calendar.app.created`

O Console mostra se cada escopo é "sensível". **Anote quais aparecem como sensíveis**: são esses que vão para a verificação da fase 4. Se nenhum aparecer como sensível, a fase 4 do Google se resume à verificação da marca.

**G8. Google Auth Platform › Clients** (<https://console.cloud.google.com/auth/clients>)
1. Clique em **Create client** e escolha **Web application**. Nome: Sistema Extend.
2. **Authorized redirect URIs:**
   - `https://hub.agenciaextend.com.br/api/integracoes/google/retorno`
   - para testes do desenvolvedor, também `http://localhost:3000/api/integracoes/google/retorno`
3. Clique em **Create** e **copie o Client ID e o Client secret na hora**. O segredo só aparece uma vez.

**G9. Verificação da marca** (é rápida e libera o acesso Basic do Google Ads)
1. Na página **Branding**, clique em **Verify Branding**.
2. O Google confere o domínio verificado, a página inicial (nome do app, o que ele faz, link da política) e a política no mesmo domínio.
3. Quando aparecer "Ready to publish", clique em **Publish branding**.

**G10. Acesso à Google Ads API** (<https://console.cloud.google.com/google/ads-apis/overview>)
1. Abra **Upgrade access level**. Em **Next access level**, escolha **Explorer** e clique em **Apply for access**.
   - A aprovação costuma ser automática.
   - O Explorer permite até 2.880 operações por dia em contas reais.
2. Depois da G9, peça **Basic** do mesmo jeito: 15.000 operações por dia.
3. Não existe mais developer token (aposentado em 09/09/2026). Não use a "Central de API" dentro do Google Ads.
4. Se aparecer `AUTHORIZATION_ERROR` com o acesso aprovado, o Google orienta criar um projeto novo.

### Meta

Use um perfil do Facebook que seja **administrador do portfólio empresarial (BM) da Extend**.

**M1. Verificar o domínio no BM.**
1. No Meta Business Suite, abra **Configurações › Segurança da marca › Domínios**.
2. Adicione `agenciaextend.com.br` e confirme pelo registro TXT no DNS da HostGator.

**M2. Criar o app.**
1. Abra <https://developers.facebook.com/apps/creation/>.
2. **Nome:** `Sistema Extend`. O nome não pode ter "Facebook", "Meta", "Face", "Book" nem "FB".
3. **Casos de uso:** o de **anúncios / API de Marketing** (algo como "Criar e gerenciar anúncios com a API de Marketing"). O Login do Facebook para Empresas entra junto.
   - Caso de uso não pode ser removido depois. Na dúvida, mande um print antes de confirmar.
4. **Empresa:** o portfólio da Extend.

**M3. Verificação da empresa** (leva alguns dias: comece cedo)
1. No app, abra **Configurações › Básico › Verificação** e clique em **Iniciar verificação**. Termine no gerenciador de negócios. Só um administrador do BM consegue concluir.
2. Tenha em mãos:
   - cartão CNPJ;
   - um documento com razão social e endereço, como conta de luz ou telefone, extrato bancário ou contrato social;
   - e-mail `@agenciaextend.com.br` ou telefone da empresa para o código de confirmação.
3. O nome e o endereço precisam ser **iguais** aos do CNPJ.

**M4. Configurações › Básico.**
- Copie o **ID do app** e a **Chave secreta do app** (clique em **Mostrar**).
- **Domínios do app:** `hub.agenciaextend.com.br`.
- **E-mail de contato:** e-mail da Extend.
- **URL da Política de privacidade:** `https://hub.agenciaextend.com.br/privacidade`.
- **URL dos Termos de serviço:** `https://hub.agenciaextend.com.br/termos`.
- **Exclusão de dados do usuário:** escolha a opção de URL de instruções e cole `https://hub.agenciaextend.com.br/privacidade#exclusao`.
- **Ícone do app (1024×1024):** baixe `https://hub.agenciaextend.com.br/brand/app-icon-1024.png` e envie.
- **Categoria:** Negócios e páginas (Business and Pages).
- **Finalidade do app:** **Clientes** (Clients), porque o app atende os clientes da agência.
- Em **+ Adicionar plataforma › Site**, coloque `https://hub.agenciaextend.com.br`.

**M5. Login do Facebook para Empresas.**
1. No menu do app, abra **Login do Facebook para Empresas › Configurações**. Em **URIs de redirecionamento do OAuth válidos**, cole `https://hub.agenciaextend.com.br/api/integracoes/meta/retorno`.
2. Em **Configurations**, clique em **+ Criar configuração**:
   - **Nome:** Sistema Extend.
   - **Tipo de token:** Token de acesso do usuário.
   - **Permissões:** `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`.
3. Clique em **Criar** e copie o **ID da configuração**.

**M6. Funções do app.** Em **Funções do app › Funções**, adicione como **Administrador** ou **Desenvolvedor** as pessoas que vão testar antes da aprovação (você, o Luiz). Só quem tem função no app consegue conectar enquanto ele está em desenvolvimento.

**M7. Usuário do sistema (conexão da agência).**
1. No Meta Business Suite, abra **Configurações › Usuários › Usuários do sistema** › **Adicionar**. Nome: Sistema Extend. Função: **Admin**.
2. **Atribuir ativos:**
   - o app Sistema Extend;
   - as **contas de anúncio**, inclusive as dos clientes compartilhadas com o BM;
   - as **páginas**, com permissão de ver o desempenho.
3. **Gerar token:**
   - **App:** Sistema Extend.
   - **Validade:** "Nunca", se aparecer. A Meta recomenda 60 dias; se escolher 60, o sistema avisa uma semana antes de vencer.
   - **Permissões:** `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`.
4. Copie o token. **Ele não vai para o `.env.local`**: você cola no sistema (fase 2).

---

## Fase 2 — Conectar e usar

1. **Preencher o `.env.local`** (fora do git; não mande pelo chat):
   ```
   META_APP_ID=          (M4)
   META_APP_SECRET=      (M4)
   META_LOGIN_CONFIG_ID= (M5)
   GOOGLE_CLIENT_ID=     (G8)
   GOOGLE_CLIENT_SECRET= (G8)
   ```
2. **Avisar "pronto".** O desenvolvedor copia para a Vercel sem exibir e publica de novo.
3. **Configurações › Integrações:**
   - **Meta:** cole o token do usuário do sistema (M7) e clique em **Salvar token e buscar contas**.
   - **Google Ads:** clique em **Continuar com o Google** com a conta da MCC e marque todas as caixas.
   - **Contas de anúncio:** escolha o cliente de cada conta e ligue **Entra no sistema**.
4. **Cada pessoa:** em **Meu perfil › Conexões**, clique em **Continuar com o Google**. Aparece no Google Agenda dela uma agenda "Sistema Extend" com os eventos do sistema.

5. **Prospectador (opcional, tem custo por uso):** no projeto do Google Cloud da Extend, ative a **Places API (New)**, crie uma chave de API restrita a essa API e defina um limite de gasto (orçamento com alerta). Coloque no `.env.local` `GOOGLE_PLACES_API_KEY=` e, se quiser outro limite de buscas por mês, `PROSPECTOR_MONTHLY_LIMIT=` (padrão 300; cada 20 empresas conta 1). Sem a chave, a aba Comercial › Prospectador não aparece.

Nesta fase, o app da Meta ainda está em desenvolvimento. O token do usuário do sistema lê os ativos do BM da Extend. Contas que pertencem aos clientes podem só aparecer depois do acesso avançado (fase 4); a tela de Integrações mostra o motivo, se acontecer.

---

## Fase 3 — Completar o sistema (desenvolvedor)

Com as contas conectadas e dados reais:
- **Sincronização:** os números das contas escolhidas chegam a cada 3 horas, da Meta e do Google Ads (feito em 25/11/2026; o Google só falta conferir com a MCC conectada).
- **Painel do tráfego:** gasto, impressões, alcance, cliques, leads, conversões e custo por resultado, por cliente e por campanha.
- **Números por criativo:** aparecem na biblioteca e no criativo, para a equipe de mídias.
- **Páginas e Instagram:** a lista das páginas que a agência administra, com o vínculo a cada cliente (`pages_show_list`) e os últimos posts da página ao lado do cronograma (`pages_read_engagement`).
- **Conta de revisor:** uma pessoa só para os revisores da Meta e do Google, com acesso à tela de Integrações e ao painel, sem dados que não precisem ver.

Cada tela só é dada como pronta depois de conferida com o Gerenciador de Anúncios e o Google Ads. Essas telas, com dados reais, são o que os vídeos da fase 4 mostram.

---

## Fase 4 — Verificações e análises

### Google: verificação dos escopos sensíveis
Só para os escopos marcados como sensíveis em G7.
1. **Google Auth Platform › Verification Center** (ou **Prepare for verification**).
2. Para cada escopo sensível, cole a justificativa (textos prontos abaixo).
3. **Vídeo de demonstração:** grave seguindo o roteiro abaixo, publique no YouTube como **não listado** e cole o link.
4. Clique em **Submit for verification**.
   - O Google responde por e-mail aos donos do projeto e pode pedir ajustes.
   - O prazo varia de dias a algumas semanas.
   - Enquanto isso, o app continua funcionando para a equipe, com a tela de "não verificado".

**Justificativa: `https://www.googleapis.com/auth/adwords`**
> Sistema Extend is the internal management system of Agência Extend, a marketing agency in Brazil that manages Google Ads for its client businesses. An agency administrator connects the Google account that manages the agency's Google Ads manager account (MCC). The app uses this scope only to read: it lists the client accounts under the MCC and reads campaign performance metrics (cost, impressions, clicks, conversions) to show them in the app's paid-traffic dashboard to the agency team and, for each client, in that client's private portal. The app never creates, edits or deletes campaigns, budgets or users. The Google Ads API has no narrower read-only scope.

**Justificativa: `https://www.googleapis.com/auth/calendar.app.created`**
> Optional for each team member. When a person connects their Google account, Sistema Extend creates one secondary calendar named "Sistema Extend" in that account and adds, updates and deletes in it only the events created in Sistema Extend (video recording sessions and client meetings) in which that person takes part. This keeps the agency schedule in the person's Google Calendar. We use calendar.app.created because it is the narrowest Calendar scope: the app cannot see or change any of the user's other calendars or events.

**Roteiro do vídeo do Google** (tela inteira, em inglês ou com legendas em inglês, 3 a 5 minutos)
1. Mostre `https://hub.agenciaextend.com.br`: nome do app, o que ele faz e o link da política de privacidade.
2. Entre no sistema. Abra **Configurações › Integrações** e clique em **Continuar com o Google**.
3. Na tela de consentimento, troque o idioma para **English**, no canto inferior esquerdo.
   - Mostre o nome do app e cada permissão pedida.
   - Mostre a barra de endereço com o `client_id`.
4. Permita. De volta ao sistema, mostre a MCC e a lista de contas encontradas. Depois mostre o painel do tráfego com os números (uso do `adwords`).
5. Abra **Meu perfil › Conexões**, clique em **Continuar com o Google**, mostre o consentimento em inglês com a permissão da agenda e permita.
6. Crie um evento na **Agenda** do sistema com você como participante.
   - Abra o Google Agenda e mostre a agenda "Sistema Extend" com o evento.
   - Altere e depois exclua o evento no sistema e mostre que mudou no Google.
7. Mostre **Desconectar** e a seção 5 da política de privacidade.

### Meta: análise do app (acesso avançado)
1. **Pré-requisitos:**
   - empresa verificada (M3);
   - app com pelo menos uma chamada bem-sucedida de cada permissão nos últimos 30 dias (acontece sozinho com o sistema conectado na fase 2 e as telas da fase 3).
2. **Análise do app › Permissões e recursos.** Para `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement` e `public_profile`, clique em **Solicitar acesso avançado** e depois em **Continuar a solicitação**.
3. **Perguntas sobre o tratamento de dados:**
   - **Operadores de dados que acessam dados da plataforma:** sim. Supabase (banco de dados) e Vercel (hospedagem), nos Estados Unidos.
   - **Responsável:** Agência Extend.
   - **Dados entregues a autoridades:** não.
   - **Política de proteção:** as regras da seção 8 da política de privacidade.
4. **Verificação do app (Platform settings):** descreva como entrar, com o texto pronto abaixo e a conta de revisor criada na fase 3.
5. **Permissões solicitadas:** para cada uma, cole a descrição pronta (cada descrição é diferente; a Meta recusa texto copiado entre permissões) e envie o vídeo dela.
6. Clique em **Enviar para análise** e aceite os termos. A Meta costuma responder em até uma semana.
7. Depois de aprovado:
   - **Análise do app › Permissões e recursos › Nível de acesso da API de Marketing:** clique em **+Upgrade** para o acesso completo. Ele exige 500 chamadas à API de Marketing em 15 dias e menos de 15% de erro; o sistema chega lá sozinho com a sincronização a cada 3 horas.
   - Faça a **Verificação de uso de dados** (Data Use Checkup), que é anual.

**Instruções para os revisores (Platform settings)**
> Sistema Extend is an invitation-only internal system of a marketing agency. To review: 1) Open https://hub.agenciaextend.com.br/login and sign in with the test account provided below. 2) Go to "Configurações" (Settings) > "Integrações" (Integrations). The "Meta (Facebook e Instagram)" section shows the connected Business Portfolio, the ad accounts found and the client each one belongs to. "Entrar com o Facebook" starts Facebook Login for Business. 3) Open the paid-traffic dashboard to see ads performance (spend, impressions, reach, clicks, results) read with ads_read. 4) Open a client page to see the client's Facebook Page and latest posts (pages_show_list, pages_read_engagement). The interface is in Portuguese; the screen recordings have English captions.

**Descrição: `ads_read`**
> Agência Extend manages paid ads for its client businesses. Through a system user of our Business Portfolio (or Facebook Login for Business), the agency admin connects the ad accounts we manage. We use ads_read to read performance insights (spend, impressions, reach, clicks, leads, conversions and cost per result) for campaigns, ad sets and ads of those accounts, on behalf of our clients. We show this data in our paid-traffic dashboard for the agency team, in the performance view of each ad creative for our design team, and in each client's private portal. We never create, edit or pause ads.

**Descrição: `business_management`**
> We use business_management to read which Business Portfolios the connected user or system user can access, and the ad accounts owned by those portfolios or shared with them by our clients (owned_ad_accounts and client_ad_accounts). In Settings > Integrations, the agency admin sees this list and chooses which client each ad account belongs to, so data from each account is shown only to that client's team and portal. We do not change any business settings, users or assets.

**Descrição: `pages_show_list`**
> We list the Facebook Pages that our agency manages for its clients so the agency admin can link each Page, and its connected Instagram account, to the right client in Sistema Extend. The list appears in the client's page and in Settings > Integrations.

**Descrição: `pages_read_engagement`**
> For the client Pages linked in the system, we read Page metadata and the latest posts so the agency's social media team sees, next to each client's content schedule, what was actually published and when. We do not publish, edit or delete posts.

**Descrição: `public_profile`**
> We read the name and ID of the person who connects through Facebook Login for Business only to show who made the connection ("Conectado por") in Settings > Integrations, for accountability within the agency.

**Roteiros dos vídeos da Meta** (1080p, mouse visível, sem áudio, legendas em inglês em cada clique)
- **Para todas:** comece em `https://hub.agenciaextend.com.br`, entre no sistema, abra **Configurações › Integrações**, clique em **Entrar com o Facebook** e mostre o login e a tela de permissões completa.
- **`ads_read`:** depois de conectar, abra o painel do tráfego. Mostre impressões, alcance, cliques, gasto e conversões de uma conta, e o mesmo número por criativo.
- **`business_management`:** mostre a lista de BMs e contas encontradas em Integrações e o vínculo de uma conta a um cliente.
- **`pages_show_list`:** mostre a lista de páginas e o vínculo de uma página a um cliente.
- **`pages_read_engagement`:** mostre os últimos posts de uma página na tela do cliente.
- **`public_profile`:** mostre "Conectado por" com o nome de quem conectou.

---

## Fase 5 — Publicar

**Google**
- O app já está "In production" desde a G6.
- Com os escopos verificados, a tela de "não verificado" some e o limite de 100 pessoas acaba.

**Meta**
1. Com o acesso avançado aprovado e a Verificação de uso de dados feita, use o **seletor de modo** no topo do painel do app para passar de **Desenvolvimento** para **Live**.
2. Depois disso, qualquer pessoa da equipe pode usar **Conectar meu Facebook** (Meu perfil › Conexões), sem precisar de função no app.
3. **Atenção:** mudar os campos de **Configurações › Básico** depois de aprovado pode gerar nova análise.

**Manutenção anual**
- Verificação de uso de dados da Meta: todo ano.
- Manter a política de privacidade atualizada sempre que o sistema passar a ler um dado novo da Meta ou do Google. O desenvolvedor atualiza a página e a versão.
