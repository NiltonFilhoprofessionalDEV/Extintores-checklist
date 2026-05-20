-- Corrige "stack depth limit exceeded" ao editar extintores e libera gestão para admin + liderança.
-- Execute no SQL Editor do Supabase.

-- Funções com SECURITY DEFINER leem profiles sem disparar RLS recursivo.
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
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
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_leadership()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role() IN ('admin', 'leadership'), false);
$$;

-- Extintores: admin e liderança podem cadastrar, editar e excluir.
DROP POLICY IF EXISTS extintores_insert_admin ON public.extintores;
CREATE POLICY extintores_insert_staff
ON public.extintores
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_leadership());

DROP POLICY IF EXISTS extintores_update_admin ON public.extintores;
CREATE POLICY extintores_update_staff
ON public.extintores
FOR UPDATE
TO authenticated
USING (public.is_admin_or_leadership())
WITH CHECK (public.is_admin_or_leadership());

DROP POLICY IF EXISTS extintores_delete_staff ON public.extintores;
CREATE POLICY extintores_delete_staff
ON public.extintores
FOR DELETE
TO authenticated
USING (public.is_admin_or_leadership());

-- Coordenadas no mapa: usuários autenticados (inspeção/posicionamento no app).
DROP POLICY IF EXISTS extintores_update_user_coords ON public.extintores;
CREATE POLICY extintores_update_user_coords
ON public.extintores
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
