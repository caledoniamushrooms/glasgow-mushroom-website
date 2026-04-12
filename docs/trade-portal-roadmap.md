# Trade Portal — Roadmap

This is a living document tracking the build status of every trade portal component. Update status as work progresses.

Statuses: `unstarted` | `planned` | `in-progress` | `built` | `blocked`

Implementation plans: `docs/plans/module-system.md`

---

## Phase A — Foundation

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 1 | Module toggle persistence | planned | `customer_modules` table + `useModules` hook + RLS |
| 2 | Registration request review + account creation | planned | Admin page + `portal-registration` edge function |

## Phase B — Module Infrastructure

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 3 | Module-aware navigation | planned | PortalLayout sidebar filtered by enabled modules |
| 4 | Dashboard module awareness | planned | Widgets conditional on enabled modules |
| 5 | ModuleGate component | planned | Reusable route-level guard, applied to all module routes |

## Phase C — Gates on Existing Modules

| # | Module | Key | Status | Notes |
|---|--------|-----|--------|-------|
| 5 | Pricing | `pricing` | planned | Built, needs ModuleGate wrap |
| 6 | Ordering | `ordering` | planned | Built, needs ModuleGate wrap |
| 8 | Accounts | `accounts` | planned | Built (invoices + payments), needs ModuleGate wrap |
| 9 | Team | `team` | planned | Built, needs ModuleGate wrap + edge function from #2 |

## Phase D — Feature Work

| # | Module | Key | Status | Notes |
|---|--------|-----|--------|-------|
| 7 | Recurring Orders create form | `recurring_orders` | planned | Mutation exists, needs UI form + ModuleGate |
| 10 | Delivery Notes | `delivery_notes` | planned | New table + page, staff-created, customer read-only |
| 11 | Promotions | `promotions` | planned | New table + page, customer-targeted via RLS |
| 12 | Stockouts | `stockouts` | planned | New table + page, customer submits restock requests |

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
| Realtime subscriptions | built | Auto-invalidates query caches on data changes |

---

## Implementation Process

Every module must go through this process:

1. **Plan** — Enter plan mode. Produce a detailed implementation plan covering data model, API, UI, and edge cases. Get alignment before writing code.
2. **Build** — Implement per the agreed plan.
3. **Test** — Verify on the live site via Chrome DevTools MCP.
4. **Update roadmap** — Mark status as `built` and add any notes.
