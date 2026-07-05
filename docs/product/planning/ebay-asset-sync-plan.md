# eBay Asset Sync — Implementation Plan

**Date:** 2026-07-05
**Branches:** `feature/ebay-asset-sync` (gmc-website + Odin)
**Status:** Approved, in progress

## Goal

List available asset-register items on eBay programmatically and keep sold/available
status in sync in both directions:

- Admin ticks "List on eBay" → listing is created (or re-created) on eBay.
- Item marked sold locally (non-eBay buyer) or checkbox unticked → eBay listing ended.
- Item sells on eBay → local listing marked `sold` with `sold_price_inc_vat` from the order.

## Decisions (agreed 2026-07-05)

1. **eBay account:** new business seller account (Glasgow Mushroom Company) — none existed.
   Developer account registered via browser session with hendrik@glasgowmushroomcompany.co.uk.
2. **Pricing:** eBay price = local inc-VAT price plus an uplift to cover eBay fees
   (default 15%, per-listing `ebay_markup_pct` column). Direct buyers always get the
   better price on glasgowmushroom.co.
3. **Scope:** only items with a concrete `asking_price` (> 0 or free excluded too — must
   be > 0), not POA, not TBD. The checkbox is disabled otherwise. `allow_offers` maps to
   eBay Best Offer where enabled.
4. **API:** eBay Sell APIs (Inventory API for listings, Fulfillment API for order
   polling, Account API for one-time business-policy setup). Sandbox first.
5. **Fulfilment:** single collection-only fulfilment policy (no shipping complexity for
   farm equipment). Condition defaults to USED_GOOD.

## Architecture

All app code lives in **gmc-website** (consistent with existing `/api/asset-listings/*`
service-role endpoints). Schema migration ships via **Odin** repo (owns migrations for
the shared Supabase DB).

### Schema (Odin migration `20260705*_asset_listings_ebay_sync.sql`)

`asset_listings` additions (no column grants to anon/authenticated — admin reads via
service role; public page selects explicit columns):

- `list_on_ebay boolean NOT NULL DEFAULT false`
- `ebay_markup_pct numeric(5,2) NOT NULL DEFAULT 15.00`
- `ebay_offer_id text`, `ebay_listing_id text`, `ebay_order_id text`
- `ebay_sync_status text` CHECK in (`pending`,`listed`,`ended`,`error`)
- `ebay_sync_error text`, `ebay_synced_at timestamptz`

New `ebay_tokens` table (RLS enabled, no policies — service-role only): stores OAuth
refresh/access tokens per environment (sandbox/production). App keyset (client ID/secret)
lives in Vercel env / Doppler, never in the DB.

### Sync flow (gmc-website API routes)

- `PATCH /api/asset-listings/{id}` extended: transitions on `list_on_ebay` / `status`
  trigger eBay calls (create inventory item + offer + publish; or withdraw offer).
  SKU = listing UUID. Images passed as public storage URLs.
- `GET /api/ebay/oauth/callback` — one-time seller consent flow, stores refresh token.
- `POST /api/ebay/poll-orders` (Vercel cron, ~15 min) — Fulfillment API `getOrders`,
  match line-item SKU → listing UUID, mark sold + capture price, idempotent.

### Admin UI (`AssetRegister.tsx` ListingDialog)

- "List on eBay" checkbox (disabled unless status=available and asking_price > 0)
- Markup % field shown when ticked; eBay status badge + error surface on register rows.

## Phases

1. ✅ Developer account registration (browser agent + Hendrik)
2. Schema migration + db push
3. eBay client module (OAuth, token refresh, Inventory/Account/Fulfillment wrappers)
   against sandbox
4. Business-policy bootstrap (one-time script/route): payment, return (no returns),
   collection-only fulfilment
5. Listing sync on PATCH + admin UI checkbox
6. Order poller cron
7. Production cutover: prod keyset, seller consent, relist real items

## Risks / notes

- Production keyset approval for Sell APIs may take days — requested early.
- eBay category ID resolved per listing via Taxonomy `getCategorySuggestions` from the
  item name; store nothing, resolve at publish time, fail soft to error status.
- Refresh token ~18 months validity — fine for wind-down horizon.
- Never call eBay from the public site path; all server-side, service-role.
