# WAHA da Extend (WhatsApp por QR Code)

O WhatsApp por QR Code precisa de um processo ligado o tempo todo, fora da Vercel. O WAHA roda em Docker: hoje na máquina do Henrique, depois numa VPS da Extend. Tudo o mais (tela de conexão, grupos, alertas, relatórios, mensagens) roda no sistema publicado.

Ele é separado do WAHA do HubSystem: os contêineres se chamam `extend-waha` e `extend-waha-tunnel`, a porta é `127.0.0.1:3032` e os volumes são `extend-waha_sessions` e `extend-waha_media`.

## Na máquina local (agora)

1. Abra o Docker Desktop.
2. O arquivo `infra/waha/.env` já existe com `WAHA_API_KEY` (a chave) e `WAHA_API_KEY_HASH` (o SHA-512 dela, que o WAHA usa). Ele fica fora do Git. Para trocar a chave:
   `node -e "const k=require('crypto').randomBytes(32).toString('base64url');console.log('WAHA_API_KEY='+k+'\nWAHA_API_KEY_HASH=sha512:'+require('crypto').createHash('sha512').update(k).digest('hex'))" > infra/waha/.env`
3. Nesta pasta, rode `docker compose up -d`. Isso sobe só o WAHA, acessível somente nesta máquina.
4. Para o sistema publicado (Vercel) alcançar o WAHA, ligue o túnel com `docker compose --profile tunnel up -d`. Isso sobe três contêineres: o WAHA, o túnel e o `extend-waha-anuncio`.
   - O `anuncio` lê o endereço `https://….trycloudflare.com` do túnel e avisa o sistema sozinho (`POST /api/whatsapp/servidor`, assinado com HMAC-SHA256 pela `WAHA_API_KEY`). Quando o túnel reinicia e o endereço muda, o sistema recebe o novo em até 30 segundos. Ninguém precisa copiar endereço.
   - A mesma `WAHA_API_KEY` fica na Vercel (variável de produção, secreta): é com ela que o sistema fala com o WAHA e confere o aviso.
   - Para conferir: `docker logs extend-waha-anuncio` mostra "endereço novo enviado" ou "endereço confirmado".
5. No sistema, em **Atendimento** (ou **Configurações › WhatsApp**), clique em **Conectar WhatsApp** e leia o QR Code com o celular do número da Extend. Quem está no próprio celular do número pode usar "Conectar com código".
6. Logo depois, clique em **Compilar conversas** para trazer o histórico do aparelho: conversas individuais e grupos, com até 500 mensagens recentes de cada. A compilação continua sozinha no servidor e avisa quando termina.
7. Em **Configurações › WhatsApp**, toque em **Buscar grupos**, ligue cada grupo ao cliente dele, marque o grupo de **alertas internos** e mande um **Teste**.

Conferir: `GET http://127.0.0.1:3032/api/sessions` responde 401 sem `X-Api-Key` e 200 com a chave.

Se a máquina desligar, o WhatsApp para de enviar até ela voltar (os contêineres sobem sozinhos com o Docker). Os alertas que não saírem nesse período ficam registrados em "Últimos envios" como falha.

## Na VPS (depois)

1. Instale o Docker e copie esta pasta para a VPS.
2. Gere um `.env` novo na VPS (passo 2 acima).
3. Não use o perfil `tunnel`. Ponha um proxy com HTTPS (Caddy ou Nginx) na frente da porta 3032, por exemplo em `https://whatsapp.agenciaextend.com.br`, e aponte o DNS na HostGator.
4. Leve a sessão para não ler o QR Code de novo: copie o volume `extend-waha_sessions`. Ou simplesmente conecte de novo pelo QR Code.
5. Ponha `WAHA_URL=https://whatsapp.agenciaextend.com.br` e a `WAHA_API_KEY` nova na Vercel, ou troque em **Configurações › WhatsApp › Servidor do WhatsApp**. Não precisa de deploy.
6. Desligue o WAHA local: `docker compose --profile tunnel down`.

## Segurança

- A chave nunca vai para o Git nem para a tela: o banco guarda cifrada (AES-256-GCM).
- Os eventos do WAHA (mensagens e situação) chegam assinados com HMAC-SHA512 por um segredo próprio da conexão; o sistema recusa os que não batem.
- O WAHA só escuta em `127.0.0.1`. O acesso de fora é só pelo túnel ou pelo proxy com HTTPS.
- Faça backup do volume `extend-waha_sessions` (é a sessão do número).
