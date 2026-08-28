-- ============================================================
-- MIGRAÇÃO — Correções Supabase Security Linter (FireCheck)
-- Execute no SQL Editor do Supabase (idempotente).
--
-- Corrige:
--   0011 function_search_path_mutable (helpers de compatibilidade)
--   0028 anon_security_definer_function_executable (RPCs + helpers)
--   0029 authenticated_security_definer_function_executable (RPCs)
--
-- NÃO cobre (config manual no dashboard):
--   auth_leaked_password_protection → Auth → Password security
--
-- OPCIONAL (comentado abaixo):
--   0025 public_bucket_allows_listing → bucket mapas
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) search_path fixo nas funções utilitárias (lint 0011)
-- ────────────────────────────────────────────────────────────

alter function public.normalize_extintor_tipo(text) set search_path = public;
alter function public.normalize_extintor_tamanho(text) set search_path = public;
alter function public.normalize_capacidade_extintora(text) set search_path = public;
alter function public.extract_carga_nominal(text) set search_path = public;
alter function public.extintor_tipo_match_key(text) set search_path = public;
alter function public.extintor_tipos_are_compatible(text, text) set search_path = public;
alter function public.extintor_tamanhos_are_compatible(text, text, text, text) set search_path = public;

-- ────────────────────────────────────────────────────────────
-- 2) RPCs sensíveis: só service_role (lint 0028 / 0029)
--    O app chama via API Next.js + service_role (getSupabaseAdminClient).
-- ────────────────────────────────────────────────────────────

revoke all on function public.cancelar_retirada_extintor(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancelar_retirada_extintor(uuid, uuid, uuid, text) to service_role;

revoke all on function public.retirar_extintor_para_manutencao(uuid, uuid, uuid, text, text, date) from public, anon, authenticated;
revoke all on function public.retirar_extintor_para_manutencao(uuid, uuid, uuid, text, text, date, uuid) from public, anon, authenticated;
grant execute on function public.retirar_extintor_para_manutencao(uuid, uuid, uuid, text, text, date) to service_role;
grant execute on function public.retirar_extintor_para_manutencao(uuid, uuid, uuid, text, text, date, uuid) to service_role;

revoke all on function public.retirar_extintores_lote(uuid, uuid, text, text, date, uuid[]) from public, anon, authenticated;
grant execute on function public.retirar_extintores_lote(uuid, uuid, text, text, date, uuid[]) to service_role;

revoke all on function public.substituir_extintor_do_estoque(uuid, uuid, uuid, uuid, text, text, text, date, date) from public, anon, authenticated;
grant execute on function public.substituir_extintor_do_estoque(uuid, uuid, uuid, uuid, text, text, text, date, date) to service_role;

revoke all on function public.substituir_extintor_direto(uuid, uuid, uuid, text, text, text, text, text, text, date, date) from public, anon, authenticated;
grant execute on function public.substituir_extintor_direto(uuid, uuid, uuid, text, text, text, text, text, text, date, date) to service_role;

-- ────────────────────────────────────────────────────────────
-- 3) Helpers de RLS: bloquear anon (lint 0028)
--    authenticated mantém EXECUTE — policies RLS dependem disso.
-- ────────────────────────────────────────────────────────────

revoke all on function public.current_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_admin_or_leadership() from public, anon;
revoke all on function public.is_corporativo() from public, anon;
revoke all on function public.is_admin_of_base(uuid) from public, anon;
revoke all on function public.can_access_base(uuid) from public, anon;
revoke all on function public.user_base_ids() from public, anon;

do $$
begin
  revoke all on function public.is_admin_corporativo() from public, anon;
exception
  when undefined_function then null;
end $$;

-- Trigger de perfil — não deve ser invocável via PostgREST
revoke all on function public.prevent_profile_privilege_self_update() from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 4) Storage mapas — reduzir listagem pública (lint 0025)
--    OPCIONAL: descomente apenas se nenhum fluxo usa listObjects().
--    URLs diretas (/storage/v1/object/public/mapas/...) continuam OK.
-- ────────────────────────────────────────────────────────────

-- drop policy if exists mapas_public_read on storage.objects;
-- create policy mapas_public_read
-- on storage.objects for select
-- to public
-- using (
--   bucket_id = 'mapas'
--   and (storage.foldername(name))[1] is not null
-- );

-- ────────────────────────────────────────────────────────────
-- 5) VERIFICAÇÃO — privilégios EXECUTE nas funções sensíveis
-- ────────────────────────────────────────────────────────────

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  array_agg(distinct grantee.rolname order by grantee.rolname) as execute_granted_to
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
join pg_roles grantee on grantee.oid = acl.grantee
where n.nspname = 'public'
  and p.prokind = 'f'
  and acl.privilege_type = 'EXECUTE'
  and p.proname in (
    'cancelar_retirada_extintor',
    'retirar_extintor_para_manutencao',
    'retirar_extintores_lote',
    'substituir_extintor_do_estoque',
    'substituir_extintor_direto',
    'can_access_base',
    'is_admin',
    'current_role',
    'prevent_profile_privilege_self_update'
  )
group by p.proname, p.oid
order by p.proname, args;
