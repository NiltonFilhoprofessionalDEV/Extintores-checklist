-- Cancelamento de retirada: restaura equipamento original no ponto.
-- Execute no SQL Editor do Supabase após migration_estoque_substituicao.sql.

alter table public.extintor_equipment_history
  drop constraint if exists extintor_equipment_history_event_type_check;

alter table public.extintor_equipment_history
  add constraint extintor_equipment_history_event_type_check
  check (event_type in ('retirada', 'substituicao', 'restauracao'));

create or replace function public.cancelar_retirada_extintor(
  p_extintor_id uuid,
  p_base_id uuid,
  p_actor_id uuid,
  p_actor_nome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ext public.extintores%rowtype;
  v_hist public.extintor_equipment_history%rowtype;
begin
  select * into v_ext
  from public.extintores
  where id = p_extintor_id and base_id = p_base_id
  for update;

  if not found then
    raise exception 'Extintor não encontrado.';
  end if;

  if not v_ext.sem_equipamento then
    raise exception 'Este ponto já possui equipamento instalado.';
  end if;

  select * into v_hist
  from public.extintor_equipment_history
  where extintor_id = p_extintor_id
    and base_id = p_base_id
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Nenhum histórico de equipamento encontrado para este ponto.';
  end if;

  if v_hist.event_type = 'substituicao' then
    raise exception 'Não é possível cancelar: o ponto já recebeu substituição do estoque.';
  end if;

  if v_hist.event_type = 'restauracao' then
    raise exception 'A retirada deste ponto já foi cancelada.';
  end if;

  if v_hist.event_type <> 'retirada' then
    raise exception 'Não há retirada pendente para cancelar neste ponto.';
  end if;

  if coalesce(trim(v_hist.num_inmetro), '') = '' then
    raise exception 'Histórico da retirada não possui Nº do INMETRO para restauração.';
  end if;

  insert into public.extintor_equipment_history (
    base_id, extintor_id, event_type,
    tipo, tamanho, capacidade_extintora,
    num_inmetro, num_cilindro,
    manutencao_2_nivel, manutencao_3_nivel,
    motivo, actor_id, actor_nome
  ) values (
    p_base_id, p_extintor_id, 'restauracao',
    v_hist.tipo, v_hist.tamanho, v_hist.capacidade_extintora,
    v_hist.num_inmetro, v_hist.num_cilindro,
    v_hist.manutencao_2_nivel, v_hist.manutencao_3_nivel,
    'Cancelamento da retirada para manutenção',
    p_actor_id, p_actor_nome
  );

  update public.extintores
  set
    sem_equipamento = false,
    num_inmetro = v_hist.num_inmetro,
    num_cilindro = v_hist.num_cilindro,
    tipo = v_hist.tipo,
    tamanho = v_hist.tamanho,
    capacidade_extintora = v_hist.capacidade_extintora,
    manutencao_2_nivel = v_hist.manutencao_2_nivel,
    manutencao_3_nivel = v_hist.manutencao_3_nivel,
    retirado_em = null,
    retirado_motivo = null,
    retirado_previsao_retorno = null,
    updated_at = now()
  where id = p_extintor_id;
end;
$$;

grant execute on function public.cancelar_retirada_extintor(uuid, uuid, uuid, text) to service_role;
