# Trade Portal — Module System Implementation Plans

## Context

The trade portal is being restructured around a toggleable module system. Admins enable/disable modules per customer, controlling what each customer sees. This plan covers all 12 items in dependency order, from foundation infrastructure through to new feature modules.

---

## Build Phases

```
Phase A — Foundation
  1. Module toggle persistence (table + hook + RLS)
  2. Registration request review + account creation (admin page + edge function)

Phase B — Module Infrastructure
  3. Module-aware navigation (PortalLayout update)
  4. Dashboard module awareness
  + ModuleGate component (reusable route guard)

Phase C — Gates on Existing Modules (quick wins, single commit)
  5. Pricing gate
  6. Ordering gate
  8. Accounts gate (invoices + payments)
  9. Team gate

Phase D — Feature Work
  7. Recurring orders create form
  10. Delivery notes (new)
  11. Promotions (new)
  12. Stockouts (new)
```

---

## Item 1: Module Toggle Persistence (UNSTARTED)

**What**: Foundation table + hook for storing which modules each customer has enabled.

**Data model** — new `customer_modules` table:
```sql
CREATE TABLE public.customer_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enabled_by UUID REFERENCES auth.users(id),
  UNIQUE(customer_id, module_key)
);
```
TEXT for module_key (not enum) — adding modules is a code deploy, not a migration.

**Shared constants** — new `src/portal/lib/modules.ts`:
```ts
export const MODULE_KEYS = ['dashboard','pricing','ordering','recurring_orders','accounts','delivery_notes','promotions','team','stockouts'] as const
export type ModuleKey = typeof MODULE_KEYS[number]
```

**Hook** — new `src/portal/hooks/useModules.ts`:
- TanStack Query, key `['customer-modules', customerId]`
- Returns `{ enabledModules: Set<ModuleKey>, isModuleEnabled(key), loading }`
- system_admin bypasses — all modules enabled

**RLS**: Portal users read own; staff + system_admin manage all.

**Edge cases**: New customer with no rows = no modules (show welcome message). Add `customer_modules` to `useRealtime` subscriptions.

---

## Item 2: Registration Request Review + Account Creation (UNSTARTED)

**What**: Admin page for system_admins to review pending registrations, approve (create account) or reject.

**Data model**: `portal_registration_requests` already exists. No schema changes.

**Edge Function** — `supabase/functions/portal-registration/index.ts`:
- `action: 'approve_registration'` → create customer + branch + portal_user + auth invite email
- `action: 'reject_registration'` → update status to rejected
- `action: 'invite_existing'` → (used by Team.tsx) invite a user for an existing customer
- Requires service_role key for `supabase.auth.admin.inviteUserByEmail()`
- Verify caller is system_admin via JWT

**Hook** — new `src/portal/hooks/useRegistrations.ts`:
- Fetches `portal_registration_requests` ordered by created_at DESC
- Approve/reject mutations via `supabase.functions.invoke()`

**UI** — new `src/portal/pages/admin/Registrations.tsx`:
- Table: Business Name, Contact, Email, Phone, Message, Date, Status, Actions
- Pending filter tab
- Approve button → confirmation dialog
- Reject button → reason dialog
- Route: `/portal/admin/registrations` (requireSystemAdmin)
- Add to `adminNavItems` in PortalLayout.tsx

**RLS**: Add policies for `portal_registration_requests` — anon can insert, system_admin + staff can read/update.

**Edge cases**: Duplicate email check, partial failure rollback in edge function, email delivery failure.

---

## Item 3: Module-Aware Navigation (UPDATE PortalLayout.tsx)

**What**: Sidebar only shows nav items for enabled modules.

**Changes to `PortalLayout.tsx`**:
- Add `moduleKey: ModuleKey | null` to each nav item (null = always-on, e.g. Profile)
- Import `useModules()`, filter navItems by `isModuleEnabled()`
- system_admin sees all
- While loading, show all items to avoid layout flash

**Edge case**: If dashboard module is disabled, `/portal` needs a landing redirect to first enabled module.

**Depends on**: Item 1.

---

## Item 4: Dashboard Module Awareness (UPDATE Dashboard.tsx)

**What**: Widgets conditional on enabled modules.

**Changes to `Dashboard.tsx`**:
- Import `useModules()`
- Wrap balance/invoices/payments cards in `isModuleEnabled('accounts')`
- Wrap orders card in `isModuleEnabled('ordering')`
- Wrap recent invoices section in `isModuleEnabled('accounts')`
- If no modules enabled: show welcome message
- If dashboard module itself disabled: redirect to first enabled module

**Depends on**: Items 1, 3.

---

## Item 5: ModuleGate + Pricing Gate (NEW component + UPDATE App.tsx)

**What**: Reusable route-level guard component. Apply to pricing route.

**New component** — `src/portal/components/ModuleGate.tsx`:
```tsx
interface ModuleGateProps { moduleKey: ModuleKey; children: ReactNode }
```
- Calls `useModules()`
- Loading → spinner
- Not enabled → redirect to `/portal`
- system_admin → always passes

**Apply in App.tsx**:
```tsx
<Route path="/portal/price-list" element={<ModuleGate moduleKey="pricing"><PriceList /></ModuleGate>} />
```

No changes to PriceList.tsx.

**Depends on**: Item 1.

---

## Item 6: Ordering Gate (UPDATE App.tsx)

Wrap `/portal/orders` and `/portal/orders/new` with `<ModuleGate moduleKey="ordering">`. No changes to Orders.tsx or NewOrder.tsx.

**Depends on**: Item 5.

---

## Item 7: Recurring Orders Create Form (UPDATE RecurringOrders.tsx)

**What**: Build the missing create form. The `createRecurring` mutation already exists in `useRecurringOrders`.

**UI changes to RecurringOrders.tsx**:
- "Create Recurring Order" button in header
- Collapsible form: name, branch select, days-of-week checkboxes, dynamic product/quantity line items
- Submit calls `createRecurring.mutateAsync()`
- Same product/type selection pattern as NewOrder.tsx

**Module gate**: Wrap route with `<ModuleGate moduleKey="recurring_orders">`.

**RLS**: Verify `recurring_orders` and `recurring_order_items` have portal INSERT/SELECT/UPDATE policies. Add if missing.

**Edge cases**: Warn if selected days don't match delivery schedule. Require at least one item.

**Depends on**: Items 1, 5.

---

## Item 8: Accounts Gate (UPDATE App.tsx)

Keep `/portal/invoices` and `/portal/payments` as separate pages. Both wrapped with `<ModuleGate moduleKey="accounts">`. No changes to Invoices.tsx or Payments.tsx.

**Depends on**: Item 5.

---

## Item 9: Team Gate (UPDATE App.tsx)

Wrap `/portal/team` with `<ModuleGate moduleKey="team">`. No changes to Team.tsx.

The invite functionality depends on the edge function from Item 2.

**Depends on**: Items 2, 5.

---

## Item 10: Delivery Notes (UNSTARTED)

**Data model** — new tables:
```sql
delivery_notes (id, customer_id, branch_id, sale_id, portal_order_id, note_number, date, pdf_url, status, signed_by, signed_at, notes, created_at)
delivery_note_items (id, delivery_note_id, product_id, product_type_id, quantity, notes)
```
Status: pending → dispatched → delivered → signed. Created by staff, read-only for customers.

**Hook**: `useDeliveryNotes` — fetch by customer_id, ordered by date DESC.

**UI**: `DeliveryNotes.tsx` — table with note number, date, status badge, PDF link. Empty state.

**RLS**: Portal read own, staff manage all.

**Note**: Page will be empty until staff creates delivery notes in Odin. Add to `useRealtime`.

**Depends on**: Items 1, 5.

---

## Item 11: Promotions (UNSTARTED)

**Data model** — new table:
```sql
promotions (id, name, description, start_date, end_date, discount_type, discount_value, applicable_product_ids[], applicable_customer_ids[], min_order_quantity, active, image_url, created_by, created_at)
```
discount_type: percentage | fixed | free_sample | bundle | info_only.

**Hook**: `usePromotions` — fetches active promotions within date range. Customer targeting handled via RLS (`applicable_customer_ids IS NULL OR customer_id = ANY(applicable_customer_ids)`).

**UI**: `Promotions.tsx` — card grid layout. Name, description, date range, discount badge. Empty state.

**RLS**: Portal reads applicable promotions only, staff + system_admin manage all.

**Depends on**: Items 1, 5.

---

## Item 12: Stockouts (UNSTARTED)

**Data model** — new table:
```sql
stockout_requests (id, customer_id, branch_id, portal_user_id, product_id, product_name_text, quantity_needed, urgency, message, status, staff_notes, resolved_at, created_at)
```
urgency: low | normal | urgent. status: submitted → acknowledged → resolved | cancelled.

**Hook**: `useStockouts` — query + submitRequest mutation.

**UI**: `Stockouts.tsx` — submit form (product select with "Other" option, quantity, urgency radio, message) + request history table with status badges.

**RLS**: Portal read + insert own, staff manage all. Customers cannot update/delete.

**Depends on**: Items 1, 5.

---

## New Files Summary

| File | Item |
|------|------|
| `src/portal/lib/modules.ts` | 1 |
| `src/portal/hooks/useModules.ts` | 1 |
| `src/portal/hooks/useRegistrations.ts` | 2 |
| `src/portal/components/ModuleGate.tsx` | 5 |
| `src/portal/pages/admin/Registrations.tsx` | 2 |
| `src/portal/pages/DeliveryNotes.tsx` | 10 |
| `src/portal/pages/Promotions.tsx` | 11 |
| `src/portal/pages/Stockouts.tsx` | 12 |
| `src/portal/hooks/useDeliveryNotes.ts` | 10 |
| `src/portal/hooks/usePromotions.ts` | 11 |
| `src/portal/hooks/useStockouts.ts` | 12 |
| Supabase migrations (×5) | 1, 2, 10, 11, 12 |
| Supabase edge function | 2 |

## Modified Files Summary

| File | Items |
|------|-------|
| `src/portal/App.tsx` | 2, 3, 5–12 |
| `src/portal/components/PortalLayout.tsx` | 2, 3 |
| `src/portal/pages/Dashboard.tsx` | 4 |
| `src/portal/pages/RecurringOrders.tsx` | 7 |
| `src/portal/hooks/useRealtime.ts` | 1, 10, 12 |
| `src/portal/lib/types.ts` | 1, 10, 11, 12 |

## Verification

After each phase:
1. Module toggle: verify customer sees only enabled modules in nav + route guards work
2. Registration: submit form → admin approves → customer receives email → can log in
3. Gates: direct URL access to disabled module redirects to `/portal`
4. New pages: render correctly with data, show empty states when no data
5. RLS: query each new table as portal user + staff, confirm correct isolation
