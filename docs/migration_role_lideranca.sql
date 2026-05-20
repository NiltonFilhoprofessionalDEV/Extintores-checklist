-- Adiciona o perfil "leadership" (liderança) ao enum user_role
-- Execute no SQL Editor do Supabase

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
      AND e.enumlabel = 'leadership'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'leadership';
  END IF;
END $$;
