-- Aplicada en producción el 2026-10-30 (Supabase MCP). Guardada aquí como referencia.
-- Los maestros no pueden editar niños, pero sí completar la fecha de
-- nacimiento cuando falta (al registrarlo el domingo). Solo si está vacía.
create or replace function public.set_child_birth_date(p_child_id uuid, p_birth_date date)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  if p_birth_date is null or p_birth_date > (now() at time zone 'America/Guatemala')::date
     or p_birth_date < (now() at time zone 'America/Guatemala')::date - interval '18 years' then
    raise exception 'Fecha de nacimiento inválida.';
  end if;
  update public.children set birth_date = p_birth_date
  where id = p_child_id and birth_date is null and deleted_at is null;
  if not found then raise exception 'Este niño ya tiene fecha de nacimiento.'; end if;
end;
$$;
revoke execute on function public.set_child_birth_date(uuid, date) from public, anon;
grant execute on function public.set_child_birth_date(uuid, date) to authenticated;
