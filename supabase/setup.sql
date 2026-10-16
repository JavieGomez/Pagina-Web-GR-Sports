-- GR Sports: run once in the Supabase SQL Editor for the configured project.
-- The browser uses only the publishable key; these grants and RLS policies
-- define what authenticated users, staff, and public visitors can access.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text not null default '';

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  service_key text not null,
  service_title text not null,
  details jsonb not null default '{}'::jsonb,
  estimate_eur numeric(10,2) not null check (estimate_eur >= 0),
  quote_choice text not null check (quote_choice in ('estimate', 'whatsapp')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_response text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  trainer_id uuid references auth.users (id) on delete set null,
  notes text not null default '',
  allow_user_chat boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sessions_valid_time check (ends_at > starts_at)
);

create table if not exists public.session_participants (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid references public.service_requests (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  body text not null default '',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists service_requests_user_created_idx on public.service_requests (user_id, created_at desc);
create index if not exists service_requests_status_created_idx on public.service_requests (status, created_at desc);
create index if not exists sessions_start_idx on public.sessions (starts_at);
create index if not exists session_participants_user_idx on public.session_participants (user_id, session_id);
create index if not exists chat_messages_session_created_idx on public.chat_messages (session_id, created_at);

-- A profile is created from signup metadata. The function is private, uses a
-- fixed search path, and cannot be called by public API roles.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to supabase_auth_admin;

create or replace function private.create_gr_sports_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_gr_sports_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_gr_sports on auth.users;
create trigger on_auth_user_created_gr_sports
  after insert on auth.users
  for each row execute function private.create_gr_sports_profile();

alter table public.profiles enable row level security;
alter table public.service_requests enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.news_posts enable row level security;

revoke all on table public.profiles, public.service_requests, public.sessions,
  public.session_participants, public.chat_messages, public.news_posts from anon, authenticated;

grant select on public.news_posts to anon;
grant select on public.news_posts to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, insert on public.service_requests to authenticated;
grant update (status, admin_response) on public.service_requests to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert on public.session_participants to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant insert, update, delete on public.news_posts to authenticated;

drop policy if exists "Profiles readable by owner and staff" on public.profiles;
create policy "Profiles readable by owner and staff" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer')
  );

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Users and staff read service requests" on public.service_requests;
create policy "Users and staff read service requests" on public.service_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer')
  );

drop policy if exists "Users submit their own requests" on public.service_requests;
create policy "Users submit their own requests" on public.service_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

drop policy if exists "Staff manage service requests" on public.service_requests;
create policy "Staff manage service requests" on public.service_requests
  for update to authenticated
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer'))
  with check (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer'));

drop policy if exists "Participants and staff read sessions" on public.sessions;
create policy "Participants and staff read sessions" on public.sessions
  for select to authenticated
  using (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer')
    or exists (
      select 1 from public.session_participants p
      where p.session_id = sessions.id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Staff create sessions" on public.sessions;
create policy "Staff create sessions" on public.sessions
  for insert to authenticated
  with check (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer'));
drop policy if exists "Staff update sessions" on public.sessions;
create policy "Staff update sessions" on public.sessions
  for update to authenticated
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer'))
  with check (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer'));
drop policy if exists "Staff delete sessions" on public.sessions;
create policy "Staff delete sessions" on public.sessions
  for delete to authenticated
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer'));

drop policy if exists "Participants and staff read session members" on public.session_participants;
create policy "Participants and staff read session members" on public.session_participants
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer')
  );
drop policy if exists "Staff manage session members" on public.session_participants;
create policy "Staff manage session members" on public.session_participants
  for insert to authenticated
  with check (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer'));

drop policy if exists "Participants and staff read session chat" on public.chat_messages;
create policy "Participants and staff read session chat" on public.chat_messages
  for select to authenticated
  using (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer')
    or exists (
      select 1 from public.session_participants p
      where p.session_id = chat_messages.session_id and p.user_id = (select auth.uid())
    )
  );
drop policy if exists "Allowed participants and staff send chat messages" on public.chat_messages;
create policy "Allowed participants and staff send chat messages" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'trainer')
      or (
        exists (
          select 1 from public.session_participants p
          where p.session_id = chat_messages.session_id and p.user_id = (select auth.uid())
        )
        and exists (
          select 1 from public.sessions s
          where s.id = chat_messages.session_id and s.allow_user_chat
        )
      )
    )
  );

drop policy if exists "Anyone reads published news" on public.news_posts;
create policy "Anyone reads published news" on public.news_posts
  for select to anon, authenticated using (is_published = true);
drop policy if exists "Admins publish news" on public.news_posts;
create policy "Admins publish news" on public.news_posts
  for all to authenticated
  using (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

-- Enable row changes for live request and chat updates when the project's
-- default Realtime publication is present.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_requests') then
    alter publication supabase_realtime add table public.service_requests;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions') then
    alter publication supabase_realtime add table public.sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'Enable Realtime publication manually to receive live updates.';
end;
$$;
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
