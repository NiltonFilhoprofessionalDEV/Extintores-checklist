-- ============================================================
-- MIGRAÇÃO DE SEGURANÇA — Supabase Security Linter Warnings
-- Execute no SQL Editor do Supabase (Settings → SQL Editor)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CORRIGIR search_path das funções (function_search_path_mutable)
--    Funções sem search_path fixo podem ser exploradas via
--    injeção de schema por usuários mal-intencionados.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role() = 'admin', false);
$$;


-- ────────────────────────────────────────────────────────────
-- 2. REMOVER políticas RLS permissivas demais (rls_policy_always_true)
--    Políticas anon e WITH CHECK (true) permitem que qualquer
--    pessoa (inclusive não-autenticada) insira/altere dados.
-- ────────────────────────────────────────────────────────────

-- 2a. Remover políticas anon indevidas em extintores
DROP POLICY IF EXISTS extintores_insert_anon ON public.extintores;
DROP POLICY IF EXISTS extintores_update_anon ON public.extintores;

-- 2b. Remover política de update permissiva para usuários autenticados
--     (extintores só devem ser alterados por admins)
DROP POLICY IF EXISTS extintores_update_user_coords ON public.extintores;

-- Garantir que a política de update correta (admin only) existe
DROP POLICY IF EXISTS extintores_update_admin ON public.extintores;
CREATE POLICY extintores_update_admin
ON public.extintores
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2c. Remover política anon em checklists
DROP POLICY IF EXISTS checklists_insert_anon ON public.checklists;

-- 2d. Corrigir política de insert em checklists: exigir uid válido
DROP POLICY IF EXISTS checklists_insert_authenticated ON public.checklists;
CREATE POLICY checklists_insert_authenticated
ON public.checklists
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 2e. Garantir que extintores_insert também exige admin
DROP POLICY IF EXISTS extintores_insert_admin ON public.extintores;
CREATE POLICY extintores_insert_admin
ON public.extintores
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());


-- ────────────────────────────────────────────────────────────
-- 3. REMOVER a extensão unaccent do schema public (extension_in_public)
--    Extensões no schema public ficam expostas a todos os roles.
--    Mover para o schema extensions (padrão Supabase).
--    ATENÇÃO: só execute se não usar unaccent() diretamente em funções SQL.
-- ────────────────────────────────────────────────────────────

DROP EXTENSION IF EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;


-- ────────────────────────────────────────────────────────────
-- VERIFICAÇÃO — confirme que as políticas estão corretas
-- ────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
