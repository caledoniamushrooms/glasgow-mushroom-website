-- Customer Onboarding v2
-- See docs/plans/customer-onboarding-v2.md

-- =====================================================================
-- 1. EXTEND portal_registration_requests
-- =====================================================================

-- Rename the existing `preferred_fulfilment` column to align naming with
-- the rest of the schema. Its CHECK constraint comes along automatically.
alter table public.portal_registration_requests
  rename column preferred_fulfilment to fulfilment_method;

alter table public.portal_registration_requests
  -- Business block
  add column if not exists website            text,

  -- Trading preferences (fulfilment_method already exists post-rename)
  add column if not exists payment_method     text
    check (payment_method in ('xero_bacs','gocardless_dd','cash_on_delivery')),

  -- Delivery / branch site
  add column if not exists site_name          text,
  add column if not exists site_type_id       uuid references public.customer_types(id),
  add column if not exists site_type_other    boolean not null default false,
  add column if not exists address_line_1     text,
  add column if not exists address_line_2     text,
  add column if not exists address_line_3     text,
  add column if not exists city               text,
  add column if not exists postcode           text,
  add column if not exists site_phone         text,
  add column if not exists site_email         text,

  -- Step-3 special requirements (separate from step-1 `message`)
  add column if not exists notes              text,

  -- Audit / transitions
  add column if not exists approved_by        uuid references auth.users(id),
  add column if not exists approved_at        timestamptz,
  add column if not exists accepted_by        uuid references auth.users(id),
  add column if not exists accepted_at        timestamptz,
  add column if not exists rejection_reason   text,
  add column if not exists reviewed_from      text
    check (reviewed_from in ('portal','odin')),

  -- Pointer to the resulting customer (populated only on acceptance)
  add column if not exists customer_id        uuid references public.customers(id);

-- Status widening. Order: drop default → drop check → update data →
-- add new check → set new default. Avoids any moment where the default
-- conflicts with whichever check is live.
alter table public.portal_registration_requests
  alter column status drop default;

alter table public.portal_registration_requests
  drop constraint if exists portal_registration_requests_status_check;

update public.portal_registration_requests
set status = case status
  when 'pending'    then 'interest_submitted'
  when 'invited'    then 'approved'
  when 'registered' then 'active'
  else status
end
where status in ('pending','invited','registered');

alter table public.portal_registration_requests
  add constraint portal_registration_requests_status_check
  check (status in (
    'interest_submitted',
    'approved',
    'onboarding_in_progress',
    'submitted_for_review',
    'active',
    'rejected'
  ));

alter table public.portal_registration_requests
  alter column status set default 'interest_submitted';

-- =====================================================================
-- 2. INDEXES
-- =====================================================================
create index if not exists idx_portal_reg_requests_status
  on public.portal_registration_requests (status);

create index if not exists idx_portal_reg_requests_email
  on public.portal_registration_requests (email);

-- =====================================================================
-- 3. portal_users — nullable customer_id during onboarding
-- =====================================================================
alter table public.portal_users
  alter column customer_id drop not null;

-- =====================================================================
-- 4. RLS — reviewer predicate (Option X), no recursion
-- =====================================================================
-- v1 grants reviewer rights to any authenticated user without a
-- portal_users row (Odin staff per Option X). Tighten when Odin's
-- custom_access_token_hook lands by adding an app_role='admin' check.
create or replace function public.can_review_portal_registrations()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1 from portal_users
        where auth_user_id = auth.uid()
          and status = 'active'
          and role = 'system_admin'
      )
      or not exists (
        select 1 from portal_users
        where auth_user_id = auth.uid()
      )
    )
$$;

drop policy if exists "Allow anonymous inserts (interest form)"
  on public.portal_registration_requests;
drop policy if exists "Reviewers can select"
  on public.portal_registration_requests;
drop policy if exists "Reviewers can update"
  on public.portal_registration_requests;
drop policy if exists "Applicant can read own row"
  on public.portal_registration_requests;
drop policy if exists "Applicant can update own row during onboarding"
  on public.portal_registration_requests;

create policy "Allow anonymous inserts (interest form)"
  on public.portal_registration_requests
  for insert to anon
  with check (
    status = 'interest_submitted'
    and approved_by is null
    and customer_id is null
  );

create policy "Reviewers can select"
  on public.portal_registration_requests
  for select to authenticated
  using (can_review_portal_registrations());

create policy "Reviewers can update"
  on public.portal_registration_requests
  for update to authenticated
  using (can_review_portal_registrations());

create policy "Applicant can read own row"
  on public.portal_registration_requests
  for select to authenticated
  using (email = (auth.jwt() ->> 'email'));

create policy "Applicant can update own row during onboarding"
  on public.portal_registration_requests
  for update to authenticated
  using (
    email = (auth.jwt() ->> 'email')
    and status in ('approved','onboarding_in_progress')
  )
  with check (
    email = (auth.jwt() ->> 'email')
    and status in ('onboarding_in_progress','submitted_for_review')
  );

-- =====================================================================
-- 5. REALTIME
-- =====================================================================
alter publication supabase_realtime
  add table public.portal_registration_requests;
