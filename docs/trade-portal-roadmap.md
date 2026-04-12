# Trade Portal — Roadmap

This is a living document tracking the build status of every trade portal component. Update status as work progresses.

Statuses: `unstarted` | `planning` | `in-progress` | `built` | `blocked`

---

## Phase 1 — Admin Dashboard

| Component | Status | Notes |
|-----------|--------|-------|
| Customer list with module toggles | unstarted | Row per customer, column per module, checkbox toggles |
| Registration request review | unstarted | List pending requests, approve/reject |
| Account creation on approval | unstarted | Creates auth user, customer, portal_user, branch records |
| Invite existing customer | unstarted | Send invite email to known customer |
| Module toggle persistence | unstarted | `customer_modules` table, RLS policies |

## Phase 2 — Customer Dashboard

| Component | Status | Notes |
|-----------|--------|-------|
| Module-aware navigation | unstarted | Sidebar only shows links for enabled modules |
| Profile (always-on) | built | Business details, branches, delivery schedule |
| Dashboard module | built | Widgets for balance, invoices, payments, orders — needs module-awareness |

## Phase 3 — Customer Modules

| Module | Key | Status | Notes |
|--------|-----|--------|-------|
| Pricing | `pricing` | built | Price list, volume discounts, PDF download |
| Ordering | `ordering` | built | New orders, order management, history |
| Recurring Orders | `recurring_orders` | built | Standing orders, schedule (listing only — no create form yet) |
| Accounts | `accounts` | built | Invoices + payments (currently separate pages, need combining under one module) |
| Delivery Notes | `delivery_notes` | unstarted | |
| Promotions | `promotions` | unstarted | |
| Team | `team` | built | Invite members, role management |
| Stockouts | `stockouts` | unstarted | |

## Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| Registration interest form + emails | built | RYI form on `/portal`, confirmation + notification emails |
| Registration request form | built | `/portal/register`, inserts into `portal_registration_requests` |
| Login (password + magic link) | built | `/portal/login` |
| Onboarding flow | built | `/portal/onboarding`, collects profile, sets status to active |
| Auth + RLS | built | `useAuth` hook, RLS policies, JWT claims |
| Realtime subscriptions | built | Auto-invalidates query caches on data changes |
| Supabase Edge Function (portal-registration) | unstarted | Account creation, invite emails — called from Team.tsx but not implemented |

---

## Implementation Process

Every module must go through this process:

1. **Plan** — Enter plan mode. Produce a detailed implementation plan covering data model, API, UI, and edge cases. Get alignment before writing code.
2. **Build** — Implement per the agreed plan.
3. **Test** — Verify on the live site via Chrome DevTools MCP.
4. **Update roadmap** — Mark status as `built` and add any notes.
