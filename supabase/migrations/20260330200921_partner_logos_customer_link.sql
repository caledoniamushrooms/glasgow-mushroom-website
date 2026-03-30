-- =============================================================
-- Link partner_logos to customers, add website_url to customers
-- =============================================================

-- Add website URL to customers (for use on homepage showcase + Odin)
ALTER TABLE public.customers ADD COLUMN website_url TEXT;

-- Add customer_id FK to partner_logos
ALTER TABLE public.partner_logos ADD COLUMN customer_id UUID REFERENCES public.customers(id);

-- Drop the name column (now derived from customers.name via join)
ALTER TABLE public.partner_logos DROP COLUMN name;
