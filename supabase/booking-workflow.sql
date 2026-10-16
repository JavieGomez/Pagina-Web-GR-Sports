-- Upgrade an existing GR Sports database with admin decisions and user schedule responses.
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = 'administrador@grsports.com';

alter table public.service_requests
  add column if not exists admin_proposed_start_at timestamptz,
  add column if not exists admin_proposed_end_at timestamptz;

alter table public.service_requests drop constraint if exists service_requests_status_check;
alter table public.service_requests add constraint service_requests_status_check
  check (status in ('pending', 'change_pending', 'approved', 'rejected'));

create or replace function public.admin_decide_service_request(
  p_request_id uuid,
  p_action text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_message text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests%rowtype;
  v_session_id uuid;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
  ) then
    raise exception 'Solo un administrador puede gestionar solicitudes.' using errcode = '42501';
  end if;

  select * into v_request from public.service_requests
  where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'La solicitud ya no está pendiente.' using errcode = '22023';
  end if;

  if p_action not in ('approved', 'change_pending', 'rejected') then
    raise exception 'Acción no válida.' using errcode = '22023';
  end if;
  if p_action = 'rejected' then
    if v_message is null then raise exception 'Indica el motivo del rechazo.' using errcode = '22023'; end if;
    update public.service_requests set status = 'rejected', admin_response = v_message,
      admin_proposed_start_at = null, admin_proposed_end_at = null
    where id = p_request_id;
    return;
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'El horario debe tener inicio y fin válidos.' using errcode = '22023';
  end if;

  if p_action = 'change_pending' then
    update public.service_requests set status = 'change_pending',
      admin_response = coalesce(v_message, 'El equipo propone un cambio de horario. Revisa la propuesta y confirma si te viene bien.'),
      admin_proposed_start_at = p_starts_at, admin_proposed_end_at = p_ends_at
    where id = p_request_id;
    return;
  end if;

  insert into public.sessions (title, starts_at, ends_at, location, trainer_id, notes)
  values (v_request.service_title, p_starts_at, p_ends_at,
    coalesce(v_request.details ->> 'location', ''), (select auth.uid()),
    coalesce(v_message, 'Horario confirmado por el equipo GR Sports.'))
  returning id into v_session_id;
  insert into public.session_participants (session_id, user_id, request_id)
  values (v_session_id, v_request.user_id, v_request.id);
  update public.service_requests set status = 'approved',
    admin_response = coalesce(v_message, 'Solicitud confirmada para ' || to_char(p_starts_at at time zone 'Europe/Madrid', 'DD/MM/YYYY HH24:MI') || '.'),
    admin_proposed_start_at = null, admin_proposed_end_at = null
  where id = p_request_id;
end;
$$;

create or replace function public.respond_to_schedule_change(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests%rowtype;
  v_session_id uuid;
begin
  select * into v_request from public.service_requests
  where id = p_request_id and user_id = (select auth.uid()) for update;
  if not found or v_request.status <> 'change_pending'
    or v_request.admin_proposed_start_at is null or v_request.admin_proposed_end_at is null then
    raise exception 'No encontramos una propuesta pendiente para esta cuenta.' using errcode = '22023';
  end if;

  if p_accept then
    insert into public.sessions (title, starts_at, ends_at, location, notes)
    values (v_request.service_title, v_request.admin_proposed_start_at, v_request.admin_proposed_end_at,
      coalesce(v_request.details ->> 'location', ''), 'Horario propuesto por el equipo y aceptado por el usuario.')
    returning id into v_session_id;
    insert into public.session_participants (session_id, user_id, request_id)
    values (v_session_id, v_request.user_id, v_request.id);
    update public.service_requests set status = 'approved',
      admin_response = coalesce(nullif(admin_response, ''), 'Cambio de horario') || ' El usuario ha aceptado la propuesta.',
      admin_proposed_start_at = null, admin_proposed_end_at = null
    where id = p_request_id;
  else
    update public.service_requests set status = 'pending',
      admin_response = 'El usuario no puede aceptar el horario propuesto. Revisa la solicitud y propón otra fecha.',
      admin_proposed_start_at = null, admin_proposed_end_at = null
    where id = p_request_id;
  end if;
end;
$$;

revoke all on function public.admin_decide_service_request(uuid, text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.respond_to_schedule_change(uuid, boolean) from public, anon;
grant execute on function public.admin_decide_service_request(uuid, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.respond_to_schedule_change(uuid, boolean) to authenticated;
