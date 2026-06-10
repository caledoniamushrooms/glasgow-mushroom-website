# Asset Register Tune-Up — Implementation Plan (2026-06-10)

Full review of the asset register (public `/equipment-sale` + portal admin) found live data
issues, two broken interactions, and a set of robustness gaps. Agreed scope:

## Pricing model (D1)

`asking_price` becomes nullable-by-meaning (column already nullable on remote):

- `is_poa = true` → **POA**
- `asking_price` set → price (explicit `0` → **Free**)
- `asking_price IS NULL` (default) → **TBD**

Data migration sets the 43 unpriced `£0` rows to `NULL`. Admin gets a TBD filter tab +
badge; the asking price input becomes optional (blank = TBD) with a warning when an
explicit `£0` would publish as "Free".

## Data hygiene (D2/D3)

- New `internal_notes` column; the 14+ public descriptions holding internal cost-audit
  notes ("Cost unknown — likely Amazon sub-£200…") move there; admin dialog gains the field.
- Orphaned remote migration `20260609130000` (added `needs_pricing_review`, dropped
  NOT NULL on asking_price) gets its file reconstructed in Odin; the unused column is
  dropped — TBD state is derived from `asking_price IS NULL` instead.

## Bug fixes

- **Public, P1**: typing an offer on an unselected item discarded every keystroke
  (double state-update in `setOffer` + `toggleSelected`). Setting an offer now selects.
- **Admin, A1**: dialog state only reset when `initial.id` changed — "New listing" after a
  create silently re-edited the previous listing; cancelled edits reappeared. Reset on open.
- **Admin, A2**: hooks declared after a conditional return (crash landmine) — hoisted.
- P2 zero-rated price display, P3 cart not cleared on backdrop-close after send,
  P4 client-side offer validation, P5 penny rounding + consistent GBP formatting,
  P6 SSR error state, P7 Escape/scroll-lock/aria polish.
- A3 chunked image uploads (Vercel 4.5 MB limit), A4 surfaced delete/reorder errors,
  A5 PATCH validation (empty name, non-UUID ids), A7 inc-VAT figures in notification email.

## Security (S1 — full fix)

- Admin list moves to `GET /api/asset-listings` (service role).
- Column-level grants: `original_cost` + `internal_notes` revoked from `anon` and
  `authenticated`; public page already selects explicit columns.

## New features

- **Interest submissions list** (read-only card on admin page, via `GET /api/asset-interest`).
- **View tracking**: `asset_page_views` table; client beacons for main-page views and
  per-listing detail opens (deduped per page load, no PII); admin shows page totals
  (all-time / 7 days) and per-listing view counts.

## Delivery

Code (this branch) → review → merge/deploy → then `supabase db push` **from Odin**
(all shared-DB migrations are authored in Odin by agreement) → live verification.
