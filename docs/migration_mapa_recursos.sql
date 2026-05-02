-- Recursos de mapa: hidrantes, inspeções de hidrantes, marcadores de emergência (luz / placa)
-- Execute no SQL Editor do Supabase após o schema base.
--
-- Se a importação de hidrantes falhar com: "Could not find the 'quantidade_chaves_storz' column …"
-- rode APENAS o bloco "Colunas da planilha RF01 hidrantes" no final deste arquivo (ALTER TABLE … ADD COLUMN IF NOT EXISTS).

create table if not exists public.hidrantes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  pavimento text,
  local_detalhado text not null default '',
  quantidade_mangueiras integer,
  teste_hidrostatico_m1 date,
  teste_hidrostatico_m2 date,
  teste_hidrostatico_m3 date,
  teste_hidrostatico_m4 date,
  quantidade_chaves_storz integer,
  quantidade_esguichos integer,
  coord_x double precision,
  coord_y double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hidrantes_codigo_unique on public.hidrantes (codigo);

create index if not exists idx_hidrantes_pavimento on public.hidrantes (pavimento);
create index if not exists idx_hidrantes_coords on public.hidrantes (coord_x, coord_y);

create table if not exists public.checklists_hidrantes (
  id uuid primary key default gen_random_uuid(),
  hidrante_id uuid not null references public.hidrantes(id) on delete cascade,
  data_conferencia timestamptz not null default now(),
  conferente text not null,
  acesso_desobstruido text,
  identificacao_sinalizacao text,
  mangueira_esguicho text,
  valvulas_registros text,
  pressao_abastecimento text,
  gabinete_caixa text,
  hidrante_integridade text,
  documentacao_acesso text,
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_checklists_hidrantes_hidrante on public.checklists_hidrantes (hidrante_id);
create index if not exists idx_checklists_hidrantes_data on public.checklists_hidrantes (data_conferencia desc);

create table if not exists public.marcadores_emergencia (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('luz_emergencia', 'placa_saida_emergencia')),
  pavimento text,
  coord_x double precision not null,
  coord_y double precision not null,
  quantidade int not null default 1 check (quantidade >= 1 and quantidade <= 999),
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_marcadores_emergencia_kind on public.marcadores_emergencia (kind);
create index if not exists idx_marcadores_emergencia_pav on public.marcadores_emergencia (pavimento);

drop trigger if exists trg_hidrantes_set_updated_at on public.hidrantes;
create trigger trg_hidrantes_set_updated_at
before update on public.hidrantes
for each row
execute function public.set_updated_at();

alter table public.hidrantes enable row level security;
alter table public.checklists_hidrantes enable row level security;
alter table public.marcadores_emergencia enable row level security;

drop policy if exists hidrantes_select_authenticated on public.hidrantes;
create policy hidrantes_select_authenticated
on public.hidrantes for select to authenticated using (true);

drop policy if exists hidrantes_insert_admin on public.hidrantes;
create policy hidrantes_insert_admin
on public.hidrantes for insert to authenticated
with check (public.is_admin());

drop policy if exists hidrantes_update_admin on public.hidrantes;
create policy hidrantes_update_admin
on public.hidrantes for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists checklists_hidrantes_select_authenticated on public.checklists_hidrantes;
create policy checklists_hidrantes_select_authenticated
on public.checklists_hidrantes for select to authenticated using (true);

drop policy if exists checklists_hidrantes_insert_authenticated on public.checklists_hidrantes;
create policy checklists_hidrantes_insert_authenticated
on public.checklists_hidrantes for insert to authenticated
with check (auth.uid() is not null);

drop policy if exists marcadores_emergencia_select_authenticated on public.marcadores_emergencia;
create policy marcadores_emergencia_select_authenticated
on public.marcadores_emergencia for select to authenticated using (true);

drop policy if exists marcadores_emergencia_insert_admin on public.marcadores_emergencia;
create policy marcadores_emergencia_insert_admin
on public.marcadores_emergencia for insert to authenticated
with check (public.is_admin());

drop policy if exists marcadores_emergencia_update_authenticated on public.marcadores_emergencia;
create policy marcadores_emergencia_update_authenticated
on public.marcadores_emergencia for update to authenticated
using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists marcadores_emergencia_delete_admin on public.marcadores_emergencia;
create policy marcadores_emergencia_delete_admin
on public.marcadores_emergencia for delete to authenticated
using (public.is_admin());

-- Colunas da planilha RF01 hidrantes (idempotente se a tabela já existia sem estes campos)
alter table public.hidrantes add column if not exists quantidade_mangueiras integer;
alter table public.hidrantes add column if not exists teste_hidrostatico_m1 date;
alter table public.hidrantes add column if not exists teste_hidrostatico_m2 date;
alter table public.hidrantes add column if not exists teste_hidrostatico_m3 date;
alter table public.hidrantes add column if not exists teste_hidrostatico_m4 date;
alter table public.hidrantes add column if not exists quantidade_chaves_storz integer;
alter table public.hidrantes add column if not exists quantidade_esguichos integer;

-- Inspeção luz/placa no mapa (conforme / não conforme + texto)
alter table public.marcadores_emergencia add column if not exists inspecao_resultado text;
alter table public.marcadores_emergencia add column if not exists nao_conformidade_descricao text;
alter table public.marcadores_emergencia drop constraint if exists marcadores_emergencia_inspecao_resultado_chk;
alter table public.marcadores_emergencia add constraint marcadores_emergencia_inspecao_resultado_chk
  check (inspecao_resultado is null or inspecao_resultado in ('conforme', 'nao_conforme'));

-- Histórico de inspeções (luz / placa) para auditoria — um registro por inspeção (não substitui anteriores)
create table if not exists public.inspecoes_marcadores_emergencia (
  id uuid primary key default gen_random_uuid(),
  marcador_emergencia_id uuid not null references public.marcadores_emergencia(id) on delete cascade,
  marcador_kind text not null check (marcador_kind in ('luz_emergencia', 'placa_saida_emergencia')),
  pavimento text,
  data_inspecao timestamptz not null default now(),
  conferente text not null,
  inspecao_resultado text not null check (inspecao_resultado in ('conforme', 'nao_conforme')),
  nao_conformidade_descricao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inspecoes_marc_emerg_marcador_data
  on public.inspecoes_marcadores_emergencia (marcador_emergencia_id, data_inspecao desc);
create index if not exists idx_inspecoes_marc_emerg_kind_data
  on public.inspecoes_marcadores_emergencia (marcador_kind, data_inspecao desc);

alter table public.inspecoes_marcadores_emergencia enable row level security;

drop policy if exists inspecoes_marcadores_emergencia_select_authenticated on public.inspecoes_marcadores_emergencia;
create policy inspecoes_marcadores_emergencia_select_authenticated
on public.inspecoes_marcadores_emergencia for select to authenticated using (true);

drop policy if exists inspecoes_marcadores_emergencia_insert_authenticated on public.inspecoes_marcadores_emergencia;
create policy inspecoes_marcadores_emergencia_insert_authenticated
on public.inspecoes_marcadores_emergencia for insert to authenticated
with check (auth.uid() is not null);
