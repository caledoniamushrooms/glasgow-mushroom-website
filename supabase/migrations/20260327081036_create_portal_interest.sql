create table public.portal_interest (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  company_name text not null,
  email        text not null,
  created_at   timestamptz not null default now()
);

alter table public.portal_interest enable row level security;

create policy "Allow anonymous inserts"
  on public.portal_interest
  for insert
  to anon
  with check (true);
