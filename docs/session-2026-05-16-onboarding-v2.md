# Session summary — GMC Trade Portal customer onboarding v2

Date: 2026-05-15 to 2026-05-16
Outcome: onboarding v2 contract shipped to prod; end-to-end verification pending; session ends with single-agent consolidation to the Odin-side agent.

## What we set out to do

Build a four-step trade customer onboarding flow:
1. Prospect submits interest
2. GMC admin approves
3. Prospect completes an online application (paper-form parity)
4. GMC admin reviews and accepts/rejects → customer profile created in Odin

## What's complete

### Architecture / planning
- **Plan document:** `docs/plans/customer-onboarding-v2.md`
- **Model B-pragmatic agreed:** auth user created at approval, customer/branch rows only created on final acceptance
- **Cross-team contract negotiated** with the Odin-side agent, including field mapping, RLS, JWT auth strategy (Option X), audit columns, status machine, and shared-DB migration ownership

### Database (applied to prod via Odin repo)
Migration `20260515120000_onboarding_v2.sql`:
- `portal_registration_requests` extended with full onboarding payload columns (website, fulfilment_method, payment_method, site_name, site_type_id, address fields, site contact, notes), audit columns (approved_by/at, accepted_by/at, rejection_reason, reviewed_from), and `customer_id` FK to `customers`
- `preferred_fulfilment` renamed to `fulfilment_method`
- Status enum widened to six-state machine: `interest_submitted → approved → onboarding_in_progress → submitted_for_review → active | rejected`
- Legacy status values migrated (`pending → interest_submitted`, etc.)
- `portal_users.customer_id` made nullable
- RLS rewritten with `can_review_portal_registrations()` SECURITY DEFINER helper (no recursion); applicant-can-edit-own-row policies; anon-insert for interest
- Indexes on status + email
- Realtime publication enabled

### Edge function (`portal-registration`, deployed to prod twice)
- **`approve_registration`** — step-2 transition, no longer creates customer/branch rows. Creates auth user + `portal_users` row with NULL customer_id. Dedup runs *before* the guarded status flip (fix shipped mid-session after a 409 surfaced)
- **`submit_application`** (new) — applicant-facing, whitelist-validates payload, transitions to `submitted_for_review`
- **`accept_application`** (new) — step-4 portal-only, validates required fields, atomically creates `customers` + first `branches` row with compensating-delete on branch failure, backfills `portal_users.customer_id` + activates, maps payment_method enum values to Odin's schema (`xero_bacs → xero` etc.), maps `website → website_url`
- **`reject_application`** (renamed from `reject_registration`) — generalised to work from any non-terminal status, stores reason
- **Option-X auth gate** — accepts portal system_admin OR any authenticated user without a `portal_users` row (Odin staff). Tightening to a JWT claim deferred until Odin's `custom_access_token_hook` ships
- **Surface tag** — every action accepts `reviewed_from: 'portal' | 'odin'` for audit

### Portal UI
- **`/portal/onboarding`** — full rewrite. Sectioned application form (Business, Trading preferences, Delivery/branch site, Notes, Authorisation). Status-driven branching: shows "under review" / "not approved" / "not found" terminal screens. Auto-transitions `approved → onboarding_in_progress` on first load. Queries `customer_types` for the site-type radios via `useCustomerTypes` hook (new)
- **`/portal/admin/registrations`** — split into Interest / Applications / All tabs. Expandable detail rows showing the full submitted application. Approve / Accept / Reject buttons gated by status. Reject takes a free-text reason
- **`useRegistrations` hook** updated to the new status union, separate `interestPending` and `reviewPending` lists, three mutations
- **`useCustomerTypes` hook** — queries portal-visible types from Odin's `customer_types` table
- **Server-side dedup** at `/api/register-interest` — refuses submissions whose email already has a `portal_users` row or a non-terminal `portal_registration_requests` row. Case-insensitive. Email normalised to lowercase. Catches the "admin tested with their own email" footgun

### Public site
- **`/portal`** — Astro page, dark Webflow theme, GMC header/nav/footer, login form (email + password + magic link toggle). Client-side auth check bounces signed-in users to `/portal/home`
- **`/portal/register`** — Astro page, same dark theme, full application form, writes to `portal_registration_requests` (not the legacy `portal_interest` table)
- **`/portal/forgot-password`** — Astro page, same dark theme, password reset via Supabase Auth
- **Email infrastructure** — Resend integration discovered already wired in `/api/register-interest.ts`. Confirmation email to applicant + admin notification to `accounts@glasgowmushroomcompany.co.uk` on interest submission, with new copy reflecting the review/approve flow

### Authenticated SPA
- **Dashboard URL moved** from `/portal` to `/portal/home` (the bare `/portal` URL now belongs to the public login page)
- All internal SPA navigations updated (sidebar Dashboard link, ProtectedRoute access-denied redirects, ModuleGate fallback, Onboarding/Customers post-action navigates, Login magic-link redirect)
- SPA Login.tsx / Register.tsx / ForgotPassword.tsx kept as deep-link fallbacks
- **Vercel redirect removed** — old `/portal/:path+ → /portal` catch-all from the "coming soon" era was hiding multiple SPA routes
- **Missing SPA imports fixed** — `DeliveryNotes`, `Promotions`, `Stockouts`, `Customers`, `Registrations` were referenced but not imported; hidden by the redirect until it was removed
- **Legacy SPA `/portal/register` route** removed during the dedup work, then re-added as the apply form under the dark Astro design

### Roadmap
- `docs/trade-portal-roadmap.md` updated with onboarding-v2 status

## What's working (verified)

- Public site `/portal`, `/portal/register`, `/portal/forgot-password` render in the dark Webflow theme with GMC header/nav/footer
- Interest submission via `/portal/register` — verified end-to-end with the `Caledonia Mushrooms Demo` test row, including Resend confirmation email + admin notification
- Server-side dedup catches the admin-email collision before submission
- Edge function deployed and reachable; dedup ordering fix verified by Odin agent (no more stranded `approved` rows on dedup failure)
- Customer-onboarding-v2 migration applied; schema state verified by Odin
- Odin-side Registrations panel + sidebar badge built (Odin agent's work)

## What's not yet verified end-to-end on prod

- Step 2: admin approval transitioning a row from `interest_submitted` to `approved` and triggering the Supabase Auth invite email
- Step 3: applicant clicking the magic link, landing on `/portal/onboarding`, filling and submitting the full application
- Step 4: admin reviewing the completed application and accepting, resulting in `customers` + `branches` rows in Odin's schema
- The `Caledonia Mushrooms Demo` test row is sitting at `interest_submitted` waiting for the next test pass

## What's incomplete / parked

### Transactional emails — 4 of 5 transitions still silent
- Interest received → applicant + admin: **wired** (Resend)
- Approval → applicant: covered by Supabase Auth's default invite email (acceptable v1)
- Onboarding submitted → GMC admin notification: **not wired**
- Acceptance → applicant "you're in" email: **not wired**
- Rejection → applicant explanation: **not wired**
- Provider choice (Resend) and `from:` conventions already established; just needs the templates and the wiring in `accept_application` / `reject_application` / `submit_application`

### Auth tightening for Odin staff
- Edge function currently accepts "any authenticated user without a `portal_users` row" as Odin staff
- Will tighten to a JWT `app_role` claim check once Odin ships `custom_access_token_hook`
- Two RLS policies on Odin's side (`system_admin_all_registrations`, `staff_all_registrations`) read from different JWT paths and will need reconciliation when the hook lands
- Today's predicate is acceptable v1

### Stranded-state hardening
- Compensating-delete in `accept_application` handles branch insert failure
- Dedup ordering fix prevents the most likely stranded-approved scenario
- Remaining risk: `portal_users` insert failing after `inviteUserByEmail` succeeds → orphan auth.users row. Cheap to clean manually; would need another compensating delete to fully harden

### Step-4 acceptance in Odin
- v1 keeps step-4 (final accept/reject of completed applications) in the portal admin UI only
- Odin's surface only shows step-2 (pending interest)
- Cheap to extend later by widening the panel filter

### Misc
- **No CI typecheck** — `tsc --noEmit` would have caught the `DeliveryNotes is not defined` bug. Followup
- **Shared-DB migration history asymmetry** — this repo's `supabase db push` is blocked by ~400 Odin migrations on remote that aren't local. Workaround: hand portal-owned migrations to Odin's repo to apply. No clean fix, just a known constraint
- **Auth redirect URL allowlist** — verified `/portal/onboarding` works; the new `/portal/home` and `/portal` redirects (post-restructure) weren't independently checked

## What was broken during the session and fixed

- **404 on form submission** — stale browser cache; resolved with hard refresh
- **409 `email_already_has_portal_account` on approval** — exposed an ordering bug (status flipped before dedup). Fixed by moving dedup before the guarded transition. Redeployed
- **Stranded test row** — old approval with no invite stuck in `approved` state. Cleaned up by Odin agent reverting status
- **`vercel.json` catch-all redirect** — was redirecting `/portal/*` back to `/portal`, breaking sign-in / admin / onboarding. Removed
- **`DeliveryNotes is not defined`** — five SPA routes referenced components that were never imported. Hidden by the vercel redirect until it was removed. Imports added
- **Two table fork** — the legacy `portal_interest` table was receiving submissions that never reached the new admin UI. Unified by pointing `/api/register-interest` at `portal_registration_requests`
- **Inverse styling on first try** — I built the unified portal pages in the white-card SPA theme; the user wanted the GMC public dark theme. Re-built three Astro pages in the correct theme; moved authenticated dashboard URL to `/portal/home` to free the `/portal` URL for the public login page

## PRs merged this session

| # | Title |
|---|---|
| #4 | Customer onboarding v2 — four-step trade application flow |
| #5 | Unify /portal interest form with onboarding v2 flow |
| #6 | Dedup interest submissions + retire SPA register page |
| #7 | Fix: stop redirecting /portal/* back to /portal |
| #8 | Fix: add missing SPA imports |
| #9 | Portal login at /portal, apply form at /portal/register (visual unity) |
| #10 | Public portal entry pages use the GMC public dark theme |

## Workflow change at the end of session

Single-agent consolidation: write access to `/Users/hendrik-cm/Code/gmc-website` is being granted to the Odin-side agent so one assistant can drive both repos. Handover note delivered. This session ends here.
