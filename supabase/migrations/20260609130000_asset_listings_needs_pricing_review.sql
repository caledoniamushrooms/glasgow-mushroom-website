-- Add a flag so staff can register an asset without yet knowing what to
-- charge for it. Flagged rows are hidden from the public for-sale page so
-- another reviewer can set a price before it goes live.
ALTER TABLE public.asset_listings
  ADD COLUMN needs_pricing_review BOOLEAN NOT NULL DEFAULT FALSE;

-- Asking price becomes optional: when needs_pricing_review is true there is
-- no meaningful price yet, and we'd rather store NULL than a placeholder 0.
ALTER TABLE public.asset_listings
  ALTER COLUMN asking_price DROP NOT NULL;
