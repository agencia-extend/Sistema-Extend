// Gera a migração da ficha de briefing por seções A–E (docs/08, item 3.3). Uso: node scripts/gen-briefing.mjs
import { writeFileSync } from "node:fs";

const q = (key, label, type = "textarea", o = {}) => ({ key, label, type, required: false, visibility: "operational", ...o });
const sel = (key, label, options, o = {}) => q(key, label, "select", { options, ...o });
const multi = (key, label, options, o = {}) => q(key, label, "multiselect", { options, ...o });
const FULL = { visibility: "full" };
const REQ = { required: true };

const sections = [
  {
    key: "geral", title: "A. Geral", questions: [
      multi("servicos_extend", "Serviços que vai executar com a Extend", ["Tráfego Google Ads", "Tráfego Meta Ads", "Produção de vídeos", "Produção de designs", "Gerenciamento de redes", "Desenvolvimento de site/LP"]),
      q("o_que_faz", "O que a empresa faz hoje (serviços e produtos)", "textarea", REQ),
      q("tempo_atuacao", "Há quanto tempo atua", "text"),
      q("processo_vendas", "Como é o processo de vendas hoje", "textarea", REQ),
      q("oferta", "Principais serviços ou produtos a divulgar", "textarea", REQ),
      sel("publico_genero", "Gênero predominante do público", ["Mulheres", "Homens", "Equilibrado"]),
      multi("publico_idade", "Faixa etária do público", ["18 a 24", "25 a 34", "35 a 44", "45 a 54", "55 ou mais"]),
      sel("publico_poder", "Poder aquisitivo do público", ["Baixo", "Médio", "Alto", "Muito alto"]),
      sel("publico_tipo", "B2C ou B2B", ["B2C (pessoa física)", "B2B (empresas)", "Os dois"]),
      q("publico_desejado", "Público desejado, se for diferente do atual"),
      q("dores", "Dores, necessidades e desejos que o produto resolve", "textarea", REQ),
      q("objecoes", "O que impede a compra"),
      multi("percepcao", "Como a marca quer ser percebida", ["Profissional/técnica", "Sofisticada/alto padrão", "Próxima/acessível", "Educativa", "Autoridade", "Leve/divertida"]),
      q("tom", "Tom de comunicação"),
      q("nao_transmitir", "O que a marca NÃO deve transmitir"),
    ],
  },
  {
    key: "trafego", title: "B. Tráfego pago", show_for: ["anuncios"], questions: [
      sel("ja_anunciou", "Já anunciou antes?", ["Nunca", "Meta Ads", "Google Ads", "Os dois"]),
      q("acesso_contas", "Acessos às contas (BM, conta de anúncios, Google Ads)", "textarea", FULL),
      sel("acesso_site", "Tem programador ou acesso ao painel do site (para tags e pixel)?", ["Sim, tem programador", "Sim, acesso ao painel", "Não"]),
      sel("objetivo_trafego", "Objetivo principal", ["Vendas no site", "Mensagens no WhatsApp", "Cadastros (leads)", "Ligações", "Visitas à loja", "Outro"], REQ),
      q("investimento_meta", "Investimento mensal em Meta Ads", "text", FULL),
      q("investimento_google", "Investimento mensal em Google Ads", "text", FULL),
      q("ticket", "Ticket médio", "text", FULL),
      q("meta_faturamento", "Meta de faturamento ou de vendas", "text", FULL),
      q("regiao", "Regiões de atuação"),
      q("horario_atendimento", "Horário de atendimento (anúncio 24h ou só no horário comercial)", "text"),
      q("concorrentes", "3 principais concorrentes"),
      q("carro_chefe", "Produto ou serviço carro-chefe", "text"),
      q("formas_pagamento", "Formas de pagamento aceitas", "text"),
      q("promocoes", "Promoções e datas comemorativas"),
      q("palavras_chave", "Palavras-chave (Google)"),
      q("palavras_negativas", "Palavras negativas (Google)"),
      q("whatsapp_anuncios", "WhatsApp de atendimento para os anúncios", "text"),
      sel("pagamento_anuncios", "Como os anúncios serão pagos", ["Cartão de crédito", "Boleto/PIX pré-pago", "Outro"], FULL),
      q("restricoes_meta", "Restrições da Meta (área sensível: saúde, imóveis, crédito…)"),
    ],
  },
  {
    key: "videos", title: "C. Produção de vídeos", show_for: ["videos", "gravacao"], questions: [
      q("videos_antes", "Já produziu vídeos? Como foi?"),
      q("video_estilo", "Estilo e linguagem com que se identifica"),
      q("video_referencias", "Perfis de referência"),
      q("video_nao", "O que NÃO quer fazer ou mostrar"),
      q("temas_refazer", "Temas que quer refazer"),
      q("temas_desejados", "Temas que já queria produzir"),
      sel("gravacao_estilo", "Estilo de gravação", ["Dinâmica", "Estática", "Confio na Extend"]),
      sel("edicao_estilo", "Estilo de edição", ["Clean", "Impactante", "Divertida", "Confio na Extend"]),
      q("legenda_videos", "Quer legenda em todos os vídeos?", "boolean"),
      sel("roteiro_estilo", "Estilo de roteiro", ["Frases curtas", "Tópicos de direcionamento", "Roteiro completo", "Confio na Extend"]),
    ],
  },
  {
    key: "design", title: "D. Design", show_for: ["design", "conteudo", "gerenciamento"], questions: [
      q("tem_identidade", "Tem identidade visual?", "boolean"),
      q("manual_marca", "Manual de marca (link)", "url"),
      q("cores", "Códigos de cor", "text"),
      q("fontes", "Fontes", "text"),
      q("logo_alta", "Logo em alta (link; envie também em Materiais)", "url"),
      q("fotos_profissionais", "Fotos profissionais (link)", "url"),
      q("elementos_obrigatorios", "Elementos obrigatórios nos posts"),
      q("elementos_proibidos", "Elementos proibidos"),
      sel("design_estilo", "Estilo de design", ["Minimalista", "Chamativo", "Elegante", "Divertido", "Confio na Extend"]),
      q("design_referencias", "3 referências"),
    ],
  },
  {
    key: "site", title: "E. Site / Landing page", show_for: ["site"], questions: [
      q("tem_site", "Já tem site?", "boolean"),
      q("site_backup", "Tem backup do site?", "boolean"),
      sel("site_objetivo", "Objetivo do site", ["Institucional", "Geração de leads", "Vendas (loja)", "Página de produto ou evento"]),
      q("site_regiao", "Cidade ou região de foco", "text"),
      q("site_identidade", "Identidade visual, logo, cores e fontes do site"),
      q("site_paginas", "Páginas e seções necessárias"),
      q("site_funcionalidades", "Funcionalidades (botão de WhatsApp, formulário…)"),
      q("site_integracoes", "Integrações (WhatsApp, Instagram…)"),
      q("site_referencias", "3 sites de referência e por quê"),
      q("site_nao", "O que NÃO quer no site"),
    ],
  },
  {
    key: "obrigacoes", title: "Obrigações do cliente", questions: [
      q("porta_voz", "Porta-voz do projeto (quem decide e aprova)", "text"),
      q("prazo_feedback_leads", "Prazo para dar retorno sobre os leads", "text"),
      q("prazo_resposta", "Prazo para responder a equipe", "text"),
      q("prazo_aprovacao", "Prazo para aprovar conteúdos e campanhas", "text"),
      q("criativos_cliente", "Criativos que o cliente entrega (sem produção: no mínimo 5 por mês, no começo do mês)"),
      q("relatorios_semanais", "Como o cliente responde aos relatórios semanais", "text"),
    ],
  },
];

const json = JSON.stringify(sections).replace(/'/g, "''");
const sql = `-- Ficha de onboarding = briefing por seções (docs/08, item 3.3): A sempre; B a E conforme os
-- serviços contratados (show_for = abas do serviço). Seção que não vale para o cliente não aparece,
-- não conta no "o que falta" e não entra no resumo operacional. Gerado por scripts/gen-briefing.mjs.

create or replace function private.client_service_tabs(p_client uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct t), '{}')
    from public.client_services cs
    join public.service_catalog sc on sc.id = cs.service_id
    cross join lateral unnest(sc.tabs) t
   where cs.client_id = p_client and (cs.ends_on is null or cs.ends_on >= private.today_sp());
$$;

create or replace function private.section_applies(p_section jsonb, p_tabs text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_array_length(p_section -> 'show_for'), 0) = 0
      or exists (select 1 from jsonb_array_elements_text(p_section -> 'show_for') x where x = any (p_tabs));
$$;

create or replace function public.onboarding_missing(p_client uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing text[] := '{}';
  v_ob public.client_onboarding;
  v_q jsonb;
  v_sec jsonb;
  v_ans text;
  v_tabs text[] := private.client_service_tabs(p_client);
begin
  if not private.can_client('clients.read', p_client) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  select * into v_ob from public.client_onboarding where client_id = p_client;
  if v_ob.client_id is null then return array['Ficha de onboarding não criada']; end if;
  for v_sec in select * from jsonb_array_elements((select sections from public.onboarding_forms where id = v_ob.form_id)) loop
    continue when not private.section_applies(v_sec, v_tabs);
    for v_q in select * from jsonb_array_elements(v_sec -> 'questions') loop
      if coalesce((v_q ->> 'required')::boolean, false) then
        v_ans := v_ob.answers ->> (v_q ->> 'key');
        if v_ans is null or trim(v_ans) = '' or v_ans = '[]' then
          v_missing := array_append(v_missing, 'Ficha: ' || (v_q ->> 'label'));
        end if;
      end if;
    end loop;
  end loop;
  select v_missing || coalesce(array_agg('Checklist: ' || title order by position), '{}') into v_missing
    from public.onboarding_checklist_items where client_id = p_client and done_at is null;
  if not exists (select 1 from public.client_members where client_id = p_client) then
    v_missing := array_append(v_missing, 'Responsáveis: marque ao menos uma pessoa da equipe');
  end if;
  return v_missing;
end;
$$;
grant execute on function public.onboarding_missing(uuid) to authenticated;

create or replace function public.client_operational_summary(p_client uuid)
returns table (section text, label text, answer text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tabs text[] := private.client_service_tabs(p_client);
begin
  if not private.can_client('clients.read', p_client) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  return query
    select s ->> 'title', q ->> 'label', o.answers ->> (q ->> 'key')
    from public.client_onboarding o
    join public.onboarding_forms f on f.id = o.form_id
    cross join lateral jsonb_array_elements(f.sections) s
    cross join lateral jsonb_array_elements(s -> 'questions') q
    where o.client_id = p_client and q ->> 'visibility' = 'operational'
      and private.section_applies(s, v_tabs)
      and coalesce(trim(o.answers ->> (q ->> 'key')), '') <> '';
end;
$$;
grant execute on function public.client_operational_summary(uuid) to authenticated;

-- Nova versão da ficha (as fichas ainda abertas passam a usá-la; respostas com a mesma chave ficam).
insert into public.onboarding_forms (organization_id, version, sections, is_current)
select o.id, coalesce((select max(version) from public.onboarding_forms f where f.organization_id = o.id), 0) + 1, '${json}'::jsonb, false
  from public.organizations o;
update public.onboarding_forms f set is_current = false
 where f.is_current and exists (select 1 from public.onboarding_forms n where n.organization_id = f.organization_id and n.version > f.version);
update public.onboarding_forms f set is_current = true
 where not f.is_current
   and f.version = (select max(n.version) from public.onboarding_forms n where n.organization_id = f.organization_id)
   and not exists (select 1 from public.onboarding_forms c where c.organization_id = f.organization_id and c.is_current);
update public.client_onboarding o
   set form_id = f.id
  from public.onboarding_forms f, public.clients c
 where o.completed_at is null and c.id = o.client_id and f.organization_id = c.organization_id and f.is_current;
`;
writeFileSync("supabase/migrations/20261114001000_briefing_secoes.sql", sql);
console.log("seções:", sections.length, "perguntas:", sections.reduce((n, s) => n + s.questions.length, 0));
