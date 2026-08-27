-- Campos de manutenção no estoque (template aplicado na substituição).
-- Execute após migration_estoque_substituicao.sql.

alter table public.estoque_extintores
  add column if not exists manutencao_2_nivel date,
  add column if not exists manutencao_3_nivel date;

-- Atualiza substituição: datas do estoque quando não informadas na substituição
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

  if public.normalize_extintor_tipo(v_ext.tipo) is distinct from public.normalize_extintor_tipo(v_est.tipo)
    or public.normalize_extintor_tamanho(v_ext.tamanho) is distinct from public.normalize_extintor_tamanho(v_est.tamanho)
    or public.normalize_capacidade_extintora(v_ext.capacidade_extintora) is distinct from public.normalize_capacidade_extintora(v_est.capacidade_extintora) then
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
