-- =============================================================
-- Promote Harriet Sinclair (GMC staff) to system_admin
-- =============================================================
-- Her portal_user record was created with role='admin', which gates her
-- out of the admin sidebar (Asset Register, Markets, Partner Logos) and
-- makes the page header fall back to her linked customer name ("Locavore")
-- instead of "Admin". system_admin is the correct role for GMC staff.
-- =============================================================

UPDATE public.portal_users
SET role = 'system_admin'
WHERE email = 'harriet@glasgowmushroomcompany.co.uk'
  AND role = 'admin';
