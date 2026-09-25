-- Candidate/company contact workflow and moderation tables.
-- Run after the earlier schema migration files.

create table if not exists public.company_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.contact_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 5 and 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.company_contact_status (
  request_id uuid primary key references public.contact_requests(id) on delete cascade,
  candidate_status text not null default 'pending' check (candidate_status in ('pending','accepted','declined')),
  company_status text not null default 'pending' check (company_status in ('pending','accepted','declined')),
  candidate_note text check (candidate_note is null or char_length(candidate_note) <= 1000),
  updated_at timestamptz not null default now()
);

create index if not exists company_messages_request_idx on public.company_messages(request_id, created_at desc);
create index if not exists company_status_candidate_idx on public.company_contact_status(candidate_status, updated_at desc);

create trigger company_contact_status_touch before update on public.company_contact_status
for each row execute function public.touch_updated_at();

alter table public.company_messages enable row level security;
alter table public.company_contact_status enable row level security;

create policy company_messages_participants on public.company_messages for select using (
  sender_id = auth.uid() or recipient_id = auth.uid()
);

drop policy if exists company_messages_insert on public.company_messages;
create policy company_messages_insert on public.company_messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.contact_requests r
    where r.id = request_id
      and r.status = 'accepted'
      and (
        (r.company_id = sender_id and r.candidate_id = recipient_id)
        or (r.candidate_id = sender_id and r.company_id = recipient_id)
      )
  )
);

create policy company_contact_status_participants on public.company_contact_status for select using (
  exists (
    select 1 from public.contact_requests r
    where r.id = request_id and (r.company_id = auth.uid() or r.candidate_id = auth.uid())
  )
);
create policy company_contact_status_update on public.company_contact_status for update using (
  exists (
    select 1 from public.contact_requests r
    where r.id = request_id and r.candidate_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.contact_requests r
    where r.id = request_id and r.candidate_id = auth.uid()
  )
);

create or replace function public.ensure_company_contact_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.company_contact_status (request_id, candidate_status, company_status)
  values (new.id, 'pending', 'pending')
  on conflict (request_id) do nothing;
  return new;
end; $$;

drop trigger if exists create_company_contact_status on public.contact_requests;
create trigger create_company_contact_status after insert on public.contact_requests
for each row execute function public.ensure_company_contact_status();

create or replace function public.handle_request_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' then
    insert into public.company_contact_status (request_id, candidate_status, company_status)
    values (new.id, 'accepted', 'accepted')
    on conflict (request_id) do update set candidate_status = excluded.candidate_status, company_status = excluded.company_status;
  end if;
  return new;
end; $$;

drop trigger if exists request_status_sync on public.contact_requests;
create trigger request_status_sync after update on public.contact_requests
for each row execute function public.handle_request_update();
