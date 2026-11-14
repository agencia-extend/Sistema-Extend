import type { Controller } from "@/features/privacy/queries";
import { List, Section, Table } from "./legal-blocks";

export const POLICY_SECTIONS = [
  ["quem", "Quem cuida dos seus dados"],
  ["quais", "Quais dados tratamos"],
  ["para-que", "Para que usamos e com qual base legal"],
  ["compartilhamento", "Com quem compartilhamos"],
  ["exterior", "Dados guardados fora do Brasil"],
  ["prazos", "Por quanto tempo guardamos"],
  ["seguranca", "Como protegemos"],
  ["cookies", "Cookies e armazenamento no aparelho"],
  ["direitos", "Seus direitos e como pedir"],
  ["mudancas", "Mudanças nesta política"],
] as const;

const FALLBACK_CONTACT = "hub.extend@agenciaextend.com.br";

export function PolicyContent({ c }: { c: Controller }) {
  const contact = c.dpoEmail ?? FALLBACK_CONTACT;
  const mail = <a href={`mailto:${contact}`} className="font-medium text-brand underline underline-offset-2">{contact}</a>;
  return (
    <div className="grid gap-10">
      <Section id="quem" n={1} title="Quem cuida dos seus dados">
        <p>
          O <strong>controlador</strong> dos dados tratados no sistema interno é a <strong>{c.legalName ?? "Agência Extend"}</strong>
          {c.cnpj ? <>, CNPJ {c.cnpj}</> : null}
          {c.address ? <>, com sede em {c.address}</> : null}. É a agência que decide para que e como os dados são usados.
        </p>
        <p>
          {c.dpoName ? <>O <strong>encarregado</strong> pela proteção de dados (DPO) é <strong>{c.dpoName}</strong>. </> : <>O canal do encarregado pela proteção de dados (DPO) é </>}
          {c.dpoName ? <>Fale com ele por {mail}.</> : <>{mail}.</>} Quem tem acesso ao sistema também pode fazer pedidos em <strong>Configurações → Meu perfil → Privacidade</strong>.
        </p>
        <p>Esta política vale para as pessoas da equipe que usam o sistema e para as pessoas dos clientes cujos dados a equipe registra para prestar o serviço (contatos, participantes de reuniões).</p>
      </Section>

      <Section id="quais" n={2} title="Quais dados tratamos">
        <Table
          caption="Dados tratados por categoria"
          head={["Categoria", "Dados"]}
          rows={[
            ["Cadastro da equipe", "Nome, e-mail, telefone, cargo, foto (se enviada), papel no sistema, setores e permissões."],
            ["Uso do sistema", "Demandas criadas e atribuídas, comentários e menções, tempo registrado, aprovações, treinamentos feitos, avisos recebidos, último acesso e o histórico de alterações (quem mudou o quê e quando)."],
            ["Aparelhos", "Quando você liga os avisos no celular ou computador: o endereço técnico de entrega do navegador e o tipo de aparelho."],
            ["Clientes da agência", "Dados da empresa e das pessoas de contato (nome, cargo, telefone, e-mail), reuniões e anotações, arquivos, ideias e identificadores das contas de anúncio e redes sociais atendidas."],
            ["Técnicos", "Cookies de sessão, data e hora de acesso e endereço IP registrados pelos provedores de hospedagem e login, por segurança."],
          ]}
        />
        <p>
          O sistema <strong>não pede dados sensíveis</strong> (saúde, religião, opinião política, origem racial, biometria e outros do art. 5º, II da LGPD).
          Não registre esse tipo de informação em comentários, fichas ou arquivos.
        </p>
      </Section>

      <Section id="para-que" n={3} title="Para que usamos e com qual base legal">
        <Table
          caption="Finalidades e bases legais"
          head={["Para que", "Base legal (art. 7º da LGPD)"]}
          rows={[
            ["Dar acesso ao sistema, distribuir e acompanhar o trabalho da equipe", "Execução de contrato com quem trabalha na agência (inciso V)."],
            ["Atender os clientes: fichas, contatos, reuniões, cronogramas, aprovações", "Execução do contrato com o cliente (inciso V) e legítimo interesse da agência em prestar o serviço (inciso IX)."],
            ["Segurança: login, histórico de alterações, encerrar sessões ao pausar um acesso", "Legítimo interesse (inciso IX) e cumprimento de obrigação legal de guarda de registros (inciso II)."],
            ["Enviar avisos no celular e no computador", "Consentimento (inciso I): você liga e desliga quando quiser, no sistema ou no aparelho."],
            ["E-mails de convite, senha e aviso de acesso", "Execução de contrato (inciso V) e segurança da conta (inciso IX)."],
            ["Treinamentos e acompanhamento de quem concluiu", "Legítimo interesse em capacitar a equipe (inciso IX)."],
            ["Responder a processos e fiscalizações", "Exercício regular de direitos (inciso VI) e obrigação legal (inciso II)."],
          ]}
        />
        <p>Não usamos os dados para publicidade, não vendemos dados e não tomamos decisões automatizadas que afetem você sem análise de uma pessoa.</p>
      </Section>

      <Section id="compartilhamento" n={4} title="Com quem compartilhamos">
        <p>Só com fornecedores que fazem o sistema funcionar, que tratam os dados em nome da agência (operadores) e apenas para isso:</p>
        <List>
          <li><strong>Supabase</strong>: banco de dados, login e arquivos.</li>
          <li><strong>Vercel</strong>: hospedagem do sistema (servidores nos Estados Unidos, ao lado do banco de dados).</li>
          <li><strong>Titan (contratado pela HostGator)</strong>: envio dos e-mails do sistema.</li>
          <li><strong>Serviços de aviso dos navegadores</strong> (Google, Apple, Mozilla, Microsoft): entregam o aviso no seu aparelho, com o título e o texto do aviso.</li>
          <li><strong>YouTube, Loom, Google Drive e Vimeo</strong>: só quando uma aula de treinamento tem vídeo dessas plataformas e você abre a aula. Vídeos do YouTube usam o modo de privacidade reforçada.</li>
        </List>
        <p>Também podemos informar dados a autoridades quando a lei ou uma ordem judicial exigir.</p>
      </Section>

      <Section id="exterior" n={5} title="Dados guardados fora do Brasil">
        <p>
          O banco de dados (Supabase) e o servidor do sistema (Vercel) ficam nos <strong>Estados Unidos</strong>. Essa transferência internacional segue o art. 33 da LGPD, com as garantias contratuais de proteção de dados oferecidas pelo fornecedor (cláusulas-padrão contratuais) e as medidas de segurança descritas no item 7.
        </p>
      </Section>

      <Section id="prazos" n={6} title="Por quanto tempo guardamos">
        <Table
          caption="Prazos de guarda"
          head={["Dado", "Prazo"]}
          rows={[
            ["Cadastro e trabalho de quem está na equipe", "Enquanto houver vínculo com a agência."],
            ["Depois do desligamento", "O acesso é pausado na hora. O histórico de trabalho fica guardado por até 5 anos, prazo para defesa em ações trabalhistas e cíveis, e depois é apagado ou anonimizado."],
            ["Avisos do sistema", "Apagados 180 dias depois de lidos, e no máximo 1 ano depois de enviados."],
            ["Convites não aceitos", "Apagados 90 dias depois de vencerem ou serem cancelados."],
            ["Aparelhos com avisos ligados", "Apagados depois de 1 ano sem uso."],
            ["Histórico de alterações (auditoria)", "5 anos."],
            ["Pedidos sobre dados pessoais", "5 anos depois de respondidos, como prova do atendimento."],
            ["Dados de clientes e seus contatos", "Durante o contrato e por até 5 anos depois, para obrigações legais e defesa de direitos."],
          ]}
        />
        <p>A limpeza dos avisos, convites, aparelhos e registros antigos é feita automaticamente todos os dias.</p>
      </Section>

      <Section id="seguranca" n={7} title="Como protegemos">
        <List>
          <li>Conexão sempre criptografada (HTTPS) e senhas guardadas de forma irreversível (hash).</li>
          <li>Cada pessoa vê só o que o papel e as permissões dela permitem, com a regra aplicada no próprio banco de dados, não só na tela.</li>
          <li>Chaves de acesso a ferramentas de terceiros são guardadas cifradas (AES-256-GCM).</li>
          <li>Alterações importantes ficam registradas com autor, data e o antes e depois.</li>
          <li>Quando um acesso é pausado, a sessão é encerrada em todos os aparelhos.</li>
        </List>
        <p>Se houver um incidente de segurança que possa trazer risco ou dano relevante, a agência avisa as pessoas afetadas e a Autoridade Nacional de Proteção de Dados (ANPD), como pede o art. 48 da LGPD.</p>
      </Section>

      <Section id="cookies" n={8} title="Cookies e armazenamento no aparelho">
        <p>
          O sistema usa apenas cookies e armazenamento <strong>necessários para funcionar</strong>: manter você conectado com segurança e lembrar preferências de tela. Não há cookies de publicidade nem de rastreamento. Como são essenciais, não dependem de consentimento; ao sair do sistema, a sessão é encerrada.
        </p>
      </Section>

      <Section id="direitos" n={9} title="Seus direitos e como pedir">
        <p>Pelo art. 18 da LGPD, você pode, a qualquer momento:</p>
        <List>
          <li>confirmar se tratamos seus dados e ter acesso a eles;</li>
          <li>corrigir dados incompletos, errados ou desatualizados;</li>
          <li>pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;</li>
          <li>receber seus dados em formato aberto para levar a outro fornecedor (portabilidade);</li>
          <li>saber com quem seus dados são compartilhados;</li>
          <li>retirar o consentimento, quando ele for a base do uso (como os avisos no aparelho);</li>
          <li>se opor a um uso feito com base em outra hipótese legal, quando houver descumprimento da lei.</li>
        </List>
        <p>
          <strong>Como pedir:</strong> no sistema, em <strong>Configurações → Meu perfil → Privacidade</strong>, você baixa uma cópia dos seus dados na hora e faz qualquer outro pedido. Quem não usa o sistema (por exemplo, contatos de clientes) pode escrever para {mail}. Respondemos em até <strong>15 dias</strong>.
        </p>
        <p>
          Alguns dados precisam ser mantidos mesmo com pedido de exclusão, quando a lei obriga ou para defesa em processos. Nesses casos explicamos o motivo na resposta. Você também pode reclamar à ANPD em{" "}
          <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2">gov.br/anpd</a>.
        </p>
      </Section>

      <Section id="mudancas" n={10} title="Mudanças nesta política">
        <p>Quando esta política mudar, a data no topo é atualizada e quem usa o sistema vê um aviso para ler a versão nova.</p>
      </Section>
    </div>
  );
}
