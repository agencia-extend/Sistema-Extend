-- Ficha de onboarding = briefing por seções (docs/08, item 3.3): A sempre; B a E conforme os
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
select o.id, coalesce((select max(version) from public.onboarding_forms f where f.organization_id = o.id), 0) + 1, '[{"key":"geral","title":"A. Geral","questions":[{"key":"servicos_extend","label":"Serviços que vai executar com a Extend","type":"multiselect","required":false,"visibility":"operational","options":["Tráfego Google Ads","Tráfego Meta Ads","Produção de vídeos","Produção de designs","Gerenciamento de redes","Desenvolvimento de site/LP"]},{"key":"o_que_faz","label":"O que a empresa faz hoje (serviços e produtos)","type":"textarea","required":true,"visibility":"operational"},{"key":"tempo_atuacao","label":"Há quanto tempo atua","type":"text","required":false,"visibility":"operational"},{"key":"processo_vendas","label":"Como é o processo de vendas hoje","type":"textarea","required":true,"visibility":"operational"},{"key":"oferta","label":"Principais serviços ou produtos a divulgar","type":"textarea","required":true,"visibility":"operational"},{"key":"publico_genero","label":"Gênero predominante do público","type":"select","required":false,"visibility":"operational","options":["Mulheres","Homens","Equilibrado"]},{"key":"publico_idade","label":"Faixa etária do público","type":"multiselect","required":false,"visibility":"operational","options":["18 a 24","25 a 34","35 a 44","45 a 54","55 ou mais"]},{"key":"publico_poder","label":"Poder aquisitivo do público","type":"select","required":false,"visibility":"operational","options":["Baixo","Médio","Alto","Muito alto"]},{"key":"publico_tipo","label":"B2C ou B2B","type":"select","required":false,"visibility":"operational","options":["B2C (pessoa física)","B2B (empresas)","Os dois"]},{"key":"publico_desejado","label":"Público desejado, se for diferente do atual","type":"textarea","required":false,"visibility":"operational"},{"key":"dores","label":"Dores, necessidades e desejos que o produto resolve","type":"textarea","required":true,"visibility":"operational"},{"key":"objecoes","label":"O que impede a compra","type":"textarea","required":false,"visibility":"operational"},{"key":"percepcao","label":"Como a marca quer ser percebida","type":"multiselect","required":false,"visibility":"operational","options":["Profissional/técnica","Sofisticada/alto padrão","Próxima/acessível","Educativa","Autoridade","Leve/divertida"]},{"key":"tom","label":"Tom de comunicação","type":"textarea","required":false,"visibility":"operational"},{"key":"nao_transmitir","label":"O que a marca NÃO deve transmitir","type":"textarea","required":false,"visibility":"operational"}]},{"key":"trafego","title":"B. Tráfego pago","show_for":["anuncios"],"questions":[{"key":"ja_anunciou","label":"Já anunciou antes?","type":"select","required":false,"visibility":"operational","options":["Nunca","Meta Ads","Google Ads","Os dois"]},{"key":"acesso_contas","label":"Acessos às contas (BM, conta de anúncios, Google Ads)","type":"textarea","required":false,"visibility":"full"},{"key":"acesso_site","label":"Tem programador ou acesso ao painel do site (para tags e pixel)?","type":"select","required":false,"visibility":"operational","options":["Sim, tem programador","Sim, acesso ao painel","Não"]},{"key":"objetivo_trafego","label":"Objetivo principal","type":"select","required":true,"visibility":"operational","options":["Vendas no site","Mensagens no WhatsApp","Cadastros (leads)","Ligações","Visitas à loja","Outro"]},{"key":"investimento_meta","label":"Investimento mensal em Meta Ads","type":"text","required":false,"visibility":"full"},{"key":"investimento_google","label":"Investimento mensal em Google Ads","type":"text","required":false,"visibility":"full"},{"key":"ticket","label":"Ticket médio","type":"text","required":false,"visibility":"full"},{"key":"meta_faturamento","label":"Meta de faturamento ou de vendas","type":"text","required":false,"visibility":"full"},{"key":"regiao","label":"Regiões de atuação","type":"textarea","required":false,"visibility":"operational"},{"key":"horario_atendimento","label":"Horário de atendimento (anúncio 24h ou só no horário comercial)","type":"text","required":false,"visibility":"operational"},{"key":"concorrentes","label":"3 principais concorrentes","type":"textarea","required":false,"visibility":"operational"},{"key":"carro_chefe","label":"Produto ou serviço carro-chefe","type":"text","required":false,"visibility":"operational"},{"key":"formas_pagamento","label":"Formas de pagamento aceitas","type":"text","required":false,"visibility":"operational"},{"key":"promocoes","label":"Promoções e datas comemorativas","type":"textarea","required":false,"visibility":"operational"},{"key":"palavras_chave","label":"Palavras-chave (Google)","type":"textarea","required":false,"visibility":"operational"},{"key":"palavras_negativas","label":"Palavras negativas (Google)","type":"textarea","required":false,"visibility":"operational"},{"key":"whatsapp_anuncios","label":"WhatsApp de atendimento para os anúncios","type":"text","required":false,"visibility":"operational"},{"key":"pagamento_anuncios","label":"Como os anúncios serão pagos","type":"select","required":false,"visibility":"full","options":["Cartão de crédito","Boleto/PIX pré-pago","Outro"]},{"key":"restricoes_meta","label":"Restrições da Meta (área sensível: saúde, imóveis, crédito…)","type":"textarea","required":false,"visibility":"operational"}]},{"key":"videos","title":"C. Produção de vídeos","show_for":["videos","gravacao"],"questions":[{"key":"videos_antes","label":"Já produziu vídeos? Como foi?","type":"textarea","required":false,"visibility":"operational"},{"key":"video_estilo","label":"Estilo e linguagem com que se identifica","type":"textarea","required":false,"visibility":"operational"},{"key":"video_referencias","label":"Perfis de referência","type":"textarea","required":false,"visibility":"operational"},{"key":"video_nao","label":"O que NÃO quer fazer ou mostrar","type":"textarea","required":false,"visibility":"operational"},{"key":"temas_refazer","label":"Temas que quer refazer","type":"textarea","required":false,"visibility":"operational"},{"key":"temas_desejados","label":"Temas que já queria produzir","type":"textarea","required":false,"visibility":"operational"},{"key":"gravacao_estilo","label":"Estilo de gravação","type":"select","required":false,"visibility":"operational","options":["Dinâmica","Estática","Confio na Extend"]},{"key":"edicao_estilo","label":"Estilo de edição","type":"select","required":false,"visibility":"operational","options":["Clean","Impactante","Divertida","Confio na Extend"]},{"key":"legenda_videos","label":"Quer legenda em todos os vídeos?","type":"boolean","required":false,"visibility":"operational"},{"key":"roteiro_estilo","label":"Estilo de roteiro","type":"select","required":false,"visibility":"operational","options":["Frases curtas","Tópicos de direcionamento","Roteiro completo","Confio na Extend"]}]},{"key":"design","title":"D. Design","show_for":["design","conteudo","gerenciamento"],"questions":[{"key":"tem_identidade","label":"Tem identidade visual?","type":"boolean","required":false,"visibility":"operational"},{"key":"manual_marca","label":"Manual de marca (link)","type":"url","required":false,"visibility":"operational"},{"key":"cores","label":"Códigos de cor","type":"text","required":false,"visibility":"operational"},{"key":"fontes","label":"Fontes","type":"text","required":false,"visibility":"operational"},{"key":"logo_alta","label":"Logo em alta (link; envie também em Materiais)","type":"url","required":false,"visibility":"operational"},{"key":"fotos_profissionais","label":"Fotos profissionais (link)","type":"url","required":false,"visibility":"operational"},{"key":"elementos_obrigatorios","label":"Elementos obrigatórios nos posts","type":"textarea","required":false,"visibility":"operational"},{"key":"elementos_proibidos","label":"Elementos proibidos","type":"textarea","required":false,"visibility":"operational"},{"key":"design_estilo","label":"Estilo de design","type":"select","required":false,"visibility":"operational","options":["Minimalista","Chamativo","Elegante","Divertido","Confio na Extend"]},{"key":"design_referencias","label":"3 referências","type":"textarea","required":false,"visibility":"operational"}]},{"key":"site","title":"E. Site / Landing page","show_for":["site"],"questions":[{"key":"tem_site","label":"Já tem site?","type":"boolean","required":false,"visibility":"operational"},{"key":"site_backup","label":"Tem backup do site?","type":"boolean","required":false,"visibility":"operational"},{"key":"site_objetivo","label":"Objetivo do site","type":"select","required":false,"visibility":"operational","options":["Institucional","Geração de leads","Vendas (loja)","Página de produto ou evento"]},{"key":"site_regiao","label":"Cidade ou região de foco","type":"text","required":false,"visibility":"operational"},{"key":"site_identidade","label":"Identidade visual, logo, cores e fontes do site","type":"textarea","required":false,"visibility":"operational"},{"key":"site_paginas","label":"Páginas e seções necessárias","type":"textarea","required":false,"visibility":"operational"},{"key":"site_funcionalidades","label":"Funcionalidades (botão de WhatsApp, formulário…)","type":"textarea","required":false,"visibility":"operational"},{"key":"site_integracoes","label":"Integrações (WhatsApp, Instagram…)","type":"textarea","required":false,"visibility":"operational"},{"key":"site_referencias","label":"3 sites de referência e por quê","type":"textarea","required":false,"visibility":"operational"},{"key":"site_nao","label":"O que NÃO quer no site","type":"textarea","required":false,"visibility":"operational"}]},{"key":"obrigacoes","title":"Obrigações do cliente","questions":[{"key":"porta_voz","label":"Porta-voz do projeto (quem decide e aprova)","type":"text","required":false,"visibility":"operational"},{"key":"prazo_feedback_leads","label":"Prazo para dar retorno sobre os leads","type":"text","required":false,"visibility":"operational"},{"key":"prazo_resposta","label":"Prazo para responder a equipe","type":"text","required":false,"visibility":"operational"},{"key":"prazo_aprovacao","label":"Prazo para aprovar conteúdos e campanhas","type":"text","required":false,"visibility":"operational"},{"key":"criativos_cliente","label":"Criativos que o cliente entrega (sem produção: no mínimo 5 por mês, no começo do mês)","type":"textarea","required":false,"visibility":"operational"},{"key":"relatorios_semanais","label":"Como o cliente responde aos relatórios semanais","type":"text","required":false,"visibility":"operational"}]}]'::jsonb, false
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
