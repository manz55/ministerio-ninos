-- Aplicada en producción el 2026-11-08 (Supabase MCP). Guardada aquí como referencia.
-- Mandar el nombre vacío QUITA al encargado de ese día (antes daba error).
-- Mismo cambio en set_daily_computer_operator y set_daily_corderitos_lead.
create or replace function public.set_daily_coordinator(p_session_date date, p_name text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  if p_name is null or length(trim(p_name)) = 0 then
    delete from public.daily_coordinator where session_date = p_session_date;
    return;
  end if;
  insert into public.daily_coordinator (session_date, name, set_by) values (p_session_date, trim(p_name), auth.uid())
  on conflict (session_date) do update set name = excluded.name, set_by = excluded.set_by, updated_at = now();
end;
$$;
