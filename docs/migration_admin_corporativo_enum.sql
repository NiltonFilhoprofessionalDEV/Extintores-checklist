-- Passo 1/2 — role Administrador Corporativo
-- Execute ESTE arquivo sozinho no SQL Editor do Supabase e aguarde o sucesso
-- antes de rodar docs/migration_admin_corporativo.sql.
-- Motivo: o Postgres exige COMMIT do novo valor de enum antes de usá-lo.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
      and e.enumlabel = 'admin_corporativo'
  ) then
    alter type public.user_role add value 'admin_corporativo';
  end if;
end $$;
