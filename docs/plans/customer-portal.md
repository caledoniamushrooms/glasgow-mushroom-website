# Glasgow Mushroom Company — Customer Portal Plan

## Context

Glasgow Mushroom Company's marketing website (`gmc-website`) is an Astro 6 static site deployed on Vercel, replacing the current Webflow site. It has 8 pages (products, recipes, stockists, wholesale enquiry, contact forms) with no auth or database integration.

The goal is to add a **B2B customer portal** to this site where wholesale customers can register, view their account, place/manage orders, and pay invoices. The portal connects to **Odin's Supabase backend** (shared database, Edge Functions, auth) while keeping the marketing pages static and fast.

This unifies the web presence: one repo, one Vercel project, one domain (`glasgowmushroomcompany.com`), replacing both Webflow and the need for a separate portal app.

---

## Architecture Decision: Astro + React SPA Hybrid

The marketing site stays Astro (static, fast, SEO-friendly). The portal section (`/portal/*`) mounts a **full React SPA** using Astro's `@astrojs/react` integration with `client:only="react"`. This gives us:

- Static marketing pages (SSG, zero JS by default)
- Full React SPA for portal (client-side routing, auth state, real-time subscriptions)
- One repo, one Vercel deployment
- Shared CSS variables between marketing site and portal

```
gmc-website/
├── src/
│   ├── pages/                     # Existing Astro pages (unchanged)
│   │   ├── index.astro            # Splash
│   │   ├── home.astro             # Landing
│   │   ├── products.astro
│   │   ├── wholesale.astro        # Updated: add "Already a customer? Log in" CTA
│   │   └── portal/
│   │       └── [...path].astro    # Catch-all → mounts React SPA
│   ├── portal/                    # React SPA source
│   │   ├── App.tsx                # React Router, auth provider, Supabase client
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx       # Registration interest form (public)
│   │   │   ├── Onboarding.tsx     # Complete profile after invitation
│   │   │   ├── Dashboard.tsx      # Account overview
│   │   │   ├── Orders.tsx         # Order history + upcoming schedule
│   │   │   ├── NewOrder.tsx       # Place one-off order
│   │   │   ├── RecurringOrders.tsx
│   │   │   ├── Invoices.tsx       # Billing history
│   │   │   ├── InvoiceDetail.tsx  # Single invoice + pay button
│   │   │   ├── Payments.tsx       # Payment history
│   │   │   ├── Profile.tsx        # View/edit profile + branches
│   │   │   └── PriceList.tsx      # Product catalogue + PDF download
│   │   ├── components/
│   │   │   ├── PortalLayout.tsx   # Sidebar nav, responsive shell
│   │   │   ├── OrderForm.tsx
│   │   │   ├── OrderSchedule.tsx  # Upcoming deliveries calendar/list
│   │   │   ├── InvoiceTable.tsx
│   │   │   ├── PaymentButton.tsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useOrders.ts
│   │   │   ├── useInvoices.ts
│   │   │   └── useRealtime.ts
│   │   └── lib/
│   │       ├── supabase.ts        # Supabase client (portal-specific)
│   │       └── types.ts           # Shared DB types
│   ├── components/                # Existing Astro components
│   ├── data/                      # Existing static data
│   └── styles/
│       ├── global.css             # Existing marketing tokens
│       └── portal.css             # Portal-specific tokens (borrows Odin palette)
```

### The Astro catch-all page (`portal/[...path].astro`)

```astro
---
export const prerender = false  // SSR for auth redirects
---
<BaseLayout title="Customer Portal">
  <PortalApp client:only="react" path={Astro.url.pathname} />
</BaseLayout>
```

This mounts the React SPA. React Router handles all `/portal/*` routing client-side.

---

## Database Changes (in Odin's Supabase)

### New Tables

#### `portal_users` — Links auth users to customer accounts
```sql
CREATE TABLE public.portal_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),  -- admin can manage other users
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    invited_at TIMESTAMPTZ,
    invited_by UUID REFERENCES auth.users(id),
    accepted_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(auth_user_id),
    UNIQUE(email)
);
```

#### `portal_registration_requests` — Pre-auth interest form
```sql
CREATE TABLE public.portal_registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'invited', 'registered', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `portal_orders` — Staging table for customer-submitted orders
```sql
CREATE TABLE public.portal_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    branch_id UUID REFERENCES branches(id),
    portal_user_id UUID NOT NULL REFERENCES portal_users(id),
    requested_date DATE NOT NULL,
    actual_date DATE,  -- set by operator if different from requested
    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'confirmed', 'modified', 'cancelled', 'fulfilled')),
    sale_id UUID REFERENCES sales(id),  -- linked once confirmed → sale created
    operator_notes TEXT,
    customer_notes TEXT,
    cancelled_by TEXT CHECK (cancelled_by IN ('customer', 'operator')),
    cancelled_reason TEXT,
    modification_summary TEXT,  -- human-readable description of what changed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `portal_order_items` — Line items for portal orders
```sql
CREATE TABLE public.portal_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_order_id UUID NOT NULL REFERENCES portal_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_type_id UUID NOT NULL REFERENCES product_types(id),
    quantity NUMERIC(10,3) NOT NULL,
    estimated_price NUMERIC(10,2),  -- customer's tier price at time of order
    confirmed_price NUMERIC(10,2),  -- operator-confirmed price (may differ)
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `customer_delivery_schedules` — Preferred delivery days per customer
```sql
CREATE TABLE public.customer_delivery_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    branch_id UUID REFERENCES branches(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, branch_id, day_of_week)
);
```

### Schema Modifications to Existing Tables

```sql
-- sales: link back to portal order
ALTER TABLE public.sales ADD COLUMN portal_order_id UUID REFERENCES portal_orders(id);

-- recurring_orders: track source
ALTER TABLE public.recurring_orders ADD COLUMN source TEXT DEFAULT 'admin'
    CHECK (source IN ('admin', 'portal'));
```

### Custom JWT Claims Hook

A Supabase Auth hook injects `customer_id` and `app_role` into the JWT so RLS policies don't need joins:

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
    claims JSONB;
    portal_user RECORD;
BEGIN
    claims := event->'claims';

    SELECT customer_id, role INTO portal_user
    FROM public.portal_users
    WHERE auth_user_id = (event->>'user_id')::UUID
    AND status = 'active';

    IF portal_user IS NOT NULL THEN
        claims := jsonb_set(claims, '{customer_id}', to_jsonb(portal_user.customer_id));
        claims := jsonb_set(claims, '{app_role}', to_jsonb(portal_user.role));
    ELSE
        claims := jsonb_set(claims, '{app_role}', '"staff"');
    END IF;

    RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

### RLS Policies

Enable RLS on core tables. Staff get full access; portal users see only their customer's data.

**Pattern applied to**: `customers`, `branches`, `sales`, `sale_items`, `invoices`, `payments`, `recurring_orders`, `recurring_order_items`, `credit_notes`, `products`, `product_types`, `price_tiers`

```sql
-- Example: customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Staff: full access (Odin admin continues working unchanged)
CREATE POLICY "staff_all" ON public.customers FOR ALL TO authenticated
    USING ((auth.jwt()->'claims'->>'app_role') = 'staff')
    WITH CHECK ((auth.jwt()->'claims'->>'app_role') = 'staff');

-- Portal: read own customer only
CREATE POLICY "portal_read_own" ON public.customers FOR SELECT TO authenticated
    USING (id = (auth.jwt()->'claims'->>'customer_id')::UUID);

-- Portal: update limited fields on own customer
CREATE POLICY "portal_update_own" ON public.customers FOR UPDATE TO authenticated
    USING (id = (auth.jwt()->'claims'->>'customer_id')::UUID)
    WITH CHECK (id = (auth.jwt()->'claims'->>'customer_id')::UUID);
```

Products and price tiers get read-only access for all authenticated portal users (they need to see the catalogue).

**Critical deployment order**: Deploy JWT claims hook → verify all existing staff users get `app_role = 'staff'` → enable RLS per table one at a time → verify Odin admin still works after each table.

---

## Registration & Onboarding Flows

### Flow A: New Customer (Registration Request)

```
1. Prospect visits /wholesale or /portal/register
2. Fills interest form (business name, contact, email, phone, message)
3. → INSERT into portal_registration_requests (public, rate-limited)
4. Odin admin sees request in new "Registration Requests" section
5. Operator reviews, clicks "Send Invitation"
6. → Edge Function creates customer + branch records in Odin
7. → Supabase Auth inviteUserByEmail() sends magic link
8. → portal_registration_requests.status = 'invited'
9. Customer clicks email link → /portal/onboarding
10. Sets password, completes profile (delivery address, preferences, branches)
11. → portal_users record created, status = 'active'
```

### Flow B: Existing Customer (Direct Invitation)

```
1. Operator goes to customer profile in Odin
2. Clicks "Invite to Portal" button
3. → Supabase Auth inviteUserByEmail() with customer's email
4. → portal_users record created with status = 'pending'
5. Customer clicks email link → /portal/onboarding
6. Sets password, reviews pre-populated profile (from existing Odin data)
7. → portal_users.status = 'active', accepted_at = NOW()
```

### Flow C: Additional Users for Same Customer

```
1. Customer admin goes to /portal/profile → "Team" section
2. Invites colleague by email
3. → Edge Function sends invite, creates portal_users (same customer_id, role = 'member')
4. Colleague accepts, sets password
```

---

## Order Lifecycle

### One-Off Orders

```
Customer: /portal/orders/new
  → Selects branch (delivery location)
  → Picks date from allowed delivery days (customer_delivery_schedules)
  → Adds products + quantities (sees tier pricing)
  → Submits with optional notes
  → portal_orders created (status: 'submitted')

Odin Operator: sees in "Incoming Orders" queue
  → Reviews order
  → Confirms → sale created (status: 'pending'), portal_order.status = 'confirmed'
  → OR Modifies (change date/quantities/add items) → portal_order.status = 'modified'
     → Customer sees modification + operator notes in their schedule
  → OR Cancels → portal_order.status = 'cancelled'
     → Customer sees cancellation + reason

Customer: sees real-time status updates via Supabase Realtime
```

### Recurring Orders

```
Customer: /portal/orders/recurring
  → Sets up recurring pattern (uses existing recurring_orders table)
  → Selects days, products, quantities
  → recurring_orders.source = 'portal'
  → Existing commit-recurring-orders Edge Function auto-creates sales

Operator: can override individual instances
  → Bump date (customer sees updated schedule)
  → Cancel instance (customer sees cancellation)
  → Modify quantities
```

### Delivery Schedule

Customers can only select dates matching their `customer_delivery_schedules` entries. Operators set these up when creating/inviting the customer. The order form date picker only shows enabled days.

Operators can override: bump an order to a non-standard day, which shows in the customer's "Upcoming Orders" with a note explaining the change.

---

## Payment Integration

### MVP: Leverage Existing Payment URLs

No new payment provider integration needed. Use what's already built:

1. **Xero Online Payments** — Every Xero-synced invoice has an `online_payment_url` (Stripe-powered). Portal shows "Pay Now" button that opens this URL. Payment webhook flows back through existing `xero-webhook` Edge Function.

2. **GoCardless Direct Debit** — For customers with active mandates (`gocardless_mandate_status = 'active'`), show "Pay by Direct Debit" button. Triggers existing `gocardless-payments` Edge Function.

3. **Pay Full Balance** — Sums outstanding invoices, offers same payment methods. For GoCardless, creates a single payment for the total. For card, customer pays each invoice individually via Xero URLs.

### Portal Payment Flow

```
/portal/invoices → shows list with status badges and amount_due
  → Click invoice → /portal/invoices/:id
    → Invoice detail (line items, dates, PDF download)
    → "Pay Now" button:
       - If customer has GoCardless mandate → "Pay £X by Direct Debit"
       - Always → "Pay by Card" (opens online_payment_url)
    → Payment webhook fires → Supabase Realtime → portal updates status
```

---

## Pricing & Price Lists

- Portal shows the customer's **tier pricing** on the order form (looked up via `customer.price_tier_id` → `price_tiers.multiplier` × base product price)
- Prices marked as "estimated" on order form — final price confirmed by operator
- **PDF price list**: Edge Function generates a PDF with the customer's specific tier pricing for all active products. Downloadable from `/portal/price-list`
- Price list regenerated when products or tiers change (or generated on-demand)

---

## Portal UI Design

### Design Language

The portal borrows from **both** the marketing site (dark, serif headings) and Odin's design system (professional, functional):

- **Marketing pages**: Keep existing dark theme (`#040404` bg, Abhaya Libre headings)
- **Portal authenticated area**: Light theme matching Odin (white bg, green accents `hsl(142 71% 25%)`, clean cards)
- **Transition**: Login page bridges both aesthetics

### Responsive Breakpoints

Match the marketing site's existing breakpoints:
- Mobile: < 768px (single column, bottom nav)
- Tablet: 768px–1024px (collapsible sidebar)
- Desktop: > 1024px (persistent sidebar + content area)

### Key Portal Screens

1. **Login** — Email + password, "Forgot password" link, "Register as new customer" link
2. **Dashboard** — Account summary: outstanding balance, next delivery, recent orders, quick actions
3. **Orders** — Tabs: Upcoming | History. Upcoming shows calendar/list of scheduled deliveries with status
4. **New Order** — Branch selector → date picker (filtered to delivery days) → product grid with quantities → summary → submit
5. **Invoices** — Table: date, number, total, paid, due, status badge, actions (view, pay, download PDF)
6. **Payments** — Table: date, amount, method, invoice ref, status
7. **Profile** — Business details, branches, delivery preferences, team members (admin only)
8. **Price List** — Product catalogue with customer-specific pricing, download PDF button

---

## New Dependencies (gmc-website)

```json
{
  "@astrojs/react": "latest",
  "react": "^19.1.1",
  "react-dom": "^19.1.1",
  "@supabase/supabase-js": "^2.x",
  "@tanstack/react-query": "^5.x",
  "react-router-dom": "^7.8.0",
  "@react-pdf/renderer": "^4.x"
}
```

Optionally shadcn/ui components if we want exact Odin parity, or build lighter portal-specific components.

---

## New Edge Functions (in Odin's Supabase)

1. **`portal-registration`** — Submit interest, send invitation, complete onboarding
2. **`portal-orders`** — Submit, list, cancel orders (customer-facing, RLS-enforced)
3. **`portal-orders-admin`** — Confirm, modify, cancel orders (staff-facing)
4. **`portal-price-list`** — Generate customer-specific price list PDF
5. **`portal-invite`** — Send invitation to existing customers (staff-facing)

---

## Odin Admin Changes

New sections needed in the Odin admin app:

1. **Registration Requests** — List of pending requests with approve/reject/invite actions
2. **Incoming Portal Orders** — Queue of submitted orders awaiting confirmation
3. **Customer Profile: "Portal Access"** — Invite to portal, view portal users, manage access
4. **Customer Profile: "Delivery Schedule"** — Set preferred delivery days per branch

---

## Phased Implementation

### Pre-flight: Branch + Plan Commit
- Create feature branch in gmc-website repo: `feature/us-p4-002-customer-portal`
- Commit this implementation plan as `docs/plans/customer-portal.md`
- Create corresponding feature branch in Odin repo for DB/Edge Function changes

### Phase 0: Foundation
- Set up React integration in gmc-website (`@astrojs/react`, portal directory structure)
- Create `portal_users`, `portal_registration_requests`, `customer_delivery_schedules` tables
- Implement custom JWT claims hook
- Add RLS policies to core tables (one at a time, verify Odin after each)
- Update CORS for portal domain
- Basic portal shell: login page, auth provider, protected route wrapper

### Phase 1: Registration + Onboarding
- Public registration interest form on `/wholesale` and `/portal/register`
- `portal-registration` Edge Function
- Odin admin: Registration Requests list + "Send Invitation" action
- Invitation email flow (Supabase Auth invite)
- Onboarding page: set password, review/complete profile
- Existing customer direct invitation from Odin

### Phase 2: Dashboard + Billing
- Portal dashboard (account summary, balance, next delivery)
- Invoice list with balances (uses `invoice_balances` view)
- Invoice detail + PDF download
- Payment history
- "Pay Now" integration (Xero online payment URL + GoCardless)
- Profile view/edit
- Supabase Realtime for payment status updates

### Phase 3: Ordering
- `portal_orders` + `portal_order_items` tables + RLS
- Product catalogue with tier pricing
- One-off order form (branch → date → products → submit)
- `customer_delivery_schedules` setup in Odin admin
- Order list with status tracking + Realtime updates
- Odin admin: incoming orders queue, confirm/modify/cancel
- Order-to-sale conversion
- Price list page + PDF generation

### Phase 4: Recurring Orders + Schedule
- Recurring order setup from portal (writes to existing `recurring_orders` table)
- Upcoming order schedule view (combines one-off + recurring instances)
- Edit/cancel upcoming instances
- Operator modifications visible to customer
- Bump order dates (operator → customer notification)

### Phase 5: Multi-User + Polish
- Team management (customer admin invites colleagues)
- Email notifications (order confirmed, modified, payment received)
- Mobile-optimised views + touch interactions
- Accessibility audit
- Performance optimisation
- Security review of RLS policies

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **RLS breaks Odin admin** | Deploy JWT claims hook first. Enable RLS per-table, verify Odin after each. Have rollback SQL ready. |
| **Astro + React SPA routing conflicts** | `[...path].astro` catch-all with `prerender = false` handles this cleanly. Test thoroughly. |
| **Stale JWT claims after role changes** | Supabase refreshes tokens hourly. Force refresh on login. Document that role changes take up to 1hr. |
| **Order state conflicts** | Staging table (`portal_orders`) isolates portal orders from sales. Operator is the gatekeeper. |
| **Price discrepancies** | Prices shown as "estimated". Final price set on confirmation. Edge cases documented for operator. |

---

## Key Files to Modify/Create

### gmc-website repo
- `astro.config.mjs` — Add `@astrojs/react` integration
- `src/pages/portal/[...path].astro` — React SPA mount point
- `src/portal/**` — Entire React SPA (new)
- `src/styles/portal.css` — Portal design tokens
- `src/pages/wholesale.astro` — Add "Already a customer?" CTA
- `package.json` — New dependencies

### Odin repo (Supabase)
- `schema.sql` — New tables, RLS policies, JWT hook
- `supabase/functions/portal-registration/` — New Edge Function
- `supabase/functions/portal-orders/` — New Edge Function
- `supabase/functions/portal-orders-admin/` — New Edge Function
- `supabase/functions/portal-price-list/` — New Edge Function
- `supabase/functions/portal-invite/` — New Edge Function
- `supabase/functions/_shared/cors.ts` — Add portal domain

### Odin admin UI
- New component: Registration Requests list
- New component: Incoming Portal Orders queue
- Customer profile: Portal Access section
- Customer profile: Delivery Schedule section

---

## Verification

After each phase:
1. **RLS verification**: Query each table as both staff and portal user, confirm correct data isolation
2. **Odin regression**: Full smoke test of Odin admin (sales, invoices, payments, customer management)
3. **Portal E2E**: Registration → login → view invoices → place order → pay → verify in Odin
4. **Responsive**: Test all portal pages at 375px, 768px, 1440px
5. **Realtime**: Verify order status changes propagate to portal within 2 seconds
