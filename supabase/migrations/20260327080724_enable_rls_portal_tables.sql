-- =============================================================
-- Enable RLS and add policies for portal-exposed tables
-- =============================================================
-- These tables were previously wide-open (no RLS, full grants
-- to anon + authenticated). This migration:
--   1. Revokes write access from anon on all affected tables
--   2. Enables RLS
--   3. Adds scoped policies for portal users (via JWT claims)
--   4. Adds staff bypass policies (app_role = 'staff')
--
-- JWT claims are set by custom_access_token_hook:
--   claims.customer_id  – the portal user's customer UUID
--   claims.app_role     – 'staff' for Odin users, else the portal role
-- =============================================================

-- Helper: extract customer_id from JWT claims
CREATE OR REPLACE FUNCTION public.requesting_customer_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT ((auth.jwt() -> 'claims' ->> 'customer_id')::uuid)
$$;

-- Helper: check if the current user is staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT (auth.jwt() -> 'claims' ->> 'app_role') = 'staff'
$$;


-- =============================================================
-- 1. CUSTOMERS
-- =============================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.customers FROM anon;

CREATE POLICY "staff_all_customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "portal_read_own_customer"
  ON public.customers FOR SELECT
  TO authenticated
  USING (id = public.requesting_customer_id());

CREATE POLICY "portal_update_own_customer"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (id = public.requesting_customer_id())
  WITH CHECK (id = public.requesting_customer_id());


-- =============================================================
-- 2. BRANCHES
-- =============================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.branches FROM anon;

CREATE POLICY "staff_all_branches"
  ON public.branches FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "portal_read_own_branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (customer_id = public.requesting_customer_id());

CREATE POLICY "portal_update_own_branches"
  ON public.branches FOR UPDATE
  TO authenticated
  USING (customer_id = public.requesting_customer_id())
  WITH CHECK (customer_id = public.requesting_customer_id());


-- =============================================================
-- 3. INVOICES
-- =============================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.invoices FROM anon;

CREATE POLICY "staff_all_invoices"
  ON public.invoices FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "portal_read_own_invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (customer_id = public.requesting_customer_id());


-- =============================================================
-- 4. PAYMENTS
-- =============================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payments FROM anon;

CREATE POLICY "staff_all_payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "portal_read_own_payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (customer_id = public.requesting_customer_id());


-- =============================================================
-- 5. PRODUCTS (portal needs read-only for active products)
-- =============================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products FROM anon;

CREATE POLICY "staff_all_products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "portal_read_active_products"
  ON public.products FOR SELECT
  TO authenticated
  USING (active = true);


-- =============================================================
-- 6. PRODUCT_TYPES (portal needs read-only, all rows)
-- =============================================================
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.product_types FROM anon;

CREATE POLICY "staff_all_product_types"
  ON public.product_types FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "portal_read_product_types"
  ON public.product_types FOR SELECT
  TO authenticated
  USING (true);


-- =============================================================
-- 7. PRICE_LISTS (not queried by portal, staff-only)
-- =============================================================
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.price_lists FROM anon;
REVOKE SELECT ON public.price_lists FROM anon;

CREATE POLICY "staff_all_price_lists"
  ON public.price_lists FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- =============================================================
-- 8. SALES (not queried by portal, staff-only)
-- =============================================================
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sales FROM anon;
REVOKE SELECT ON public.sales FROM anon;

CREATE POLICY "staff_all_sales"
  ON public.sales FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- =============================================================
-- 9. SALE_ITEMS (not queried by portal, staff-only)
-- =============================================================
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sale_items FROM anon;
REVOKE SELECT ON public.sale_items FROM anon;

CREATE POLICY "staff_all_sale_items"
  ON public.sale_items FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- =============================================================
-- 10. VOLUME_DISCOUNTS (portal needs read-only for active)
-- =============================================================
ALTER TABLE public.volume_discounts ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.volume_discounts FROM anon;

CREATE POLICY "staff_all_volume_discounts"
  ON public.volume_discounts FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "portal_read_active_volume_discounts"
  ON public.volume_discounts FOR SELECT
  TO authenticated
  USING (active = true);


-- =============================================================
-- Revoke SELECT from anon on all portal-relevant tables
-- =============================================================
REVOKE SELECT ON public.customers FROM anon;
REVOKE SELECT ON public.branches FROM anon;
REVOKE SELECT ON public.invoices FROM anon;
REVOKE SELECT ON public.payments FROM anon;
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.product_types FROM anon;
REVOKE SELECT ON public.volume_discounts FROM anon;
