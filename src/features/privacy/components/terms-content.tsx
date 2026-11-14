import Link from "next/link";
import type { Controller } from "@/features/privacy/queries";
import { List, Section } from "./legal-blocks";

export const TERMS_SECTIONS = [
  ["o-que-e", "O que é o sistema"],
  ["acesso", "Seu acesso"],
  ["uso", "Uso permitido"],
  ["sigilo", "Dados de clientes e sigilo"],
  ["registros", "O que fica registrado"],
  ["suspensao", "Pausa e encerramento do acesso"],
  ["disponibilidade", "Disponibilidade"],
  ["contato", "Dúvidas"],
] as const;

export function TermsContent({ c }: { c: Controller }) {
  const owner = c.legalName ?? "Agência Extend";
  return (
    <div className="grid gap-10">
      <Section id="o-que-e" n={1} title="O que é o sistema">
        <p>
          O sistema interno da {owner} organiza o trabalho da equipe: demandas, clientes, aprovações, agenda, treinamentos e avisos. Ele é uma ferramenta de trabalho de uso exclusivo de quem foi convidado pela agência.
        </p>
      </Section>

      <Section id="acesso" n={2} title="Seu acesso">
        <List>
          <li>O acesso é pessoal e intransferível. Não compartilhe sua senha e não deixe outra pessoa usar sua conta.</li>
          <li>Use uma senha forte e só sua. Se suspeitar que alguém a descobriu, troque em Meu perfil e avise a coordenação.</li>
          <li>O que você vê depende do seu papel e das permissões definidas pela administração.</li>
        </List>
      </Section>

      <Section id="uso" n={3} title="Uso permitido">
        <List>
          <li>Use o sistema apenas para o trabalho da agência.</li>
          <li>Registre informações verdadeiras e necessárias para o serviço. Não registre dados sensíveis (saúde, religião, opinião política e outros) nem dados pessoais que não sejam necessários.</li>
          <li>Não tente acessar áreas, dados ou contas que não são suas, nem burlar as regras de acesso.</li>
          <li>Não copie listas de clientes, contatos ou materiais para fora do sistema sem autorização da agência.</li>
        </List>
      </Section>

      <Section id="sigilo" n={4} title="Dados de clientes e sigilo">
        <p>
          Informações de clientes (estratégias, resultados, acessos, contatos e materiais) são confidenciais. Elas só podem ser usadas para prestar o serviço e não podem ser divulgadas, mesmo depois que você deixar a agência.
        </p>
      </Section>

      <Section id="registros" n={5} title="O que fica registrado">
        <p>
          Para segurança e organização, o sistema registra quem criou ou alterou cada informação e quando, além do tempo lançado nas demandas. Esses registros podem ser consultados pela administração. Os detalhes estão na{" "}
          <Link href="/privacidade" className="font-medium text-brand underline underline-offset-2">Política de Privacidade</Link>.
        </p>
      </Section>

      <Section id="suspensao" n={6} title="Pausa e encerramento do acesso">
        <p>
          A administração pode pausar o acesso a qualquer momento, por exemplo no fim do vínculo com a agência ou por uso indevido. A sessão é encerrada em todos os aparelhos e você recebe um aviso por e-mail. O acesso pode ser reativado depois.
        </p>
      </Section>

      <Section id="disponibilidade" n={7} title="Disponibilidade">
        <p>A agência trabalha para manter o sistema no ar e com os dados protegidos, mas ele pode ficar fora do ar em manutenções ou falhas de fornecedores.</p>
      </Section>

      <Section id="contato" n={8} title="Dúvidas">
        <p>
          Fale com a coordenação da agência ou com o encarregado de dados em{" "}
          <a href={`mailto:${c.dpoEmail ?? "hub.extend@agenciaextend.com.br"}`} className="font-medium text-brand underline underline-offset-2">{c.dpoEmail ?? "hub.extend@agenciaextend.com.br"}</a>. Estes termos seguem a legislação brasileira.
        </p>
      </Section>
    </div>
  );
}
