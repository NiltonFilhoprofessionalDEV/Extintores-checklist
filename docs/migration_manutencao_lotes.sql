-- Listas de manutenção em lote + lote_id no histórico.
-- Execute no SQL Editor do Supabase após migration_estoque_substituicao.sql.

create table if not exists public.manutencao_lotes (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases(id) on delete cascade,
  motivo text not null,
  previsao_retorno date,
  creator_id uuid references auth.users(id) on delete set null,
  creator_nome text not null,
  item_count integer not null default 0 check (item_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_manutencao_lotes_base_created
  on public.manutencao_lotes (base_id, created_at desc);

alter table public.extintor_equipment_history
  add column if not exists lote_id uuid references public.manutencao_lotes(id) on delete set null;

create index if not exists idx_ext_equipment_history_lote
  on public.extintor_equipment_history (lote_id);

alter table public.manutencao_lotes enable row level security;

drop policy if exists manutencao_lotes_select on public.manutencao_lotes;
create policy manutencao_lotes_select
on public.manutencao_lotes for select to authenticated
using (public.can_access_base(base_id));

drop policy if exists manutencao_lotes_write_staff on public.manutencao_lotes;
create policy manutencao_lotes_write_staff
on public.manutencao_lotes for all to authenticated
using (
  public.is_admin_or_leadership()
  and public.can_access_base(base_id)
  and not public.is_corporativo()
)
with check (
  public.is_admin_or_leadership()
  and public.can_access_base(base_id)
  and not public.is_corporativo()
);

-- Retirada unitária com lote opcional
create or replace function public.retirar_extintor_para_manutencao(
  p_extintor_id uuid,
  p_base_id uuid,
  p_actor_id uuid,
  p_actor_nome text,
  p_motivo text,
  p_previsao_retorno date default null,
  p_lote_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ext public.extintores%rowtype;
begin
  select * into v_ext
  from public.extintores
  where id = p_extintor_id and base_id = p_base_id
  for update;

  if not found then
    raise exception 'Extintor não encontrado.';
  end if;

  if v_ext.sem_equipamento then
    raise exception 'Este ponto já está sem equipamento.';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Motivo da retirada é obrigatório.';
  end if;

  insert into public.extintor_equipment_history (
    base_id, extintor_id, event_type,
    tipo, tamanho, capacidade_extintora,
    num_inmetro, num_cilindro,
    manutencao_2_nivel, manutencao_3_nivel,
    motivo, previsao_retorno,
    lote_id, actor_id, actor_nome
  ) values (
    p_base_id, p_extintor_id, 'retirada',
    v_ext.tipo, v_ext.tamanho, v_ext.capacidade_extintora,
    v_ext.num_inmetro, v_ext.num_cilindro,
    v_ext.manutencao_2_nivel, v_ext.manutencao_3_nivel,
    trim(p_motivo), p_previsao_retorno,
    p_lote_id, p_actor_id, p_actor_nome
  );

  update public.extintores
  set
    sem_equipamento = true,
    retirado_em = now(),
    retirado_motivo = trim(p_motivo),
    retirado_previsao_retorno = p_previsao_retorno,
    num_inmetro = null,
    num_cilindro = null,
    manutencao_2_nivel = null,
    manutencao_3_nivel = null,
    updated_at = now()
  where id = p_extintor_id;
end;
$$;

-- Retirada em lote (transação atômica)
create or replace function public.retirar_extintores_lote(
  p_base_id uuid,
  p_actor_id uuid,
  p_actor_nome text,
  p_motivo text,
  p_previsao_retorno date default null,
  p_extintor_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote_id uuid;
  v_id uuid;
  v_count integer := 0;
begin
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Motivo da retirada é obrigatório.';
  end if;

  if p_extintor_ids is null or cardinality(p_extintor_ids) = 0 then
    raise exception 'Selecione ao menos um extintor.';
  end if;

  insert into public.manutencao_lotes (
    base_id, motivo, previsao_retorno, creator_id, creator_nome, item_count
  ) values (
    p_base_id, trim(p_motivo), p_previsao_retorno, p_actor_id, p_actor_nome, 0
  )
  returning id into v_lote_id;

  foreach v_id in array p_extintor_ids
  loop
    perform public.retirar_extintor_para_manutencao(
      v_id, p_base_id, p_actor_id, p_actor_nome,
      trim(p_motivo), p_previsao_retorno, v_lote_id
    );
    v_count := v_count + 1;
  end loop;

  update public.manutencao_lotes
  set item_count = v_count
  where id = v_lote_id;

  return v_lote_id;
end;
$$;

grant execute on function public.retirar_extintor_para_manutencao(uuid, uuid, uuid, text, text, date, uuid) to service_role;
grant execute on function public.retirar_extintores_lote(uuid, uuid, text, text, date, uuid[]) to service_role;
