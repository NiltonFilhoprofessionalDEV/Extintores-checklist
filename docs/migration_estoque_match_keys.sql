-- Matching flexível tipo + carga nominal (sinônimos PQS, campos trocados no inventário).
-- Execute após migration_estoque_compat_normalize.sql.

create or replace function public.extract_carga_nominal(t text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
  m text[];
  num text;
  unit text;
begin
  if coalesce(trim(t), '') = '' then
    return null;
  end if;

  v := upper(
    regexp_replace(
      translate(trim(t), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ₂', 'AAAAAEEEEIIIIOOOOOUUUUCN2'),
      '\s+',
      ' ',
      'g'
    )
  );

  -- Ignora classe extintora (2-A 20-B:C, 2a20bc)
  if v ~ '[AB]\s*[:.\-]' or (v ~ 'BC' and v !~ '^\d+\s*(KG|L)\b') then
    if v !~ '^\d+(?:\.\d+)?\s*(KG|G|L|LT)\b' then
      return null;
    end if;
  end if;

  m := regexp_match(replace(v, ',', '.'), '^(\d+(?:\.\d+)?)\s*(KG|G|KILO(?:GRAMA)?S?|L|LT|LITROS?)?$');
  if m is not null then
    num := regexp_replace(m[1], '\.0+$', '');
    unit := coalesce(m[2], case when v ~ '\mL(ITRO)?S?\M' then 'L' else 'KG' end);
    if unit in ('L', 'LT', 'LITROS', 'LITRO') then
      return num || 'L';
    end if;
    return num || 'KG';
  end if;

  m := regexp_match(replace(v, ',', '.'), '(\d+(?:\.\d+)?)\s*(KG|G|L|LT|LITROS?)\m');
  if m is not null then
    num := regexp_replace(m[1], '\.0+$', '');
    if m[2] in ('L', 'LT', 'LITROS', 'LITRO') then
      return num || 'L';
    end if;
    return num || 'KG';
  end if;

  return null;
end;
$$;

create or replace function public.extintor_tipo_match_key(t text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := regexp_replace(
    translate(
      upper(trim(translate(coalesce(t, ''), '₂', '2'))),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'AAAAAEEEEIIIIOOOOOUUUUCN'
    ),
    '\s+',
    '',
    'g'
  );

  if v = '' then return ''; end if;
  if v like '%CO2%' or v = 'CO' then return 'CO2'; end if;
  if v like '%AGUA%' then return 'AGUA'; end if;
  if v like '%ESPUMA%' then return 'ESPUMA'; end if;

  if v like '%PQS%' or v like '%POQUIMICO%' or v like '%QUIMICO%' or v like '%POLVO%' or v like '%SECO%' then
    if v like '%ABC%' then return 'PQSABC'; end if;
    if v like '%BC%' then return 'PQSBC'; end if;
    return 'PQS';
  end if;

  return v;
end;
$$;

create or replace function public.extintor_tipos_are_compatible(t1 text, t2 text)
returns boolean
language plpgsql
immutable
as $$
declare
  a text := public.extintor_tipo_match_key(t1);
  b text := public.extintor_tipo_match_key(t2);
begin
  if a = '' or b = '' then return false; end if;
  if a = b then return true; end if;
  if a in ('PQS', 'PQSABC', 'PQSBC') and b in ('PQS', 'PQSABC', 'PQSBC') then
    if a = 'PQS' or b = 'PQS' then return true; end if;
    return a = b;
  end if;
  return false;
end;
$$;

create or replace function public.extintor_tamanhos_are_compatible(
  t1 text,
  c1 text,
  t2 text,
  c2 text default ''
)
returns boolean
language plpgsql
immutable
as $$
declare
  k1 text[];
  k2 text[];
  kt text;
begin
  k1 := array[]::text[];
  k2 := array[]::text[];

  kt := public.extract_carga_nominal(t1);
  if kt is not null then k1 := k1 || kt; end if;
  kt := public.extract_carga_nominal(c1);
  if kt is not null then k1 := k1 || kt; end if;
  kt := public.extract_carga_nominal(t2);
  if kt is not null then k2 := k2 || kt; end if;
  kt := public.extract_carga_nominal(c2);
  if kt is not null then k2 := k2 || kt; end if;

  if coalesce(array_length(k1, 1), 0) = 0 or coalesce(array_length(k2, 1), 0) = 0 then
    return false;
  end if;

  return k1 && k2;
end;
$$;

create or replace function public.substituir_extintor_do_estoque(
  p_extintor_id uuid,
  p_estoque_id uuid,
  p_base_id uuid,
  p_actor_id uuid,
  p_actor_nome text,
  p_num_inmetro text,
  p_num_cilindro text default null,
  p_manutencao_2_nivel date default null,
  p_manutencao_3_nivel date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ext public.extintores%rowtype;
  v_est public.estoque_extintores%rowtype;
  v_manut2 date;
  v_manut3 date;
begin
  if coalesce(trim(p_num_inmetro), '') = '' then
    raise exception 'Nº do INMETRO é obrigatório para substituição.';
  end if;

  select * into v_ext
  from public.extintores
  where id = p_extintor_id and base_id = p_base_id
  for update;

  if not found then
    raise exception 'Extintor não encontrado.';
  end if;

  if not v_ext.sem_equipamento then
    raise exception 'Este ponto não está sem equipamento.';
  end if;

  select * into v_est
  from public.estoque_extintores
  where id = p_estoque_id and base_id = p_base_id
  for update;

  if not found then
    raise exception 'Item de estoque não encontrado.';
  end if;

  if v_est.quantidade < 1 then
    raise exception 'Estoque insuficiente para esta configuração.';
  end if;

  if not public.extintor_tipos_are_compatible(v_ext.tipo, v_est.tipo)
    or not public.extintor_tamanhos_are_compatible(
      v_ext.tamanho,
      v_ext.capacidade_extintora,
      v_est.tamanho,
      v_est.capacidade_extintora
    ) then
    raise exception 'Configuração de estoque incompatível com o ponto.';
  end if;

  v_manut2 := coalesce(p_manutencao_2_nivel, v_est.manutencao_2_nivel);
  v_manut3 := coalesce(p_manutencao_3_nivel, v_est.manutencao_3_nivel);

  insert into public.extintor_equipment_history (
    base_id, extintor_id, event_type,
    tipo, tamanho, capacidade_extintora,
    num_inmetro, num_cilindro,
    manutencao_2_nivel, manutencao_3_nivel,
    estoque_id, actor_id, actor_nome
  ) values (
    p_base_id, p_extintor_id, 'substituicao',
    v_est.tipo, v_est.tamanho, v_est.capacidade_extintora,
    trim(p_num_inmetro), nullif(trim(p_num_cilindro), ''),
    v_manut2, v_manut3,
    p_estoque_id, p_actor_id, p_actor_nome
  );

  update public.extintores
  set
    sem_equipamento = false,
    num_inmetro = trim(p_num_inmetro),
    num_cilindro = nullif(trim(p_num_cilindro), ''),
    tipo = v_est.tipo,
    tamanho = v_est.tamanho,
    capacidade_extintora = v_est.capacidade_extintora,
    manutencao_2_nivel = v_manut2,
    manutencao_3_nivel = v_manut3,
    retirado_em = null,
    retirado_motivo = null,
    retirado_previsao_retorno = null,
    inspecao_reset_at = now(),
    updated_at = now()
  where id = p_extintor_id;

  update public.estoque_extintores
  set quantidade = quantidade - 1, updated_at = now()
  where id = p_estoque_id;
end;
$$;

grant execute on function public.substituir_extintor_do_estoque(uuid, uuid, uuid, uuid, text, text, text, date, date) to service_role;
