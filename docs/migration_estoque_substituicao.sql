-- Estoque de extintores + retirada/manutenção + substituição atômica.
-- Execute no SQL Editor do Supabase.

-- ---------------------------------------------------------------------------
-- 1) Estoque por configuração (sem código E-XXX)
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_extintores (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases(id) on delete cascade,
  tipo text not null,
  tamanho text not null,
  capacidade_extintora text not null,
  quantidade integer not null default 0 check (quantidade >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estoque_extintores_config_unique
    unique (base_id, tipo, tamanho, capacidade_extintora)
);

create index if not exists idx_estoque_extintores_base
  on public.estoque_extintores (base_id);

drop trigger if exists trg_estoque_extintores_set_updated_at on public.estoque_extintores;
create trigger trg_estoque_extintores_set_updated_at
before update on public.estoque_extintores
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Estado de ponto sem equipamento + reset de inspeção após substituição
-- ---------------------------------------------------------------------------
alter table public.extintores
  add column if not exists sem_equipamento boolean not null default false,
  add column if not exists retirado_em timestamptz,
  add column if not exists retirado_motivo text,
  add column if not exists retirado_previsao_retorno date,
  add column if not exists inspecao_reset_at timestamptz;

alter table public.extintores
  alter column num_inmetro drop not null;

create index if not exists idx_extintores_sem_equipamento
  on public.extintores (base_id, sem_equipamento)
  where sem_equipamento = true;

-- ---------------------------------------------------------------------------
-- 3) Histórico de equipamento físico (retirada / substituição)
-- ---------------------------------------------------------------------------
create table if not exists public.extintor_equipment_history (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases(id) on delete cascade,
  extintor_id uuid not null references public.extintores(id) on delete cascade,
  event_type text not null check (event_type in ('retirada', 'substituicao')),
  tipo text not null,
  tamanho text not null,
  capacidade_extintora text not null,
  num_inmetro text,
  num_cilindro text,
  manutencao_2_nivel date,
  manutencao_3_nivel date,
  motivo text,
  previsao_retorno date,
  estoque_id uuid references public.estoque_extintores(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_nome text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ext_equipment_history_extintor
  on public.extintor_equipment_history (extintor_id, created_at desc);

create index if not exists idx_ext_equipment_history_base
  on public.extintor_equipment_history (base_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------
alter table public.estoque_extintores enable row level security;
alter table public.extintor_equipment_history enable row level security;

drop policy if exists estoque_extintores_select on public.estoque_extintores;
create policy estoque_extintores_select
on public.estoque_extintores for select to authenticated
using (public.can_access_base(base_id));

drop policy if exists estoque_extintores_write_staff on public.estoque_extintores;
create policy estoque_extintores_write_staff
on public.estoque_extintores for all to authenticated
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

drop policy if exists ext_equipment_history_select on public.extintor_equipment_history;
create policy ext_equipment_history_select
on public.extintor_equipment_history for select to authenticated
using (public.can_access_base(base_id));

-- Inserts via RPC / service role; sem insert direto autenticado.
drop policy if exists ext_equipment_history_insert_none on public.extintor_equipment_history;
create policy ext_equipment_history_insert_none
on public.extintor_equipment_history for insert to authenticated
with check (false);

-- ---------------------------------------------------------------------------
-- 5) Funções atômicas (security definer)
-- ---------------------------------------------------------------------------
create or replace function public.retirar_extintor_para_manutencao(
  p_extintor_id uuid,
  p_base_id uuid,
  p_actor_id uuid,
  p_actor_nome text,
  p_motivo text,
  p_previsao_retorno date default null
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
    actor_id, actor_nome
  ) values (
    p_base_id, p_extintor_id, 'retirada',
    v_ext.tipo, v_ext.tamanho, v_ext.capacidade_extintora,
    v_ext.num_inmetro, v_ext.num_cilindro,
    v_ext.manutencao_2_nivel, v_ext.manutencao_3_nivel,
    trim(p_motivo), p_previsao_retorno,
    p_actor_id, p_actor_nome
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

  if v_ext.tipo is distinct from v_est.tipo
    or v_ext.tamanho is distinct from v_est.tamanho
    or v_ext.capacidade_extintora is distinct from v_est.capacidade_extintora then
    raise exception 'Configuração de estoque incompatível com o ponto.';
  end if;

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
    p_manutencao_2_nivel, p_manutencao_3_nivel,
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
    manutencao_2_nivel = p_manutencao_2_nivel,
    manutencao_3_nivel = p_manutencao_3_nivel,
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

grant execute on function public.retirar_extintor_para_manutencao(uuid, uuid, uuid, text, text, date) to service_role;
grant execute on function public.substituir_extintor_do_estoque(uuid, uuid, uuid, uuid, text, text, text, date, date) to service_role;
