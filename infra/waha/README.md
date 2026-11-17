# WAHA da Extend (WhatsApp por QR Code)

O WhatsApp por QR Code precisa de um processo ligado o tempo todo, fora da Vercel. O WAHA roda em Docker: hoje na máquina do Henrique, depois numa VPS da Extend. Tudo o mais (tela de conexão, grupos, alertas, relatórios, mensagens) roda no sistema publicado.

Ele é separado do WAHA do HubSystem: os contêineres se chamam `extend-waha` e `extend-waha-tunnel`, a porta é `127.0.0.1:3032` e os volumes são `extend-waha_sessions` e `extend-waha_media`.

## Na máquina local (agora)

1. Abra o Docker Desktop.
2. O arquivo `infra/waha/.env` já existe com `WAHA_API_KEY` (a chave) e `WAHA_API_KEY_HASH` (o SHA-512 dela, que o WAHA usa). Ele fica fora do Git. Para trocar a chave:
   `node -e "const k=require('crypto').randomBytes(32).toString('base64url');console.log('WAHA_API_KEY='+k+'\nWAHA_API_KEY_HASH=sha512:'+require('crypto').createHash('sha512').update(k).digest('hex'))" > infra/waha/.env`
3. Nesta pasta, rode `docker compose up -d`. Isso sobe só o WAHA, acessível somente nesta máquina.
4. Para o sistema publicado (Vercel) alcançar o WAHA, ligue o túnel com `docker compose --profile tunnel up -d`.
   - O endereço `https://….trycloudflare.com` aparece em `docker logs extend-waha-tunnel`.
   - Esse endereço muda toda vez que o túnel reinicia: quando mudar, cole o novo em **Configurações › WhatsApp › Servidor**.
5. No sistema, em **Configurações › WhatsApp**:
   1. cole o endereço e a chave (`WAHA_API_KEY`) e clique em **Testar e salvar**;
   2. toque em **Conectar número**, leia o QR Code com o celular do número da Extend (ou use o código por número);
   3. toque em **Buscar grupos**, ligue cada grupo ao cliente dele e marque o grupo de **alertas internos**;
   4. mande um **Teste**.

Conferir: `GET http://127.0.0.1:3032/api/sessions` responde 401 sem `X-Api-Key` e 200 com a chave.

Se a máquina desligar, o WhatsApp para de enviar até ela voltar (os contêineres sobem sozinhos com o Docker). Os alertas que não saírem nesse período ficam registrados em "Últimos envios" como falha.

## Na VPS (depois)

1. Instale o Docker e copie esta pasta para a VPS.
2. Gere um `.env` novo na VPS (passo 2 acima).
3. Não use o perfil `tunnel`. Ponha um proxy com HTTPS (Caddy ou Nginx) na frente da porta 3032, por exemplo em `https://whatsapp.agenciaextend.com.br`, e aponte o DNS na HostGator.
4. Leve a sessão para não ler o QR Code de novo: copie o volume `extend-waha_sessions`. Ou simplesmente conecte de novo pelo QR Code.
5. Em **Configurações › WhatsApp › Servidor**, troque o endereço e a chave. Não precisa de deploy.
6. Desligue o WAHA local: `docker compose --profile tunnel down`.

## Segurança

- A chave nunca vai para o Git nem para a tela: o banco guarda cifrada (AES-256-GCM).
- Os eventos do WAHA (mensagens e situação) chegam assinados com HMAC-SHA512 por um segredo próprio da conexão; o sistema recusa os que não batem.
- O WAHA só escuta em `127.0.0.1`. O acesso de fora é só pelo túnel ou pelo proxy com HTTPS.
- Faça backup do volume `extend-waha_sessions` (é a sessão do número).
