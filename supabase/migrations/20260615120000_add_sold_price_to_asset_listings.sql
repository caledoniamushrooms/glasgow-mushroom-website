-- Captures the actual gross (VAT-inclusive) price the asset sold for.
-- Independent of asking_price (which stays ex-VAT) so reporting can compare
-- the two. NULL = not yet recorded / historical sale.
ALTER TABLE public.asset_listings
  ADD COLUMN IF NOT EXISTS sold_price_inc_vat NUMERIC(12, 2);

-- Column-level grants: matches the original_cost/internal_notes pattern —
-- only the service role (admin endpoints) can read the realised sale price.
REVOKE SELECT (sold_price_inc_vat) ON public.asset_listings FROM anon, authenticated;
