-- =============================================================
-- Asset register: VAT zero-rated flag
-- =============================================================
-- asking_price is stored ex-VAT (net). The UI displays inc-VAT by
-- applying the standard 20% rate. When is_zero_rated is true the
-- displayed price equals asking_price (no VAT added).
-- =============================================================

ALTER TABLE public.asset_listings
  ADD COLUMN is_zero_rated BOOLEAN NOT NULL DEFAULT false;
