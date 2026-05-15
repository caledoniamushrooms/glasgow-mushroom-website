# Trade Portal — Roadmap

This is a living document tracking the build status of every trade portal component. Update status as work progresses.

Statuses: `unstarted` | `planned` | `in-progress` | `built` | `blocked`

Implementation plans: `docs/plans/module-system.md`

---

## Phase A — Foundation

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 1 | Module toggle persistence | built | `customer_modules` table + `useModules` hook + RLS + realtime |
| 2 | Registration request review + account creation | built | Admin page + `useRegistrations` hook + edge function deployed |
| 2b | Customer onboarding v2 (4-step flow) | in-progress | DDL applied via Odin. Edge fn + hooks + Onboarding.tsx + admin Registrations.tsx rewritten. Awaits: deploy edge fn, end-to-end test, Odin-side build, transactional email follow-up. See `docs/plans/customer-onboarding-v2.md` |

## Phase B — Module Infrastructure

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 3 | Module-aware navigation | built | PortalLayout sidebar filtered by `moduleKey` on each nav item |
| 4 | Dashboard module awareness | built | Widgets conditional on accounts/ordering modules; empty state when no modules |
| 5 | ModuleGate component | built | Reusable route guard, applied to all module routes in App.tsx |

## Phase C — Gates on Existing Modules

| # | Module | Key | Status | Notes |
|---|--------|-----|--------|-------|
| 5 | Pricing | `pricing` | built | ModuleGate wrapped |
| 6 | Ordering | `ordering` | built | ModuleGate wrapped (orders + new order) |
| 8 | Accounts | `accounts` | built | ModuleGate wrapped (invoices + payments) |
| 9 | Team | `team` | built | ModuleGate wrapped; invite uses deployed edge function |

## Phase D — Feature Work

| # | Module | Key | Status | Notes |
|---|--------|-----|--------|-------|
| 7 | Recurring Orders create form | `recurring_orders` | built | Create form + ModuleGate; uses existing `createRecurring` mutation |
| 10 | Delivery Notes | `delivery_notes` | built | New table + page; staff-created, customer read-only |
| 11 | Promotions | `promotions` | built | Existing table + page; uses existing RLS policies |
| 12 | Stockouts | `stockouts` | built | New table + page; submit form + request history |

## Always-On (not modules)

| Component | Status | Notes |
|-----------|--------|-------|
| Profile | built | Business details, branches, delivery schedule |
| Markets | built | system_admin only, market locations + events |

## Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| Registration interest form + emails | built | RYI form on `/portal`, confirmation + notification emails |
| Registration request form | built | `/portal/register`, inserts into `portal_registration_requests` |
| Login (password + magic link) | built | `/portal/login` |
| Onboarding flow | built | `/portal/onboarding`, collects profile, sets status to active |
| Auth + RLS | built | `useAuth` hook, RLS policies, JWT claims |
| Realtime subscriptions | built | customer_modules, delivery_notes, stockout_requests added |
| Supabase Edge Function (portal-registration) | built | Deployed — approve/reject registrations + invite existing customers |
| DB migration (module system tables) | built | Tables created in Supabase: customer_modules, delivery_notes, stockout_requests |

---

## Implementation Process

Every module must go through this process:

1. **Plan** — Enter plan mode. Produce a detailed implementation plan covering data model, API, UI, and edge cases. Get alignment before writing code.
2. **Build** — Implement per the agreed plan.
3. **Test** — Verify on the live site via Chrome DevTools MCP.
4. **Update roadmap** — Mark status as `built` and add any notes.
