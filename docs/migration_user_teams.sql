-- Equipes organizacionais para usuários do app.
-- Execute depois das migrações de roles/RLS.

alter table public.profiles
  add column if not exists team text;

alter table public.profiles
  drop constraint if exists profiles_team_allowed;

alter table public.profiles
  add constraint profiles_team_allowed
  check (team is null or team in ('ALFA', 'BRAVO', 'CHARLIE', 'DELTA'))
  not valid;

alter table public.profiles
  drop constraint if exists profiles_team_required_for_non_admin;

alter table public.profiles
  add constraint profiles_team_required_for_non_admin
  check (role = 'admin' or team is not null)
  not valid;

create index if not exists idx_profiles_team on public.profiles (team);

-- Classifique usuários existentes antes de validar as constraints acima.
-- Exemplos:
-- update public.profiles set team = 'ALFA' where role in ('leadership', 'user') and team is null;
-- alter table public.profiles validate constraint profiles_team_allowed;
-- alter table public.profiles validate constraint profiles_team_required_for_non_admin;

create or replace function public.prevent_profile_privilege_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
    and not public.is_admin()
    and (
      new.role is distinct from old.role
      or new.active is distinct from old.active
      or new.team is distinct from old.team
    )
  then
    raise exception 'Perfil, status e equipe não podem ser alterados pelo próprio usuário.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_privilege_self_update on public.profiles;
create trigger trg_profiles_prevent_privilege_self_update
before update on public.profiles
for each row
execute function public.prevent_profile_privilege_self_update();
