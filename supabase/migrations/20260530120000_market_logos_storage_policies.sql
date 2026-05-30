-- =============================================================
-- market-logos storage bucket: write policies
-- =============================================================
-- The `market-logos` bucket was created via the Supabase dashboard
-- with only a public SELECT policy. Uploads from the portal were
-- silently blocked by RLS (no INSERT/UPDATE/DELETE policies).
--
-- Mirror the access model on public.market_locations: system_admin
-- portal users (used by the GMC portal) OR Odin staff (JWT-based).
-- =============================================================

CREATE POLICY "system_admin_or_staff_insert_market_logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'market-logos'
    AND (public.is_system_admin() OR public.is_staff())
  );

CREATE POLICY "system_admin_or_staff_update_market_logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'market-logos'
    AND (public.is_system_admin() OR public.is_staff())
  )
  WITH CHECK (
    bucket_id = 'market-logos'
    AND (public.is_system_admin() OR public.is_staff())
  );

CREATE POLICY "system_admin_or_staff_delete_market_logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'market-logos'
    AND (public.is_system_admin() OR public.is_staff())
  );
