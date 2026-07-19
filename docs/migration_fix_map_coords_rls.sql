-- Libera posicionamento/remoção no mapa para admin_corporativo.
-- A policy antiga só permitia admin | leadership | user.
-- Execute no SQL Editor do Supabase se o marcador "pisca e some" ao mapear.

drop policy if exists extintores_update_user_coords on public.extintores;
create policy extintores_update_user_coords
on public.extintores for update to authenticated
using (
  public.can_access_base(base_id)
  and public.current_role()::text in ('admin', 'admin_corporativo', 'leadership', 'user')
)
with check (
  public.can_access_base(base_id)
  and public.current_role()::text in ('admin', 'admin_corporativo', 'leadership', 'user')
);

drop policy if exists hidrantes_update_user_coords on public.hidrantes;
create policy hidrantes_update_user_coords
on public.hidrantes for update to authenticated
using (
  public.can_access_base(base_id)
  and public.current_role()::text in ('admin', 'admin_corporativo', 'leadership', 'user')
)
with check (
  public.can_access_base(base_id)
  and public.current_role()::text in ('admin', 'admin_corporativo', 'leadership', 'user')
);
