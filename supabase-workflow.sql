-- Workflow migration for company verification, admin bootstrap, evidence review, and contact requests.
-- Run after supabase-schema.sql and supabase-verification.sql in staging first.

create table if not exists public.company_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.profiles(id) on delete cascade,
  legal_name text not null check (char_length(legal_name) between 2 and 200),
  website text not null check (char_length(website) <= 500),
  registration_number text,
  business_email text not null check (char_length(business_email) <= 320),
  explanation text not null check (char_length(explanation) between 20 and 3000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_notes text check (review_notes is null or char_length(review_notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_pending_company_submission
  on public.company_verification_submissions(company_id) where status = 'pending';
create index if not exists company_verification_queue_idx
  on public.company_verification_submissions(status, created_at);

create trigger company_verification_touch before update on public.company_verification_submissions
for each row execute function public.touch_updated_at();

alter table public.company_verification_submissions enable row level security;
create policy company_submission_owner_read on public.company_verification_submissions
  for select using (company_id = auth.uid() or public.is_admin());
create policy company_submission_owner_insert on public.company_verification_submissions
  for insert with check (company_id = auth.uid());
create policy company_submission_owner_update on public.company_verification_submissions
  for update using (company_id = auth.uid() and status = 'rejected')
  with check (company_id = auth.uid());
create policy company_submission_admin_update on public.company_verification_submissions
  for update using (public.is_admin()) with check (public.is_admin());

-- Owners may submit verification, but cannot set the review outcome.
create or replace function public.protect_company_review_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.review_notes := null;
    elsif new.status <> old.status or new.review_notes is distinct from old.review_notes then
      raise exception 'Company verification outcomes can only be changed by an administrator';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists company_submission_protect_review on public.company_verification_submissions;
create trigger company_submission_protect_review before insert or update
on public.company_verification_submissions for each row execute function public.protect_company_review_fields();

-- Bootstrap exactly one administrator manually in the Supabase SQL editor.
-- Replace the UUID with the already-confirmed admin auth.users.id, then remove this comment from your private runbook.
-- insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-000000000000') on conflict do nothing;

-- Admin-only review of private evidence files is already granted in supabase-verification.sql.
