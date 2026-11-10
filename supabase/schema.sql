-- =====================================================================
--  Certamen de belleza — esquema de base de datos (Supabase / Postgres)
--  Pégalo completo en Supabase → SQL Editor → Run.
--  Es re-ejecutable: si ya lo corriste antes, vuelve a correrlo y se
--  actualiza (Discord, votos por cuenta, etc.) sin borrar tus datos.
-- =====================================================================

-- Antigüedad mínima de la cuenta de Discord (cámbiala aquí si quieres)
create or replace function public.discord_min_age() returns interval
language sql immutable as $$ select interval '3 months' $$;

-- Fecha de creación de una cuenta de Discord a partir de su ID ("snowflake")
create or replace function public.discord_created_at(discord_id text) returns timestamptz
language sql immutable as $$
  select case when discord_id ~ '^[0-9]{15,20}$'
    then to_timestamp((floor(discord_id::numeric / 4194304) + 1420070400000) / 1000.0)
  end
$$;

-- ---------- Perfiles ----------
-- role: 'publico' (solo vota), 'participant' (se inscribió), 'staff'
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  role         text not null default 'publico',
  first_name   text,
  last_name    text,
  birth_date   date,
  state        text,
  height_cm    int,
  weight_kg    numeric(5,1),
  phone        text,
  instagram    text,
  occupation   text,
  education    text,
  bio          text,
  photo_url    text,
  photos       text[] not null default '{}',
  status       text not null default 'pendiente' check (status in ('pendiente','en_revision','completado')),
  is_finalist  boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.profiles add column if not exists about_me           text;
alter table public.profiles add column if not exists discord_id         text;
alter table public.profiles add column if not exists discord_username   text;
alter table public.profiles add column if not exists discord_name       text;
alter table public.profiles add column if not exists discord_avatar     text;
alter table public.profiles add column if not exists discord_created_at timestamptz;
create unique index if not exists profiles_discord_id_key on public.profiles (discord_id);

alter table public.profiles alter column role set default 'publico';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('publico','participant','staff'));
-- Cuentas que nunca enviaron ficha pasan a ser "público"
update public.profiles set role = 'publico'
  where role = 'participant' and status = 'pendiente' and first_name is null;

-- ---------- Evaluaciones del jurado / staff ----------
create table if not exists public.evaluations (
  id             bigserial primary key,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  staff_id       uuid references public.profiles(id) on delete set null default auth.uid(),
  belleza        numeric(3,1) not null check (belleza between 0 and 10),
  presencia      numeric(3,1) not null check (presencia between 0 and 10),
  carisma        numeric(3,1) not null check (carisma between 0 and 10),
  comunicacion   numeric(3,1) not null check (comunicacion between 0 and 10),
  actitud        numeric(3,1) not null check (actitud between 0 and 10),
  comentarios    text,
  updated_at     timestamptz not null default now(),
  unique (participant_id, staff_id)
);

-- ---------- Votos del público ----------
-- 1 voto por cuenta de Discord (voter_id) y 1 por IP (ip_hash). Solo el servidor escribe aquí.
create table if not exists public.votes (
  id             bigserial primary key,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  ip_hash        text not null unique,
  created_at     timestamptz not null default now()
);
alter table public.votes add column if not exists voter_id   uuid references public.profiles(id) on delete cascade;
alter table public.votes add column if not exists discord_id text;
create unique index if not exists votes_voter_id_key   on public.votes (voter_id);
create unique index if not exists votes_discord_id_key on public.votes (discord_id);

-- ---------- Ajustes del certamen (una sola fila) ----------
create table if not exists public.settings (
  id               int primary key default 1 check (id = 1),
  voting_open      boolean not null default false,
  results_public   boolean not null default false,
  finalists_public boolean not null default false
);
insert into public.settings (id) values (1) on conflict do nothing;
alter table public.settings add column if not exists registrations_open boolean not null default true;

-- ¿Las participantes pueden inscribirse o editar su ficha?
create or replace function public.registrations_open() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select registrations_open from public.settings where id = 1), true);
$$;

-- ---------- Funciones auxiliares ----------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff');
$$;

-- Al entrar por primera vez con Discord: valida la antigüedad y crea el perfil.
-- Si la cuenta de Discord es demasiado nueva, el registro se rechaza por completo.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  did  text  := coalesce(meta->>'provider_id', meta->>'sub');
  born timestamptz := public.discord_created_at(did);
begin
  if coalesce(new.raw_app_meta_data->>'provider', '') = 'discord' then
    if born is null then
      raise exception 'DISCORD_ID_INVALIDO';
    end if;
    if born > now() - public.discord_min_age() then
      raise exception 'DISCORD_CUENTA_NUEVA';
    end if;
  end if;

  insert into public.profiles (id, email, discord_id, discord_username, discord_name, discord_avatar, discord_created_at)
  values (
    new.id, new.email, did,
    regexp_replace(coalesce(meta->>'name', meta->>'full_name', ''), '#0$', ''),
    coalesce(meta#>>'{custom_claims,global_name}', meta->>'full_name', meta->>'name'),
    meta->>'avatar_url',
    born
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantiene nombre y avatar de Discord al día cuando la persona vuelve a entrar
create or replace function public.sync_discord_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  update public.profiles set
    discord_username = coalesce(nullif(regexp_replace(coalesce(meta->>'name', meta->>'full_name', ''), '#0$', ''), ''), discord_username),
    discord_name     = coalesce(meta#>>'{custom_claims,global_name}', meta->>'full_name', discord_name),
    discord_avatar   = coalesce(meta->>'avatar_url', discord_avatar)
  where id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of raw_user_meta_data on auth.users
  for each row execute function public.sync_discord_profile();

-- El usuario no puede cambiarse el rol (salvo inscribirse), ni marcarse finalista, ni tocar sus datos de Discord
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then return new; end if; -- SQL editor, triggers o staff
  if not public.registrations_open() then
    raise exception 'INSCRIPCIONES_CERRADAS' using hint = 'Las inscripciones están cerradas.';
  end if;
  if not (old.role = 'publico' and new.role = 'participant') then
    new.role := old.role;
  end if;
  new.is_finalist := old.is_finalist;
  new.email := old.email;
  new.discord_id := old.discord_id;
  new.discord_username := old.discord_username;
  new.discord_name := old.discord_name;
  new.discord_avatar := old.discord_avatar;
  new.discord_created_at := old.discord_created_at;
  if new.status is distinct from old.status
     and not (old.status = 'pendiente' and new.status = 'en_revision') then
    new.status := old.status;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------- Seguridad (RLS) ----------
alter table public.profiles    enable row level security;
alter table public.evaluations enable row level security;
alter table public.votes       enable row level security;  -- sin políticas: nadie del cliente lee/escribe
alter table public.settings    enable row level security;

drop policy if exists "perfil propio o staff (leer)" on public.profiles;
create policy "perfil propio o staff (leer)" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
drop policy if exists "perfil propio o staff (editar)" on public.profiles;
create policy "perfil propio o staff (editar)" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_staff());

drop policy if exists "staff evalua" on public.evaluations;
create policy "staff evalua" on public.evaluations
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "ajustes visibles" on public.settings;
create policy "ajustes visibles" on public.settings for select using (true);
drop policy if exists "staff cambia ajustes" on public.settings;
create policy "staff cambia ajustes" on public.settings
  for update to authenticated using (public.is_staff());

-- ---------- Vista pública (solo datos no sensibles) ----------
create or replace view public.public_contestants as
select p.id, p.first_name, p.last_name, p.state,
       date_part('year', age(p.birth_date))::int as age,
       p.height_cm, p.photo_url, p.photos,
       case when (select finalists_public from public.settings where id = 1)
            then p.is_finalist else false end as is_finalist
from public.profiles p
where p.role = 'participant' and p.status in ('en_revision','completado');

-- Conteo de votos: visible para staff, o para todos si results_public = true
create or replace function public.vote_results()
returns table (participant_id uuid, votes bigint)
language sql stable security definer set search_path = public as $$
  select v.participant_id, count(*)::bigint
  from public.votes v
  where public.is_staff() or (select results_public from public.settings where id = 1)
  group by v.participant_id;
$$;

-- ¿Ya votó la persona conectada? (para mostrarlo en la página de votación)
create or replace function public.my_vote() returns uuid
language sql stable security definer set search_path = public as $$
  select participant_id from public.votes where voter_id = auth.uid();
$$;

-- ---------- Permisos ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, update on public.profiles to authenticated;
grant select on public.profiles to service_role;
grant select, insert, update, delete on public.evaluations to authenticated;
grant usage, select on sequence public.evaluations_id_seq to authenticated;
grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;
grant select on public.public_contestants to anon, authenticated, service_role;
grant all on public.votes to service_role;
grant usage, select on sequence public.votes_id_seq to service_role;
grant select on public.settings to service_role;
grant execute on function public.vote_results() to anon, authenticated;
grant execute on function public.my_vote() to authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.registrations_open() to anon, authenticated;

-- ---------- Almacenamiento de fotos ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do nothing;

drop policy if exists "subir fotos propias" on storage.objects;
create policy "subir fotos propias" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
              and (public.registrations_open() or public.is_staff()));
drop policy if exists "borrar fotos propias" on storage.objects;
create policy "borrar fotos propias" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
         and (public.registrations_open() or public.is_staff()));

-- =====================================================================
--  Para convertir una cuenta en STAFF (que entre primero con Discord en la web):
--    update public.profiles set role = 'staff' where discord_username = 'usuario_de_discord';
--    -- o por ID:  where discord_id = '123456789012345678';
--  Ver quién está registrado:
--    select discord_username, discord_id, role, discord_created_at from public.profiles;
--  Reiniciar la votación:
--    truncate public.votes;
-- =====================================================================
