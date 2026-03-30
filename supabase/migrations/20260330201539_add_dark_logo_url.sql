-- Add dark variant URL for Odin (dark on transparent, for white backgrounds)
ALTER TABLE public.partner_logos ADD COLUMN logo_url_dark TEXT;
