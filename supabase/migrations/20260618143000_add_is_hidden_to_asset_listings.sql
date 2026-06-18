-- =============================================================
-- Asset register: hide a listing from the public page
-- =============================================================
-- Adds is_hidden to asset_listings. Tightens the public read RLS
-- policy so anon + authenticated can only see non-hidden rows.
-- Admins read hidden rows through the service-role API endpoint,
-- which bypasses RLS, so the admin table still shows everything.
-- =============================================================

ALTER TABLE public.asset_listings
  ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "anon_read_asset_listings" ON public.asset_listings;

CREATE POLICY "anon_read_asset_listings"
  ON public.asset_listings FOR SELECT
  TO anon, authenticated
  USING (is_hidden = false);
