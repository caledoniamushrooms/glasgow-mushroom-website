-- ============================================================
-- Module system: customer_modules + new feature tables + RLS
-- ============================================================

-- 1. customer_modules — stores which modules each customer has enabled
CREATE TABLE public.customer_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enabled_by UUID REFERENCES auth.users(id),
  UNIQUE(customer_id, module_key)
);

CREATE INDEX idx_customer_modules_customer ON public.customer_modules(customer_id);

ALTER TABLE public.customer_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_read_own_modules"
  ON public.customer_modules FOR SELECT
  TO authenticated
  USING (customer_id = public.requesting_customer_id());

CREATE POLICY "staff_all_customer_modules"
  ON public.customer_modules FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "system_admin_manage_modules"
  ON public.customer_modules FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());


-- 2. portal_registration_requests RLS (table already exists)
ALTER TABLE public.portal_registration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_registration"
  ON public.portal_registration_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admin_read_registrations"
  ON public.portal_registration_requests FOR SELECT
  TO authenticated
  USING (public.is_system_admin() OR public.is_staff());

CREATE POLICY "admin_update_registrations"
  ON public.portal_registration_requests FOR UPDATE
  TO authenticated
  USING (public.is_system_admin() OR public.is_staff())
  WITH CHECK (public.is_system_admin() OR public.is_staff());


-- 3. delivery_notes
CREATE TABLE public.delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  branch_id UUID REFERENCES public.branches(id),
  sale_id UUID REFERENCES public.sales(id),
  portal_order_id UUID REFERENCES public.portal_orders(id),
  note_number TEXT NOT NULL,
  date DATE NOT NULL,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dispatched', 'delivered', 'signed')),
  signed_by TEXT,
  signed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_notes_customer ON public.delivery_notes(customer_id);
CREATE INDEX idx_delivery_notes_date ON public.delivery_notes(date);

CREATE TABLE public.delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_type_id UUID REFERENCES public.product_types(id),
  quantity NUMERIC NOT NULL,
  notes TEXT
);

ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_read_own_delivery_notes"
  ON public.delivery_notes FOR SELECT
  TO authenticated
  USING (customer_id = public.requesting_customer_id());

CREATE POLICY "staff_all_delivery_notes"
  ON public.delivery_notes FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "portal_read_delivery_note_items"
  ON public.delivery_note_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_notes dn
      WHERE dn.id = delivery_note_id
      AND dn.customer_id = public.requesting_customer_id()
    )
  );

CREATE POLICY "staff_all_delivery_note_items"
  ON public.delivery_note_items FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- 4. promotions
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_sample', 'bundle', 'info_only')),
  discount_value NUMERIC,
  applicable_product_ids UUID[],
  applicable_customer_ids UUID[],
  min_order_quantity NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promotions_active_dates ON public.promotions(active, start_date, end_date);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_read_applicable_promotions"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (
    active = true
    AND start_date <= CURRENT_DATE
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    AND (
      applicable_customer_ids IS NULL
      OR public.requesting_customer_id() = ANY(applicable_customer_ids)
    )
  );

CREATE POLICY "staff_all_promotions"
  ON public.promotions FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "system_admin_manage_promotions"
  ON public.promotions FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());


-- 5. stockout_requests
CREATE TABLE public.stockout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  branch_id UUID REFERENCES public.branches(id),
  portal_user_id UUID NOT NULL REFERENCES public.portal_users(id),
  product_id UUID REFERENCES public.products(id),
  product_name_text TEXT,
  quantity_needed NUMERIC,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'urgent')),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'acknowledged', 'resolved', 'cancelled')),
  staff_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stockout_requests_customer ON public.stockout_requests(customer_id);
CREATE INDEX idx_stockout_requests_status ON public.stockout_requests(status);

ALTER TABLE public.stockout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_read_own_stockouts"
  ON public.stockout_requests FOR SELECT
  TO authenticated
  USING (customer_id = public.requesting_customer_id());

CREATE POLICY "portal_insert_own_stockouts"
  ON public.stockout_requests FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = public.requesting_customer_id());

CREATE POLICY "staff_all_stockouts"
  ON public.stockout_requests FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
