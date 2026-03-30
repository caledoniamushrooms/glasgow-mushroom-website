-- =============================================================
-- Partner logos: table, public storage bucket, and RLS policies
-- =============================================================
-- Used for the homepage "business showcase" section.
-- Admin uploads logos via the portal; they're processed to
-- white-on-transparent PNGs and stored in Supabase Storage.
-- The homepage fetches active logos via a public API route.
-- =============================================================

-- Table
CREATE TABLE public.partner_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.partner_logos ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read active logos (needed for homepage)
CREATE POLICY "anon_read_active_logos"
  ON public.partner_logos FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Staff: can read ALL logos (including inactive, for admin page)
CREATE POLICY "staff_read_all_logos"
  ON public.partner_logos FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Staff: full write access
CREATE POLICY "staff_insert_logos"
  ON public.partner_logos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_update_logos"
  ON public.partner_logos FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_logos"
  ON public.partner_logos FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- Storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-logos', 'partner-logos', true);

-- Storage policies
CREATE POLICY "public_read_partner_logos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'partner-logos');

CREATE POLICY "staff_upload_partner_logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'partner-logos' AND public.is_staff());

CREATE POLICY "staff_delete_partner_logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'partner-logos' AND public.is_staff());
