-- =============================================================
-- Market locations + events tables
-- =============================================================
-- Replaces the hardcoded src/data/markets.js with a Supabase-backed
-- model. market_locations holds venues; market_events holds dates.
-- Public read for the website, write gated to system_admin portal users.
-- =============================================================

-- Helper: check if the current user is a system_admin portal user
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE auth_user_id = auth.uid()
    AND role = 'system_admin'
    AND status = 'active'
  )
$$;


-- =============================================================
-- 1. MARKET_LOCATIONS
-- =============================================================
CREATE TABLE public.market_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  google_maps_url TEXT,
  logo_url TEXT,
  type TEXT NOT NULL DEFAULT 'market',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_locations ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public website needs this)
CREATE POLICY "anyone_read_market_locations"
  ON public.market_locations FOR SELECT
  TO anon, authenticated
  USING (true);

-- System admins can manage
CREATE POLICY "system_admin_manage_market_locations"
  ON public.market_locations FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- Staff (Odin) can also manage
CREATE POLICY "staff_manage_market_locations"
  ON public.market_locations FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- =============================================================
-- 2. MARKET_EVENTS
-- =============================================================
CREATE TABLE public.market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_location_id UUID NOT NULL REFERENCES public.market_locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_events_date ON public.market_events(date);

ALTER TABLE public.market_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "anyone_read_market_events"
  ON public.market_events FOR SELECT
  TO anon, authenticated
  USING (true);

-- System admins can manage
CREATE POLICY "system_admin_manage_market_events"
  ON public.market_events FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- Staff (Odin) can also manage
CREATE POLICY "staff_manage_market_events"
  ON public.market_events FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- =============================================================
-- 3. SEED DATA — existing Railyard events
-- =============================================================
INSERT INTO public.market_locations (id, name, address, google_maps_url, logo_url, type)
VALUES (
  gen_random_uuid(),
  'The Railyard',
  'S Woodside Rd, Glasgow G4 9HF',
  'https://www.google.com/maps/search/?api=1&query=S+Woodside+Rd+Glasgow+G4+9HF',
  '/images/markets/the-railyard-logo.png',
  'market'
);

WITH ry AS (SELECT id FROM public.market_locations WHERE name = 'The Railyard' LIMIT 1)
INSERT INTO public.market_events (market_location_id, date, start_time, end_time)
SELECT ry.id, d.date, '10:00'::TIME, '15:00'::TIME
FROM ry, (VALUES
  ('2026-03-28'::DATE),
  ('2026-04-25'::DATE),
  ('2026-05-30'::DATE),
  ('2026-06-27'::DATE),
  ('2026-08-01'::DATE),
  ('2026-08-29'::DATE),
  ('2026-10-03'::DATE)
) AS d(date);
