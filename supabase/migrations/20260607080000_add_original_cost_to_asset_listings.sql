-- =============================================================
-- Asset register: original cost field
-- =============================================================
-- Track what we paid for each item so the admin form can derive
-- discount % / £ amount off the asking price. Public listing
-- continues to show asking_price only; original_cost is internal.
-- =============================================================

ALTER TABLE public.asset_listings
  ADD COLUMN original_cost NUMERIC(10,2) NULL
    CHECK (original_cost IS NULL OR original_cost >= 0);
