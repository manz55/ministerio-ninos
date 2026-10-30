-- Aplicada en producción el 2026-10-30 (Supabase MCP). Guardada aquí como referencia.
-- 1) Solo cuentas con perfil ACTIVO pueden usar los datos.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active = true);
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- attendance
drop policy if exists attendance_select_authenticated on public.attendance;
create policy attendance_select_staff on public.attendance for select to authenticated using (is_staff());
drop policy if exists attendance_insert_authenticated on public.attendance;
create policy attendance_insert_staff on public.attendance for insert to authenticated with check (is_staff());
drop policy if exists attendance_update_today_any_authenticated on public.attendance;
create policy attendance_update_today_staff on public.attendance for update to authenticated
  using (is_staff() and session_date = (now() at time zone 'America/Guatemala')::date)
  with check (is_staff() and session_date = (now() at time zone 'America/Guatemala')::date);

-- children / parents / child_contacts
drop policy if exists children_select_authenticated on public.children;
create policy children_select_staff on public.children for select to authenticated using (is_staff());
drop policy if exists children_insert_authenticated on public.children;
create policy children_insert_staff on public.children for insert to authenticated with check (is_staff());
drop policy if exists parents_select_authenticated on public.parents;
create policy parents_select_staff on public.parents for select to authenticated using (is_staff());
drop policy if exists parents_insert_authenticated on public.parents;
create policy parents_insert_staff on public.parents for insert to authenticated with check (is_staff());
drop policy if exists child_contacts_select_authenticated on public.child_contacts;
create policy child_contacts_select_staff on public.child_contacts for select to authenticated using (is_staff());

-- notas
drop policy if exists shift_notes_select_authenticated on public.shift_notes;
create policy shift_notes_select_staff on public.shift_notes for select to authenticated using (is_staff());
drop policy if exists shift_notes_insert_own on public.shift_notes;
create policy shift_notes_insert_own on public.shift_notes for insert to authenticated
  with check (is_staff() and (author_id = auth.uid() or author_id is null));

-- mensajes a coordinadores (antes los podía leer cualquiera, incluso sin cuenta)
drop policy if exists coordinator_requests_select_authenticated on public.coordinator_requests;
create policy coordinator_requests_select_staff on public.coordinator_requests for select to authenticated using (is_staff());
drop policy if exists coordinator_requests_insert_own on public.coordinator_requests;
create policy coordinator_requests_insert_own on public.coordinator_requests for insert to authenticated
  with check (is_staff() and author_id = auth.uid());
alter policy coordinator_requests_update_author_or_admin on public.coordinator_requests to authenticated;
alter policy coordinator_requests_delete_author_or_admin on public.coordinator_requests to authenticated;

-- encargados del día
drop policy if exists daily_coordinator_select_authenticated on public.daily_coordinator;
create policy daily_coordinator_select_staff on public.daily_coordinator for select to authenticated using (is_staff());
drop policy if exists daily_computer_operator_select_authenticated on public.daily_computer_operator;
create policy daily_computer_operator_select_staff on public.daily_computer_operator for select to authenticated using (is_staff());
drop policy if exists daily_corderitos_lead_select_authenticated on public.daily_corderitos_lead;
create policy daily_corderitos_lead_select_staff on public.daily_corderitos_lead for select to authenticated using (is_staff());

-- maestros / bitácoras: solo con sesión
alter policy maestros_select_admin on public.maestros to authenticated;
alter policy maestros_insert_admin on public.maestros to authenticated;
alter policy maestros_update_admin on public.maestros to authenticated;
alter policy maestros_delete_admin on public.maestros to authenticated;
alter policy deletion_log_select_admin on public.deletion_log to authenticated;

-- 2) Perfiles: cada quien puede corregir su nombre; nadie se puede subir de
--    rango por la API ni tocar la cuenta principal (solo la función admin-users,
--    que usa service_role).
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_staff on public.profiles for select to authenticated using (id = auth.uid() or is_staff());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.guard_profile_change()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.is_owner then raise exception 'No se puede borrar la cuenta principal.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.is_owner then raise exception 'No se puede crear otra cuenta principal.'; end if;
    return new;
  end if;
  if new.id <> old.id or new.is_owner is distinct from old.is_owner then
    raise exception 'Ese cambio no está permitido.';
  end if;
  if old.is_owner and old.id <> auth.uid() then
    raise exception 'No se puede modificar la cuenta principal.';
  end if;
  if not is_admin() and (new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email) then
    raise exception 'Solo un coordinador puede cambiar eso.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_profile_change on public.profiles;
create trigger trg_guard_profile_change before insert or update or delete on public.profiles
  for each row execute function public.guard_profile_change();

-- 3) Registros de hoy: un maestro puede corregir gafete/bíper, marcar salida
--    o quitar el registro, pero no cambiar de niño, fecha, grupo ni hora.
create or replace function public.guard_attendance_update()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or is_admin() then
    return new;
  end if;
  if new.child_id is distinct from old.child_id
     or new.session_date is distinct from old.session_date
     or new.category is distinct from old.category
     or new.team_color is distinct from old.team_color
     or new.checked_in_at is distinct from old.checked_in_at
     or new.assigned_teacher_id is distinct from old.assigned_teacher_id then
    raise exception 'Solo un coordinador puede cambiar eso del registro.';
  end if;
  if new.deleted_at is not null and old.deleted_at is null and new.deleted_by is distinct from auth.uid() then
    raise exception 'El registro se quita a nombre de quien lo quita.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_attendance_update on public.attendance;
create trigger trg_guard_attendance_update before update on public.attendance
  for each row execute function public.guard_attendance_update();

-- 4) RPCs: solo cuentas activas.
create or replace function public.set_daily_coordinator(p_session_date date, p_name text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name is required'; end if;
  insert into public.daily_coordinator (session_date, name, set_by) values (p_session_date, trim(p_name), auth.uid())
  on conflict (session_date) do update set name = excluded.name, set_by = excluded.set_by, updated_at = now();
end;
$$;
create or replace function public.set_daily_computer_operator(p_session_date date, p_name text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name is required'; end if;
  insert into public.daily_computer_operator (session_date, name, set_by) values (p_session_date, trim(p_name), auth.uid())
  on conflict (session_date) do update set name = excluded.name, set_by = excluded.set_by, updated_at = now();
end;
$$;
create or replace function public.set_daily_corderitos_lead(p_session_date date, p_name text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name is required'; end if;
  insert into public.daily_corderitos_lead (session_date, name, set_by) values (p_session_date, trim(p_name), auth.uid())
  on conflict (session_date) do update set name = excluded.name, set_by = excluded.set_by, updated_at = now();
end;
$$;
create or replace function public.assign_attendance_teacher(p_attendance_id uuid, p_teacher_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_category text;
  v_current_teacher uuid;
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  select category, assigned_teacher_id into v_category, v_current_teacher from public.attendance where id = p_attendance_id;
  if v_category is null then raise exception 'attendance record not found'; end if;
  if v_category not in ('corderitos_0_2','corderitos_2_4') then raise exception 'assigned teacher only applies to corderitos categories'; end if;
  if v_current_teacher is not null and v_current_teacher <> auth.uid() and not is_admin() then
    raise exception 'only the assigned teacher or a coordinator can change this';
  end if;
  if p_teacher_id is not null and not exists (select 1 from public.profiles where id = p_teacher_id and active) then
    raise exception 'invalid teacher';
  end if;
  update public.attendance set assigned_teacher_id = p_teacher_id where id = p_attendance_id;
end;
$$;

-- 5) Fotos de los niños: solo cuentas activas.
alter policy fotos_ninos_select_authenticated on storage.objects using (bucket_id = 'fotos-ninos' and public.is_staff());
alter policy fotos_ninos_insert_authenticated on storage.objects with check (bucket_id = 'fotos-ninos' and public.is_staff());
alter policy fotos_ninos_update_authenticated on storage.objects using (bucket_id = 'fotos-ninos' and public.is_staff());

-- 6) Nadie sin sesión toca las tablas de la app; funciones internas cerradas.
revoke all on public.activity_log, public.attendance, public.child_contacts, public.children,
  public.coordinator_requests, public.daily_computer_operator, public.daily_coordinator,
  public.daily_corderitos_lead, public.deletion_log, public.maestros, public.parents,
  public.profiles, public.shift_notes from anon;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;
revoke execute on function public.log_activity() from public, anon, authenticated;
revoke execute on function public.log_login() from public, anon, authenticated;
revoke execute on function public.guard_profile_change() from public, anon, authenticated;
revoke execute on function public.guard_attendance_update() from public, anon, authenticated;

-- 7) Cerrar lo de inscripciones/comprobantes (otro proyecto que ya no se usa).
drop policy if exists "Enable read access for all users" on public.inscripciones;
drop policy if exists "Permitir actualizacion publica" on public.inscripciones;
drop policy if exists "Permitir insercion publica" on public.inscripciones;
drop policy if exists "Permitir insertar a cualquiera" on public.inscripciones;
revoke all on public.inscripciones from anon, authenticated;
drop policy if exists "Permitir subida publica k8lwzj_0" on storage.objects;
drop policy if exists "Permitir subida publica k8lwzj_1" on storage.objects;
update storage.buckets set public = false where id = 'comprobantes';
