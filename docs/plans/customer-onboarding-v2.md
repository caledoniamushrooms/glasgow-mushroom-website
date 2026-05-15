# Customer Onboarding v2

**Status:** Draft — awaiting review
**Author:** Portal side (with Odin agent coordination)
**Date:** 2026-05-15

## Goal

Implement a four-step trade customer onboarding flow:

1. Prospect submits a short interest form on `/portal`.
2. GMC approves the interest (in portal admin UI **or** Odin). Magic-link invitation email is sent.
3. Prospect clicks the link, authenticates, fills the full onboarding form (mirrors the GMC-New-Customer-Form paper form).
4. GMC reviews the completed application in portal admin UI. On acceptance, a `customers` row + first `branches` row are created in Odin's schema in a single transaction. On rejection, the application is closed with a reason.

The end state is **B-pragmatic**: `customers` and `branches` only ever contain fully-accepted businesses; in-flight applications live entirely in `portal_registration_requests`.

## Scope boundary

| | Portal owns | Odin owns |
|---|---|---|
| `portal_registration_requests` table | ✅ migration + RLS | reads + writes via edge function |
| `portal-registration` edge function | ✅ | calls it |
| Step-2 admin UI (approve interest) | ✅ at `/portal/admin/registrations` | ✅ at `/settings/registration-requests` (Odin side) |
| Step-3 onboarding form | ✅ at `/portal/onboarding` | n/a |
| Step-4 admin review (accept/reject completed application) | ✅ at `/portal/admin/applications` | not in v1 |
| `customer_types.is_portal_visible` flag | reads | ✅ migration + admin toggle |
| `customers` / `branches` insert on acceptance | ✅ via edge function (service role) | reads downstream |
| Transactional email | ✅ (provider TBD, leaning Resend) | n/a |
| Sidebar badge + pending panel | n/a | ✅ |

## Status machine

```
interest_submitted
   │ (admin approves — portal or Odin)
   ▼
approved
   │ (prospect clicks magic link → lands on onboarding form)
   ▼
onboarding_in_progress
   │ (prospect submits full form)
   ▼
submitted_for_review
   │ ┌─ (admin accepts — portal only) ──► active
   │ └─ (admin rejects)                ──► rejected
   │
   └─ from any step, admin can reject ──► rejected
```

Each transition is guarded in the `WHERE` clause of the `UPDATE` so concurrent writers become no-ops:

```sql
UPDATE portal_registration_requests
SET status = 'approved', ...
WHERE id = $1 AND status = 'interest_submitted'
```

Zero-rows-affected → `409 already_processed` from the edge function.

## DDL

The current `portal_registration_requests` table exists in the live DB but isn't checked into either repo's migrations. This migration replaces it. Existing rows are migrated in place.

**Filename:** `supabase/migrations/20260515120000_onboarding_v2.sql`

```sql
-- =====================================================================
-- 1. STATUS ENUM
-- =====================================================================
-- We use a CHECK constraint rather than a Postgres ENUM type. Cheaper to
-- evolve, and the values aren't shared with other tables.

-- =====================================================================
-- 2. EXTEND portal_registration_requests
-- =====================================================================

-- New columns to stage the full onboarding payload until step-4 acceptance.
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

  -- Notes (already may exist as `message` — keeping `message` as
  -- step-1 interest comment and adding `notes` for step-3 special reqs)
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
-- add new check → set new default. This avoids the default value
-- briefly violating either the old or the new constraint.
alter table public.portal_registration_requests
  alter column status drop default;

alter table public.portal_registration_requests
  drop constraint if exists portal_registration_requests_status_check;

-- Migrate existing rows. Mapping:
--   pending     → interest_submitted
--   invited     → approved (auth user was created, no onboarding yet)
--   registered  → active   (only used historically; assume completed)
--   rejected    → rejected
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
-- 3. INDEXES
-- =====================================================================

create index if not exists idx_portal_reg_requests_status
  on public.portal_registration_requests (status);

create index if not exists idx_portal_reg_requests_email
  on public.portal_registration_requests (email);

-- =====================================================================
-- 4. portal_users — allow nullable customer_id during onboarding
-- =====================================================================
-- Under B-pragmatic, an auth user is created at step 2 but no customer
-- exists until step 4. portal_users.customer_id must be nullable in the
-- interim. Once the application is accepted, we backfill it.

alter table public.portal_users
  alter column customer_id drop not null;

-- Widen the status check to cover the onboarding states the user moves
-- through (mirrors the request statuses for clarity, but only on
-- portal_users they map to: pending → active).
-- Existing values: pending | active. No widening needed for v1 — the
-- request row is the state machine; portal_users just flips to active
-- on acceptance.

-- =====================================================================
-- 5. RLS POLICIES
-- =====================================================================
-- Predicate: a caller is authorised if EITHER
--   (a) they have an active portal_users row with role = 'system_admin'
--   (b) they have no portal_users row at all (Odin staff)
-- Wrapped in a SECURITY DEFINER helper to avoid recursion (see CLAUDE.md).

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

-- Drop existing policies if any
drop policy if exists "Allow anonymous inserts (interest form)"
  on public.portal_registration_requests;
drop policy if exists "Reviewers can select"
  on public.portal_registration_requests;
drop policy if exists "Reviewers can update"
  on public.portal_registration_requests;
drop policy if exists "Applicant can update own row during onboarding"
  on public.portal_registration_requests;

-- Anonymous inserts (interest form)
create policy "Allow anonymous inserts (interest form)"
  on public.portal_registration_requests
  for insert
  to anon
  with check (
    status = 'interest_submitted'
    and approved_by is null
    and customer_id is null
  );

-- Reviewers (portal admin OR Odin staff) can read everything
create policy "Reviewers can select"
  on public.portal_registration_requests
  for select
  to authenticated
  using (can_review_portal_registrations());

-- Reviewers can update (step transitions happen via edge function with
-- service role, but allow direct updates too for admin UI flexibility)
create policy "Reviewers can update"
  on public.portal_registration_requests
  for update
  to authenticated
  using (can_review_portal_registrations());

-- The applicant (post-magic-link) can read and update their own row
-- during onboarding. Identification is by email match on the JWT.
create policy "Applicant can read own row"
  on public.portal_registration_requests
  for select
  to authenticated
  using (email = (auth.jwt() ->> 'email'));

create policy "Applicant can update own row during onboarding"
  on public.portal_registration_requests
  for update
  to authenticated
  using (
    email = (auth.jwt() ->> 'email')
    and status in ('approved','onboarding_in_progress')
  )
  with check (
    email = (auth.jwt() ->> 'email')
    and status in ('onboarding_in_progress','submitted_for_review')
  );

-- =====================================================================
-- 6. REALTIME PUBLICATION
-- =====================================================================
-- Allow Odin (and portal admin UI) to subscribe to changes for live
-- badge/panel updates.

alter publication supabase_realtime
  add table public.portal_registration_requests;
```

### Notes on the DDL

- **`message` vs `notes`:** keeping the existing `message` column as the step-1 free-text from the interest form. New `notes` column captures step-3 "Special Requirements". They're different stages of the conversation.
- **`site_type_id` references `customer_types`:** depends on Odin shipping `customer_types.is_portal_visible` first. If that hasn't landed when we apply this, we leave the FK in place (it doesn't break) and the form's site-type field stays disabled until the flag exists.
- **No `invite_token` column:** Supabase Auth owns the magic-link token. We don't mint our own.
- **No `password_hash` etc.:** we use Supabase Auth for credentials; the application row is just data.
- **RLS recursion:** `can_review_portal_registrations()` queries `portal_users`. `portal_users` itself has RLS. Because the helper is `SECURITY DEFINER`, it runs as the table owner and RLS on `portal_users` does not fire. This is the pattern called out in `CLAUDE.md`.

## Edge function changes

File: `supabase/functions/portal-registration/index.ts`

### Auth check (top of handler)

Replace the existing `system_admin`-only gate with the Option-X predicate:

```ts
const { data: portalUser } = await supabaseAdmin
  .from('portal_users')
  .select('role, status, customer_id')
  .eq('auth_user_id', user.id)
  .maybeSingle()

const isPortalAdmin = portalUser?.status === 'active'
                   && portalUser.role === 'system_admin'
const isOdinStaff   = !portalUser
// When custom_access_token_hook lands on the Odin side, tighten with:
//   && user.app_role === 'admin'

const canReview = isPortalAdmin || isOdinStaff
```

`canReview` gates the approve/reject/accept actions. `invite_existing` keeps its existing `admin`-role check (it's a different flow).

### Action: `approve_registration` (existing — refactor)

**Today:** creates `customers`, `branches`, `portal_users`, sends invite, flips request to `invited`.

**Target:**

```ts
async function approveRegistration(supabase, params, reviewer) {
  const { request_id, reviewed_from } = params
  // 1. Atomic guarded transition
  const { data: request, error } = await supabase
    .from('portal_registration_requests')
    .update({
      status: 'approved',
      approved_by: reviewer,
      approved_at: new Date().toISOString(),
      reviewed_from,
    })
    .eq('id', request_id)
    .eq('status', 'interest_submitted')
    .select()
    .single()

  if (error || !request) return errorResponse(409, 'already_processed')

  // 2. Dedup check
  const { data: existing } = await supabase
    .from('portal_users')
    .select('id')
    .eq('email', request.email)
    .maybeSingle()
  if (existing) return errorResponse(409, 'portal_user_exists')

  // 3. Invite auth user (Supabase Auth sends the email)
  const { data: authData, error: inviteErr } =
    await supabase.auth.admin.inviteUserByEmail(request.email, {
      data: { display_name: request.contact_name },
      redirectTo: `${PORTAL_URL}/portal/onboarding`,
    })
  if (inviteErr) return errorResponse(500, 'invite_failed')

  // 4. Create portal_users row with NULL customer_id
  await supabase.from('portal_users').insert({
    auth_user_id: authData.user.id,
    customer_id: null,                 // ← key change vs today
    role: 'admin',
    display_name: request.contact_name,
    email: request.email,
    status: 'pending',
    invited_by: reviewer,
    invited_at: new Date().toISOString(),
  })

  return jsonResponse({ success: true, request_id })
}
```

**No `customers` or `branches` inserts here.** Those move to `accept_application`.

### Action: `accept_application` (new)

Called from the portal-only step-4 admin review screen. Performs the atomic create-customer-and-branches transaction.

```ts
async function acceptApplication(supabase, params, reviewer) {
  const { request_id, reviewed_from } = params
  if (reviewed_from !== 'portal') {
    return errorResponse(400, 'step-4 acceptance is portal-only in v1')
  }

  // Fetch full request
  const { data: request } = await supabase
    .from('portal_registration_requests')
    .select('*')
    .eq('id', request_id)
    .eq('status', 'submitted_for_review')
    .single()
  if (!request) return errorResponse(409, 'already_processed')

  // Validate the required fields the form should have collected
  const required = ['business_name','email','fulfilment_method',
                    'site_name','site_type_id','address_line_1','city','postcode']
  for (const f of required) {
    if (!request[f]) return errorResponse(400, `missing field: ${f}`)
  }

  // 1. Create customers row (Odin's schema)
  // Map staging payment_method values → Odin's customers.payment_method values
  const paymentMap: Record<string,string> = {
    xero_bacs:        'xero',
    gocardless_dd:    'gocardless',
    cash_on_delivery: 'cash',
  }
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .insert({
      name: request.business_name,
      email: request.email,
      phone: request.phone,
      website_url: request.website,                          // ← Odin col is website_url
      transmission: request.fulfilment_method,
      payment_method: paymentMap[request.payment_method] ?? null,
      // price_tier_id, reference_code, payment_terms, xero_*, gocardless_*
      // intentionally left NULL — Odin admin fills these later
    })
    .select()
    .single()
  if (custErr) return errorResponse(500, 'customer_create_failed')

  // 2. Create first branch
  const { error: branchErr } = await supabase
    .from('branches')
    .insert({
      customer_id: customer.id,
      name: request.site_name,
      branch_type: 'branch',                     // per Odin agent guidance
      type_id: request.site_type_id,
      address_line_1: request.address_line_1,
      address_line_2: request.address_line_2,
      address_line_3: request.address_line_3,
      city: request.city,
      postcode: request.postcode,
      phone: request.site_phone,
      email: request.site_email,
    })
  if (branchErr) {
    // Roll back the customer insert
    await supabase.from('customers').delete().eq('id', customer.id)
    return errorResponse(500, 'branch_create_failed')
  }

  // 3. Backfill portal_users.customer_id and activate
  await supabase
    .from('portal_users')
    .update({
      customer_id: customer.id,
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
    .eq('email', request.email)

  // 4. Mark request as active
  await supabase
    .from('portal_registration_requests')
    .update({
      status: 'active',
      customer_id: customer.id,
      accepted_by: reviewer,
      accepted_at: new Date().toISOString(),
      reviewed_from,
    })
    .eq('id', request_id)

  // 5. Send "you're in" email (TODO: provider wiring)

  return jsonResponse({ success: true, customer_id: customer.id })
}
```

**Note:** no Postgres transaction wrapping because the Supabase JS client doesn't support multi-statement transactions out of the box. The compensating delete on branch failure is the pragmatic workaround. If this becomes a problem we'll move the body into a SQL function called via RPC.

### Action: `reject_application` (replaces `reject_registration`)

Generalised to reject from any non-terminal state. Stores reason.

```ts
async function rejectApplication(supabase, params, reviewer) {
  const { request_id, reason, reviewed_from } = params
  const { data, error } = await supabase
    .from('portal_registration_requests')
    .update({
      status: 'rejected',
      rejection_reason: reason ?? null,
      reviewed_from,
      // Use the right audit column based on which stage we were in
      ...(reason && { /* could split by source stage; v1 keeps it simple */ }),
    })
    .eq('id', request_id)
    .in('status', ['interest_submitted','approved',
                   'onboarding_in_progress','submitted_for_review'])
    .select()
    .single()
  if (error || !data) return errorResponse(409, 'already_processed')

  // TODO: send rejection email
  return jsonResponse({ success: true })
}
```

### Action: `submit_application` (new)

Called from the onboarding form on submit. Caller is the applicant (their JWT), not a reviewer. Validates the row belongs to them by email match.

```ts
async function submitApplication(supabase, params, user) {
  const { request_id, payload } = params
  // Match on email — applicant can only submit their own
  const { data: request } = await supabase
    .from('portal_registration_requests')
    .select('email, status')
    .eq('id', request_id)
    .single()
  if (!request || request.email !== user.email) return errorResponse(403)
  if (!['approved','onboarding_in_progress'].includes(request.status))
    return errorResponse(409, 'cannot_submit_from_status')

  const { error } = await supabase
    .from('portal_registration_requests')
    .update({
      ...payload,                       // whitelisted form fields only
      status: 'submitted_for_review',
    })
    .eq('id', request_id)
    .in('status', ['approved','onboarding_in_progress'])

  if (error) return errorResponse(500)

  // TODO: notify admins (email or in-portal)
  return jsonResponse({ success: true })
}
```

Whitelist the payload keys server-side — never spread blindly into the update.

## Portal UI changes

### `/portal/register` (interest form) — no UI change

Still inserts `business_name, contact_name, email, phone, message` with `status = 'interest_submitted'` (default).

### `/portal/onboarding` (full form) — full rewrite

Replaces the current 5-field profile completion with the paper-form-equivalent UI. Sections, mobile-first, single-column on phone, two-column on desktop.

**Sections (one screen, scrollable — not a wizard):**
1. Business: company name (prefilled from interest), website, email (prefilled), phone (prefilled)
2. Trading preferences: fulfilment method (radio), payment method (radio)
3. Delivery / branch site: site name, site type (radio of `customer_types where is_portal_visible`), site type other-flag, address lines, city, postcode, site phone, site email
4. Notes (textarea)
5. Print name → maps to `portal_users.display_name`
6. Submit

**On submit:** invoke edge function `submit_application` with the whitelisted payload. On success, show "Thanks — we'll review and get back to you" screen.

**On load:**
- If no session → redirect to login.
- Lookup `portal_registration_requests where email = jwt.email and status in ('approved','onboarding_in_progress')`. If found, prefill from row. Update status to `onboarding_in_progress` if currently `approved`.
- If status is `submitted_for_review` → show "Application under review" screen.
- If status is `active` and `portal_users` is active → redirect to `/portal`.

### `/portal/admin/registrations` (existing) — extend

Two tabs:
1. **Pending interest** (`status = 'interest_submitted'`) — current Approve/Reject buttons.
2. **Completed applications** (`status = 'submitted_for_review'`) — new. Each row expands to show the full submitted form. Accept and Reject buttons. Reject opens a reason textarea (required).

Could be split into two pages if the table widget gets unwieldy. Decide during build.

### Status badge map

Update `Registrations.tsx:38-44`:

```ts
{
  interest_submitted:      'badge-pending',
  approved:                'badge-info',
  onboarding_in_progress:  'badge-info',
  submitted_for_review:    'badge-pending',
  active:                  'badge-paid',
  rejected:                'badge-cancelled',
}
```

## Email touchpoints

| Transition | Trigger | Recipient | Status today |
|---|---|---|---|
| interest_submitted → approved | edge fn `approve_registration` | applicant | ✅ Supabase Auth invite email (default template, acceptable v1) |
| any → rejected | edge fn `reject_application` | applicant | ❌ not implemented |
| onboarding_in_progress → submitted_for_review | edge fn `submit_application` | GMC accounts inbox | ❌ not implemented |
| submitted_for_review → active | edge fn `accept_application` | applicant + GMC | ❌ not implemented |

**Provider:** leaning Resend. Domain `glasgowmushroomcompany.co.uk` SPF/DKIM status to be verified before wiring. **Out of scope for v1 ship** — the four missing emails can be added in a follow-up. The Supabase Auth invite email covers the only customer-facing email that's actually critical for the flow to work end-to-end. Document this gap in the plan and circle back.

## Coordination with Odin

| Item | Owner | Status |
|---|---|---|
| `customer_types.is_portal_visible` migration + seed | Odin | requested |
| Realtime subscription on `portal_registration_requests` | Odin | enabled by this migration |
| Sidebar badge + blue panel in CustomerDashboard | Odin | awaiting our DDL |
| Step-4 acceptance UI in Odin | not in v1 | future |
| `custom_access_token_hook` for `app_role` claim | Odin | tracked separately, not blocking |

## Risks

- **Compensating-delete on branch failure** in `accept_application` is not transactional. Very low likelihood of orphan customers if `branches` insert fails after `customers` succeeded, but worth migrating to a SQL function later.
- **Email gap:** four transitions have no email. v1 ships without them but applicants in the `submitted_for_review` state get no confirmation that their submission was received. Mitigate by showing a clear in-app "thanks — we'll be in touch" screen.
- **`customer_types` FK timing:** if the Odin `is_portal_visible` migration is delayed, the onboarding form's site-type field stays unusable. Workable but blocks step-3 ship.
- **Race condition on the applicant's row** is handled by the WHERE-clause status guard. Fine.
- **RLS recursion** is handled by `SECURITY DEFINER` on `can_review_portal_registrations()`.

## Implementation order

1. Share DDL with Odin agent, get sign-off
2. Apply migration via Supabase MCP
3. Refactor edge function (`approve_registration` + new `accept_application` + new `submit_application` + rename to `reject_application`)
4. Rewrite `Onboarding.tsx`
5. Extend `Registrations.tsx` admin UI (or split into a second page)
6. Test the full flow end-to-end with a real email account
7. Update `docs/trade-portal-roadmap.md`

Email-provider wiring lands as a follow-up plan.

## Open questions

- Site-type "Other" — confirm we just collect a boolean flag, no free-text. (Plan currently does this.)
- Multiple sites at onboarding — confirmed one only; rest added via Profile.
- Where does the rejected-applicant land if they click the magic link after rejection? Plan: onboarding page detects `status = 'rejected'` and shows a polite "this application was not approved" message. Confirm tone.
