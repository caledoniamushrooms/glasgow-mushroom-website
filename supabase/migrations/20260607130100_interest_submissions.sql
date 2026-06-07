-- =============================================================
-- Asset register: multi-item interest submissions
-- =============================================================
-- Replaces the single-row asset_listing_interest table with a
-- parent submission + per-item children. Each submission can cover
-- many items and carry an optional offer value per item (used when
-- the listing has allow_offers = true).
-- asset_listing_interest currently has zero rows (checked before
-- writing this migration), so we drop it outright.
-- =============================================================

CREATE TABLE public.interest_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  collection_preference TEXT
    CHECK (collection_preference IN ('collection', 'delivery', 'either') OR collection_preference IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.interest_submission_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.interest_submissions(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.asset_listings(id) ON DELETE SET NULL,
  offer_value NUMERIC(10,2) CHECK (offer_value IS NULL OR offer_value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interest_submissions_created
  ON public.interest_submissions(created_at DESC);

CREATE INDEX idx_interest_submission_items_submission
  ON public.interest_submission_items(submission_id);

CREATE INDEX idx_interest_submission_items_listing
  ON public.interest_submission_items(listing_id, created_at DESC);

-- ---------------------------------------------------------------
-- RLS — mirrors the existing asset_listing_interest policies.
-- Anon can INSERT (server-side endpoint uses the service role
-- anyway, but this keeps a direct anon path open if needed). Only
-- staff can read or delete.
-- ---------------------------------------------------------------
ALTER TABLE public.interest_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_submission_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_interest_submissions"
  ON public.interest_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "staff_read_interest_submissions"
  ON public.interest_submissions FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "staff_delete_interest_submissions"
  ON public.interest_submissions FOR DELETE
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "anon_insert_interest_submission_items"
  ON public.interest_submission_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "staff_read_interest_submission_items"
  ON public.interest_submission_items FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "staff_delete_interest_submission_items"
  ON public.interest_submission_items FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- ---------------------------------------------------------------
-- Drop the legacy single-item table (verified 0 rows).
-- ---------------------------------------------------------------
DROP TABLE public.asset_listing_interest;
