-- =====================================================================
--  Certamen de belleza — esquema de base de datos (Supabase / Postgres)
--  Pégalo completo en Supabase → SQL Editor → Run.  Se puede ejecutar
--  varias veces sin romper nada.
-- =====================================================================

-- ---------- Perfiles (participantes y staff) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  role         text not null default 'participant' check (role in ('participant','staff')),
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

-- ---------- Votos del público (1 por IP) ----------
-- Solo el servidor (clave secreta) escribe aquí. La IP se guarda como hash.
create table if not exists public.votes (
  id             bigserial primary key,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  ip_hash        text not null unique,
  created_at     timestamptz not null default now()
);

-- ---------- Ajustes del certamen (una sola fila) ----------
create table if not exists public.settings (
  id               int primary key default 1 check (id = 1),
  voting_open      boolean not null default true,
  results_public   boolean not null default false,
  finalists_public boolean not null default false
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------- Funciones auxiliares ----------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff');
$$;

-- Crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Una participante no puede cambiarse el rol, marcarse finalista ni aprobarse sola
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then return new; end if; -- SQL editor o staff
  new.role := old.role;
  new.is_finalist := old.is_finalist;
  new.email := old.email;
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

-- ---------- Permisos ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.evaluations to authenticated;
grant usage, select on sequence public.evaluations_id_seq to authenticated;
grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;
grant select on public.public_contestants to anon, authenticated, service_role;
grant all on public.votes to service_role;
grant usage, select on sequence public.votes_id_seq to service_role;
grant select on public.settings to service_role;
grant execute on function public.vote_results() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

-- ---------- Almacenamiento de fotos ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do nothing;

drop policy if exists "subir fotos propias" on storage.objects;
create policy "subir fotos propias" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "borrar fotos propias" on storage.objects;
create policy "borrar fotos propias" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
--  Para convertir una cuenta en STAFF (regístrala primero en la web):
--    update public.profiles set role = 'staff' where email = 'correo@ejemplo.com';
--  Para reiniciar la votación:
--    truncate public.votes;
-- =====================================================================
