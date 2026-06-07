-- =============================================================
-- Asset register: allow_offers + is_poa toggles
-- =============================================================
-- allow_offers: admin opts the item into the public "Make an offer"
-- flow (a £ input appears alongside the row checkbox).
-- is_poa: hides the asking price in favour of "POA". Combined with
-- allow_offers the visitor can submit an offer without a quoted
-- price. The Free filter excludes POA items.
-- =============================================================

ALTER TABLE public.asset_listings
  ADD COLUMN allow_offers BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_poa BOOLEAN NOT NULL DEFAULT false;
