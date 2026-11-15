# 11 — Passo a passo: conectar a Meta e o Google

Para o Henrique (ou quem administra as contas da Extend). Tudo é feito **nas contas da Extend**, nunca em conta pessoal. Conferido nas páginas oficiais em 15/11/2026. A Meta e o Google mudam nomes de menu com frequência: se um nome estiver diferente, procure pelo item mais parecido e me avise.

**O que já está pronto no sistema:**
- **Configurações › Integrações:** conecta a Meta e o Google Ads da agência. Mostra o que falta configurar e o endereço de retorno, com botão de copiar.
- **Contas de anúncio:** depois de conectar, aparecem os BMs, a MCC e as contas encontradas. Você escolhe o cliente de cada conta e quais entram no sistema.
- **Meu perfil › Conexões:** cada pessoa conecta a própria Google Agenda. Os eventos do sistema em que ela participa vão para a agenda dela. Gestores podem conectar o próprio Facebook para trazer contas de clientes que não estão no BM.
- **Proteção:** os tokens ficam cifrados e o sistema avisa quando uma conexão vai vencer ou parou.

**Endereços que você vai precisar:**

| Para quê | Endereço |
|---|---|
| Retorno do Google (OAuth) | `https://hub.agenciaextend.com.br/api/integracoes/google/retorno` |
| Retorno da Meta (OAuth) | `https://hub.agenciaextend.com.br/api/integracoes/meta/retorno` |
| Página inicial | `https://hub.agenciaextend.com.br` |
| Política de privacidade | `https://hub.agenciaextend.com.br/privacidade` |
| Termos de uso | `https://hub.agenciaextend.com.br/termos` |
| Instruções de exclusão de dados (Meta) | `https://hub.agenciaextend.com.br/privacidade#exclusao` |

Para testes no computador do desenvolvedor, cadastre também os retornos com `http://localhost:3000` no lugar de `https://hub.agenciaextend.com.br`.

---

## Parte A — Google (Google Ads, Google Agenda)

Use a **conta Google que administra a MCC da Extend**. Se a MCC ainda não existe, crie em <https://ads.google.com/home/tools/manager-accounts/> e vincule as contas dos clientes a ela.

### A1. Criar o projeto
1. Abra <https://console.cloud.google.com/projectcreate>.
2. Nome do projeto: **Sistema Extend**. Clique em **Create**.

### A2. Ligar o faturamento (obrigatório para o acesso Explorer da Google Ads API; a API não cobra pelo uso)
1. No projeto, vá em **Billing** (Faturamento) e vincule uma conta de faturamento da Extend.
2. Projetos em período de teste gratuito, ou com o faturamento suspenso, têm o pedido de acesso recusado.

### A3. Ativar as APIs
1. Google Ads API: <https://console.cloud.google.com/flows/enableapi?apiid=googleads.googleapis.com>, depois **Enable**.
2. Google Calendar API: em **APIs & Services › Library**, procure "Google Calendar API" e clique em **Enable**.

### A4. Verificar o domínio
1. Em <https://search.google.com/search-console>, adicione a propriedade de domínio **agenciaextend.com.br**.
2. O Google mostra um registro TXT. Crie esse registro no DNS da HostGator e espere a verificação.

### A5. Google Auth Platform › Branding
<https://console.cloud.google.com/auth/branding>
1. **App name:** Sistema Extend. **User support email:** o e-mail da Extend.
2. **App domain:** página inicial, política de privacidade e termos, com os endereços da tabela acima.
3. **Authorized domains:** `agenciaextend.com.br`.
4. **Developer contact information:** o e-mail da Extend.
5. Não envie logo por enquanto. A logo obriga uma verificação extra da marca.

### A6. Google Auth Platform › Audience
<https://console.cloud.google.com/auth/audience>
1. **User type:** External.
2. **Publishing status:** clique em **Publish app** para passar para **In production**.
   - **Importante:** em "Testing", as conexões caem a cada 7 dias.
   - Enquanto o app não for verificado, quem conectar vê uma tela de "app não verificado": clique em **Avançado** e depois em **Acessar Sistema Extend**.
   - Sem verificação, o limite é de 100 pessoas, o que é suficiente para a equipe.
   - A verificação pode ser pedida depois, em **Verification Center**, e pede um vídeo mostrando a conexão.

### A7. Google Auth Platform › Data Access
Clique em **Add or remove scopes** e marque:
- `openid`
- `.../auth/userinfo.email`
- `https://www.googleapis.com/auth/adwords` (Google Ads)
- `https://www.googleapis.com/auth/calendar.events` (Google Agenda)

### A8. Google Auth Platform › Clients (o "ID do cliente OAuth")
<https://console.cloud.google.com/auth/clients>
1. Clique em **Create client** e escolha o tipo **Web application**. Nome: Sistema Extend.
2. **Authorized redirect URIs:** cole o retorno do Google da tabela acima. Para testes, cole também a versão com `localhost`.
3. Clique em **Create** e **copie o Client ID e o Client secret na hora**. O segredo só aparece uma vez.

### A9. Nível de acesso da Google Ads API
<https://console.cloud.google.com/google/ads-apis/overview>
1. O developer token **não existe mais**: o Google aposentou em 09/09/2026. Não use a "Central de API" dentro do Google Ads.
2. Abra **Upgrade access level**. Confira se **Next access level** está em **Explorer** e clique em **Apply for access**. A aprovação costuma ser automática.
3. O Explorer já lê as contas reais dos clientes, com até 2.880 operações por dia em contas de produção. Para mais, peça **Basic**, que exige a verificação da marca.
4. **Problema conhecido do Google:** se aparecer `AUTHORIZATION_ERROR` mesmo com o Explorer aprovado, o Google orienta criar um projeto novo.

---

## Parte B — Meta (Facebook e Instagram)

Use um perfil do Facebook que seja **administrador do portfólio empresarial (BM) da Extend**.

### B1. Verificar a empresa (BM)
1. A verificação demora alguns dias: comece por ela.
2. No app da Meta (passo B2), vá em **Configurações › Básico › Verificação**, clique em **Iniciar verificação** e termine no gerenciador de negócios.
3. Pedem CNPJ, comprovante de endereço e um telefone ou e-mail do domínio.
4. A verificação é exigida para ler contas de anúncio que **pertencem aos clientes** (passo B6).

### B2. Criar o app
1. Abra <https://developers.facebook.com/apps/creation/>.
2. **Nome:** Sistema Extend. Coloque o e-mail de contato e clique em **Avançar**.
3. **Casos de uso:** escolha o de **anúncios / API de Marketing** (algo como "Criar e gerenciar anúncios com a API de Marketing").
   - O "Login do Facebook para Empresas" entra junto.
   - Caso de uso não pode ser removido depois. Na dúvida, me mande um print da lista antes de confirmar.
4. **Empresa:** escolha o **portfólio empresarial da Extend**. Avance até o painel.

### B3. Configurações › Básico
1. Copie o **ID do app** e a **Chave secreta do app** (clique em **Mostrar**).
2. **Domínios do app:** `hub.agenciaextend.com.br`.
3. **Política de privacidade**, **Termos de serviço** e **Exclusão de dados do usuário:** os endereços da tabela acima.
4. **Ícone do app** e **Categoria:** preencha para poder colocar o app no ar.

### B4. Login do Facebook para Empresas
1. No menu do app, abra **Login do Facebook para Empresas › Configurações**.
   - Em **URIs de redirecionamento do OAuth válidos**, cole o retorno da Meta da tabela acima.
2. Em **Login do Facebook para Empresas › Configurações (Configurations)**, clique em **+ Criar configuração**.
   - Nome: Sistema Extend.
   - Tipo de token: **Token de acesso do usuário**.
   - Permissões: `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`.
3. Clique em **Criar** e copie o **ID da configuração**.

### B5. Usuário do sistema (forma recomendada para a agência)
O token do usuário do sistema não depende do Facebook de ninguém e é o jeito mais estável.
1. No **Meta Business Suite**, abra **Configurações › Usuários › Usuários do sistema**.
2. Clique em **Adicionar**. Nome: Sistema Extend. Função: **Admin**.
3. Clique em **Atribuir ativos**. Marque as **contas de anúncio**, inclusive as dos clientes compartilhadas com o BM, e as **páginas**, com permissão de ver o desempenho.
4. Clique em **Gerar token**:
   - **App:** Sistema Extend.
   - **Validade:** "Nunca", se aparecer. Se só houver 60 dias, tudo bem: o sistema avisa uma semana antes de vencer.
   - **Permissões:** `ads_read`, `business_management`, `pages_show_list` e `pages_read_engagement`.
5. Copie o token. **Ele não vai para o `.env.local`**: você cola direto no sistema, no passo C3.

### B6. Nível de acesso da Meta
- O app começa com o acesso **limitado** (antes "Standard Access"). Esse acesso já lê as contas de anúncio que **pertencem ao BM da Extend**.
- Contas que **pertencem aos clientes** podem exigir o acesso **completo** (antes "Advanced Access") de `ads_read` e `business_management`.
  - Ele é pedido em **Análise do app › Permissões e recursos › Solicitar acesso avançado**.
  - Exige a verificação da empresa (B1).
  - A Meta também libera esse acesso pelo uso: 500 chamadas em 15 dias com menos de 15% de erro.
- Se, ao conectar, alguma conta de cliente não aparecer, o sistema mostra o motivo e seguimos por esse caminho.

---

## Parte C — Colocar no sistema

### C1. Preencher o `.env.local`
Preencha no `.env.local` do computador do desenvolvedor (fora do git). **Não mande essas chaves pelo chat.**
```
META_APP_ID=          (B3)
META_APP_SECRET=      (B3)
META_LOGIN_CONFIG_ID= (B4, opcional, mas recomendado)
GOOGLE_CLIENT_ID=     (A8)
GOOGLE_CLIENT_SECRET= (A8)
```
A `TOKEN_ENCRYPTION_KEY` já está criada. Não precisa de developer token nem de ID da MCC: o sistema encontra a MCC sozinho.

### C2. Avisar o desenvolvedor
Avise com "pronto". O desenvolvedor copia as chaves para a Vercel sem exibi-las e publica de novo.

### C3. Conectar a agência
Em **Configurações › Integrações**:
1. **Meta:** cole o token do usuário do sistema (B5) e clique em **Salvar token e buscar contas**. A outra opção é **Entrar com o Facebook**.
2. **Google Ads:** clique em **Entrar com o Google** com a conta que administra a MCC e marque todas as caixas de permissão.
3. **Contas de anúncio:** escolha o cliente de cada conta.
   - Quando o cliente já tem a conta cadastrada em "Contas e acessos", o sistema sugere o vínculo.
   - Ligue **Entra no sistema** nas contas que devem ser acompanhadas.

### C4. Conexões de cada pessoa
Em **Meu perfil › Conexões**:
- **Conectar Google Agenda**, para os eventos do sistema irem para a agenda do Google.
- Gestores que administram contas de clientes fora do BM: **Conectar meu Facebook**.

---

## Depois de conectar (próximas entregas)
Com as contas ligadas e testadas com dados reais, entram (prompt 05):
- sincronização dos números a cada 3 horas;
- painel do tráfego em tabela;
- saldo e alertas;
- números por criativo para a equipe de mídias;
- vínculo do plano de campanha;
- verificador de nomes fora do padrão.

Depois disso, os relatórios automáticos (prompt 06). Cada uma só é dada como pronta depois de conferida com o Gerenciador de Anúncios e o Google Ads.
