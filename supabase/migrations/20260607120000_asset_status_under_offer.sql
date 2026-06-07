-- =============================================================
-- Asset register: replace 'reserved' status with 'under_offer'
-- =============================================================
-- We renamed the intermediate state. Drop the old CHECK, convert
-- any pre-existing rows, add the new CHECK. The API endpoints
-- already validate against the new value list.
-- =============================================================

UPDATE public.asset_listings
SET status = 'under_offer'
WHERE status = 'reserved';

ALTER TABLE public.asset_listings
  DROP CONSTRAINT asset_listings_status_check;

ALTER TABLE public.asset_listings
  ADD CONSTRAINT asset_listings_status_check
  CHECK (status IN ('available', 'under_offer', 'sold'));
