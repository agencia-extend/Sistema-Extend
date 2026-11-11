# 04 — Integrações (configuração nas contas da Extend)

Todas as contas abaixo pertencem à **Extend**. O desenvolvedor recebe acesso como administrador/colaborador, nunca como dono.

## Supabase
1. Organização "Extend" com dois projetos: `extend-dev` e `extend-prod` (região São Paulo).
2. Extensões: `pg_cron`, `pg_net`, `pgmq`, `pg_trgm`, `pgcrypto`.
3. Auth: e-mail/senha (cadastro público **desligado**), Google opcional, URL do site e de redirecionamento, template de convite em português.
4. Storage: bucket privado `anexos`.
5. Plano: avaliar Pro desde o início (backups diários, sem pausa por inatividade).

## Vercel
Projeto no time da Extend, região gru1, domínio **[CONFIRMAR: ex. sistema.agenciaextend.com.br]**, variáveis de ambiente de `docs/02`. Deploy por push na branch `main`; migrations aplicadas por comando explícito antes do deploy.

## Meta (Facebook/Instagram Ads, páginas, Instagram, WhatsApp)
1. **Iniciar na semana 1** — a verificação demora.
2. BM da Extend **verificado** (verificação da empresa).
3. App tipo "Business" no developers.facebook.com, de propriedade do BM da Extend.
4. Produtos: Facebook Login for Business (configuração com `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`; depois `ads_management` para a etapa 11 e `pages_manage_posts`, `instagram_basic`, `instagram_content_publish` para a etapa 10), Marketing API, WhatsApp (se usar Cloud API).
5. **App Review / Acesso avançado** das permissões usadas (com vídeo de demonstração do sistema) e política de privacidade/termos/exclusão de dados publicados no domínio do sistema.
6. Preferir **token de System User** do BM para a sincronização (não expira em 60 dias); manter o fluxo de login para as contas de clientes que não estão no BM.
7. Contas de anúncio de clientes: compartilhadas com o BM da Extend (parceiro) ou conectadas pelo login do gestor. Não precisam estar todas no mesmo BM.
8. Versão da Graph API em variável (`META_GRAPH_VERSION`).

## Google Ads
1. Conta administradora (MCC) da Extend com todas as contas de clientes vinculadas.
2. Projeto no Google Cloud da Extend: Google Ads API ativada, tela de consentimento OAuth (externa, em produção), credenciais Web.
3. **Developer token**: verificar na documentação oficial se ainda é exigido e em qual nível de acesso (o código do HubSystem traz comentário dizendo que foi aposentado em 09/2026 — confirmar antes de implementar).
4. `login-customer-id` = ID da MCC, **guardado por conta** no banco.
5. Escopo `https://www.googleapis.com/auth/adwords`, `access_type=offline`, `prompt=consent`.

## WhatsApp
- **Número dedicado da Extend** (não usar número pessoal).
- **WAHA (QR Code, não oficial):** necessário para enviar a **grupos** (relatórios e alertas). Hospedar o servidor WAHA da Extend (VPS ou serviço gerenciado) com API key; webhook assinado por número. Risco: bloqueio do número — por isso relatórios vão para grupo interno, com intervalo entre mensagens.
- **Cloud API oficial (opcional, etapa 07):** inbox de atendimento comercial com modelos aprovados, janela de 24 h e webhook `X-Hub-Signature-256`. Não envia para grupos.

## Google Drive **[decisão pendente]**
- Conta Google Workspace/Drive da Extend; pasta raiz "Clientes".
- OAuth da conta da Extend (ou service account com Drive compartilhado) para criar pastas por cliente e subir arquivos.
- Upload grande (vídeo) direto do navegador para o Drive via sessão de upload retomável, sem passar pela Vercel.

## Google Agenda
OAuth por usuário (opcional), sincronização incremental com `syncToken` e canal de push. Eventos criados no sistema vão para a agenda do usuário conectado.

## Google Places (prospectador, etapa 08)
Chave restrita por API e por referer/servidor; limite de gasto mensal configurado no Google Cloud e exibido no sistema.

## Web Push
Chaves VAPID geradas uma vez e guardadas como variáveis de ambiente.
