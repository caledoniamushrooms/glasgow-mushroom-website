import { serviceClient } from '../admin-auth';
import { ebayFetch, EbayError } from './client';
import { CATEGORY_TREE_ID, MARKETPLACE_ID } from './config';
import { ensureSellerPolicies } from './policies';

const SUPABASE_URL: string = import.meta.env.PUBLIC_SUPABASE_URL ?? import.meta.env.SUPABASE_URL ?? '';

type ListingRow = {
  id: string;
  name: string;
  description: string | null;
  asking_price: number | null;
  is_poa: boolean;
  is_zero_rated: boolean;
  status: string;
  allow_offers: boolean;
  ebay_markup_pct: number;
  ebay_offer_id: string | null;
  ebay_listing_id: string | null;
};

export function ebayEligibility(l: {
  status: string;
  asking_price: number | null;
  is_poa: boolean;
}): string | null {
  if (l.status !== 'available') return 'Only available items can be listed on eBay.';
  if (l.is_poa) return 'POA items cannot be listed on eBay — set a concrete asking price first.';
  if (!l.asking_price || l.asking_price <= 0) {
    return 'Item needs an asking price greater than zero to list on eBay.';
  }
  return null;
}

/** Local inc-VAT price plus the fee-cover markup, rounded to 2dp. */
export function computeEbayPrice(l: {
  asking_price: number | null;
  is_zero_rated: boolean;
  ebay_markup_pct: number;
}): number {
  const incVat = (l.asking_price ?? 0) * (l.is_zero_rated ? 1 : 1.2);
  return Math.round(incVat * (1 + (l.ebay_markup_pct ?? 0) / 100) * 100) / 100;
}

async function suggestCategoryId(title: string): Promise<string> {
  const res = await ebayFetch<{
    categorySuggestions?: Array<{ category: { categoryId: string } }>;
  }>(
    `/commerce/taxonomy/v1/category_tree/${CATEGORY_TREE_ID}/get_category_suggestions?q=${encodeURIComponent(title)}`
  );
  const first = res.categorySuggestions?.[0]?.category?.categoryId;
  if (!first) throw new Error(`No eBay category suggestion for "${title}".`);
  return first;
}

async function loadListing(listingId: string): Promise<{ row: ListingRow; imageUrls: string[] }> {
  const { data: row, error } = await serviceClient
    .from('asset_listings')
    .select(
      'id, name, description, asking_price, is_poa, is_zero_rated, status, allow_offers, ebay_markup_pct, ebay_offer_id, ebay_listing_id'
    )
    .eq('id', listingId)
    .single();
  if (error || !row) throw new Error(`Listing ${listingId} not found.`);

  const { data: images } = await serviceClient
    .from('asset_listing_images')
    .select('storage_path')
    .eq('listing_id', listingId)
    .order('position');
  const imageUrls = (images ?? [])
    .map((i) => `${SUPABASE_URL}/storage/v1/object/public/asset-images/${i.storage_path}`)
    .slice(0, 24); // eBay max

  return { row: row as ListingRow, imageUrls };
}

async function setSyncState(
  listingId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const { error } = await serviceClient
    .from('asset_listings')
    .update({ ...fields, ebay_synced_at: new Date().toISOString() })
    .eq('id', listingId);
  if (error) console.error('Failed to record eBay sync state:', error);
}

/**
 * Create/update + publish the eBay listing for an asset. SKU = listing UUID.
 * Records outcome on the row (ebay_sync_status listed|error).
 */
export async function syncListingToEbay(listingId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { row, imageUrls } = await loadListing(listingId);
    const ineligible = ebayEligibility(row);
    if (ineligible) throw new Error(ineligible);
    if (imageUrls.length === 0) throw new Error('eBay requires at least one photo.');

    const policies = await ensureSellerPolicies();
    const sku = row.id;

    await ebayFetch(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: 'PUT',
      body: {
        product: {
          title: row.name.slice(0, 80),
          description: row.description || row.name,
          imageUrls,
          // Most categories require Brand; used farm kit rarely has a meaningful one.
          aspects: { Brand: ['Unbranded'] },
        },
        condition: 'USED_GOOD',
        availability: { shipToLocationAvailability: { quantity: 1 } },
      },
    });

    const categoryId = await suggestCategoryId(row.name);
    const offerBody = {
      sku,
      marketplaceId: MARKETPLACE_ID,
      format: 'FIXED_PRICE',
      availableQuantity: 1,
      categoryId,
      listingDescription: row.description || row.name,
      merchantLocationKey: policies.merchantLocationKey,
      pricingSummary: {
        price: { value: computeEbayPrice(row).toFixed(2), currency: 'GBP' },
      },
      listingPolicies: {
        paymentPolicyId: policies.paymentPolicyId,
        returnPolicyId: policies.returnPolicyId,
        fulfillmentPolicyId: policies.fulfillmentPolicyId,
        bestOfferTerms: { bestOfferEnabled: row.allow_offers },
      },
    };

    // Reuse an existing offer for this SKU if eBay has one; otherwise create.
    let offerId = row.ebay_offer_id;
    const existing = await ebayFetch<{ offers?: Array<{ offerId: string; status: string }> }>(
      `/sell/inventory/v1/offer?sku=${sku}&marketplace_id=${MARKETPLACE_ID}`
    ).catch((e) => {
      if (e instanceof EbayError && e.status === 404) return { offers: [] };
      throw e;
    });
    const found = existing.offers?.[0];
    if (found) {
      offerId = found.offerId;
      await ebayFetch(`/sell/inventory/v1/offer/${offerId}`, { method: 'PUT', body: offerBody });
    } else {
      const created = await ebayFetch<{ offerId: string }>('/sell/inventory/v1/offer', {
        method: 'POST',
        body: offerBody,
      });
      offerId = created.offerId;
    }

    const published = await ebayFetch<{ listingId: string }>(
      `/sell/inventory/v1/offer/${offerId}/publish`,
      { method: 'POST' }
    );

    await setSyncState(listingId, {
      ebay_offer_id: offerId,
      ebay_listing_id: published.listingId,
      ebay_sync_status: 'listed',
      ebay_sync_error: null,
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await setSyncState(listingId, { ebay_sync_status: 'error', ebay_sync_error: message });
    return { ok: false, error: message };
  }
}

/** End the live eBay listing (item sold locally, hidden, or checkbox unticked). */
export async function endEbayListing(listingId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: row } = await serviceClient
      .from('asset_listings')
      .select('ebay_offer_id, ebay_sync_status')
      .eq('id', listingId)
      .single();
    if (!row?.ebay_offer_id || row.ebay_sync_status !== 'listed') return { ok: true };

    try {
      await ebayFetch(`/sell/inventory/v1/offer/${row.ebay_offer_id}/withdraw`, { method: 'POST' });
    } catch (e) {
      // Already ended on eBay's side (e.g. it just sold there) is success for our purposes.
      if (!(e instanceof EbayError && e.status < 500)) throw e;
    }

    await setSyncState(listingId, { ebay_sync_status: 'ended', ebay_sync_error: null });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await setSyncState(listingId, { ebay_sync_status: 'error', ebay_sync_error: message });
    return { ok: false, error: message };
  }
}
