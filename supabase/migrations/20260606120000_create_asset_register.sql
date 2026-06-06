-- =============================================================
-- Asset register: tables, public storage bucket, RLS policies
-- =============================================================
-- Public-facing register of equipment / assets for sale during
-- the GMC wind-down. Admin manages listings + images from the
-- portal; the public browse page is /equipment-sale.
-- =============================================================

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------
CREATE TABLE public.asset_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  asking_price NUMERIC(10,2) NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'sold')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.asset_listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.asset_listings(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_listing_images_listing ON public.asset_listing_images(listing_id, position);

CREATE TABLE public.asset_listing_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.asset_listings(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  collection_preference TEXT
    CHECK (collection_preference IN ('collection', 'delivery', 'either') OR collection_preference IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_listing_interest_listing ON public.asset_listing_interest(listing_id, created_at DESC);

-- updated_at trigger for asset_listings
CREATE OR REPLACE FUNCTION public.asset_listings_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_asset_listings_updated_at
  BEFORE UPDATE ON public.asset_listings
  FOR EACH ROW EXECUTE FUNCTION public.asset_listings_set_updated_at();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE public.asset_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_listing_interest ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see listings + images (sold filter is client-side)
CREATE POLICY "anon_read_asset_listings"
  ON public.asset_listings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_read_asset_listing_images"
  ON public.asset_listing_images FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff writes on listings
CREATE POLICY "staff_insert_asset_listings"
  ON public.asset_listings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_update_asset_listings"
  ON public.asset_listings FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_asset_listings"
  ON public.asset_listings FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- Staff writes on images
CREATE POLICY "staff_insert_asset_images"
  ON public.asset_listing_images FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_update_asset_images"
  ON public.asset_listing_images FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_asset_images"
  ON public.asset_listing_images FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- Interest: anon INSERT allowed (server-side endpoint uses service role anyway, but
-- this also permits direct anon writes if we ever need a no-edge-function path).
-- SELECT staff-only.
CREATE POLICY "anon_insert_asset_interest"
  ON public.asset_listing_interest FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "staff_read_asset_interest"
  ON public.asset_listing_interest FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "staff_delete_asset_interest"
  ON public.asset_listing_interest FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- ---------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-images', 'asset-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_asset_images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'asset-images');

CREATE POLICY "staff_upload_asset_images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'asset-images' AND public.is_staff());

CREATE POLICY "staff_delete_asset_images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'asset-images' AND public.is_staff());
