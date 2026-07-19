-- Passo 1/2 da migration multi-base.
-- Adiciona o role "corporativo" ao enum user_role.
-- Execute ESTE arquivo sozinho no SQL Editor do Supabase e aguarde o sucesso
-- antes de rodar docs/migration_multi_base.sql.
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
      and e.enumlabel = 'corporativo'
  ) then
    alter type public.user_role add value 'corporativo';
  end if;
end $$;
