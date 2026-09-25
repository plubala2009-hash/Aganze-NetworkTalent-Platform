-- Trust and moderation additions for the Aganze marketplace.
-- Apply after supabase-schema.sql in staging first.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.admin_users(user_id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete cascade,
  simulation_id uuid references public.simulations(id) on delete cascade,
  decision text not null check (decision in ('approved','rejected','pending')),
  notes text check (notes is null or char_length(notes) <= 3000),
  created_at timestamptz not null default now(),
  check ((profile_id is not null) <> (simulation_id is not null))
);

create index if not exists verification_reviews_profile_idx on public.verification_reviews(profile_id, created_at desc);
create index if not exists verification_reviews_simulation_idx on public.verification_reviews(simulation_id, created_at desc);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()); $$;

-- Replace the temporary company-name admin convention from the initial MVP.
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists simulations_admin_all on public.simulations;
create policy simulations_admin_all on public.simulations for all using (public.is_admin()) with check (public.is_admin());

alter table public.admin_users enable row level security;
alter table public.verification_reviews enable row level security;
create policy admin_users_self_read on public.admin_users for select using (user_id = auth.uid());
create policy verification_reviews_admin_read on public.verification_reviews for select using (public.is_admin());
create policy verification_reviews_admin_insert on public.verification_reviews for insert with check (reviewer_id = auth.uid() and public.is_admin());

-- Admins may inspect private evidence only to perform moderation.
drop policy if exists simulation_files_admin_read on storage.objects;
create policy simulation_files_admin_read on storage.objects for select using (bucket_id = 'simulations' and public.is_admin());

-- Use auth metadata only to initialize the requested role; verification remains admin-only.
create or replace function public.protect_trust_fields() returns trigger
language plpgsql security definer set search_path = public, auth
as $$
declare requested_role text;
begin
  if tg_op = 'INSERT' then
    select raw_user_meta_data ->> 'requested_role' into requested_role from auth.users where id = new.id;
    new.role := case when requested_role = 'company' then 'company' else 'candidate' end;
    new.is_verified := false;
    new.verification_status := 'unverified';
  elsif auth.uid() is not null and not public.is_admin() then
    if new.role <> old.role or new.is_verified <> old.is_verified or new.verification_status <> old.verification_status then
      raise exception 'Trust and role fields can only be changed by an administrator';
    end if;
  end if;
  return new;
end; $$;

-- Candidate evidence may be submitted and made public by its owner, but approval is admin-controlled.
create or replace function public.protect_evidence_fields() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'UPDATE' and (new.verification_status <> old.verification_status or new.verification_notes is distinct from old.verification_notes) then
      raise exception 'Evidence verification fields can only be changed by an administrator';
    end if;
    if tg_op = 'INSERT' then
      new.verification_status := 'pending';
      new.verification_notes := null;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists simulations_protect_verification on public.simulations;
create trigger simulations_protect_verification before insert or update on public.simulations for each row execute function public.protect_evidence_fields();
