-- Substituição direta (sem item de estoque).
-- Permite instalar um equipamento digitando os dados, sem debitar estoque.

create or replace function public.substituir_extintor_direto(
  p_extintor_id uuid,
  p_base_id uuid,
  p_actor_id uuid,
  p_actor_nome text,
  p_tipo text,
  p_tamanho text,
  p_capacidade_extintora text,
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
  v_tipo text;
  v_tamanho text;
  v_capacidade text;
begin
  if coalesce(trim(p_num_inmetro), '') = '' then
    raise exception 'Nº do INMETRO é obrigatório para substituição.';
  end if;

  v_tipo := trim(coalesce(p_tipo, ''));
  v_tamanho := trim(coalesce(p_tamanho, ''));
  v_capacidade := trim(coalesce(p_capacidade_extintora, ''));

  if v_tipo = '' or v_tamanho = '' or v_capacidade = '' then
    raise exception 'Tipo, carga e capacidade extintora são obrigatórios.';
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

  if not public.extintor_tipos_are_compatible(v_ext.tipo, v_tipo)
    or not public.extintor_tamanhos_are_compatible(
      v_ext.tamanho,
      v_ext.capacidade_extintora,
      v_tamanho,
      v_capacidade
    ) then
    raise exception 'Configuração informada incompatível com o ponto.';
  end if;

  insert into public.extintor_equipment_history (
    base_id, extintor_id, event_type,
    tipo, tamanho, capacidade_extintora,
    num_inmetro, num_cilindro,
    manutencao_2_nivel, manutencao_3_nivel,
    estoque_id, actor_id, actor_nome, motivo
  ) values (
    p_base_id, p_extintor_id, 'substituicao',
    v_tipo, v_tamanho, v_capacidade,
    trim(p_num_inmetro), nullif(trim(p_num_cilindro), ''),
    p_manutencao_2_nivel, p_manutencao_3_nivel,
    null, p_actor_id, p_actor_nome, 'Substituição direta (sem estoque)'
  );

  update public.extintores
  set
    sem_equipamento = false,
    num_inmetro = trim(p_num_inmetro),
    num_cilindro = nullif(trim(p_num_cilindro), ''),
    tipo = v_tipo,
    tamanho = v_tamanho,
    capacidade_extintora = v_capacidade,
    manutencao_2_nivel = p_manutencao_2_nivel,
    manutencao_3_nivel = p_manutencao_3_nivel,
    retirado_em = null,
    retirado_motivo = null,
    retirado_previsao_retorno = null,
    inspecao_reset_at = now(),
    updated_at = now()
  where id = p_extintor_id;
end;
$$;

grant execute on function public.substituir_extintor_direto(
  uuid, uuid, uuid, text, text, text, text, text, text, date, date
) to service_role;
