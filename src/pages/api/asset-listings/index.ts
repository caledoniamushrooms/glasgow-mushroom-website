export const prerender = false;

import type { APIRoute } from 'astro';
import { jsonResponse, requireAdmin, serviceClient } from '../_lib/admin-auth';

// Admin: full listing data — original_cost / internal_notes are excluded
// from the anon+authenticated REST roles by column grants, so the portal
// reads through this service-role endpoint instead of querying directly.
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const [listingsRes, statsRes] = await Promise.all([
    serviceClient
      .from('asset_listings')
      .select('*, asset_listing_images(*)')
      .order('sort_order')
      .order('created_at', { ascending: false }),
    serviceClient.rpc('asset_view_stats'),
  ]);

  if (listingsRes.error) {
    console.error('List listings error:', listingsRes.error);
    return jsonResponse({ error: 'Failed to load listings.' }, 500);
  }
  if (statsRes.error) console.error('View stats error:', statsRes.error);

  return jsonResponse({
    listings: listingsRes.data ?? [],
    stats: statsRes.data ?? { page_views_total: 0, page_views_7d: 0, listing_views: {} },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return jsonResponse({ error: 'Invalid JSON.' }, 400);

  const name = String(body.name ?? '').trim();
  if (!name) return jsonResponse({ error: 'Name is required.' }, 400);

  // Blank asking price = TBD (NULL). An explicit 0 = Free.
  let askingPrice: number | null = null;
  if (body.asking_price !== null && body.asking_price !== undefined && body.asking_price !== '') {
    const p = Number(body.asking_price);
    if (!Number.isFinite(p) || p < 0) {
      return jsonResponse({ error: 'Asking price must be a non-negative number.' }, 400);
    }
    askingPrice = p;
  }

  let originalCost: number | null = null;
  if (body.original_cost !== null && body.original_cost !== undefined && body.original_cost !== '') {
    const c = Number(body.original_cost);
    if (!Number.isFinite(c) || c < 0) {
      return jsonResponse({ error: 'Original cost must be a non-negative number.' }, 400);
    }
    originalCost = c;
  }

  const status = ['available', 'under_offer', 'sold'].includes(body.status) ? body.status : 'available';

  const { data, error } = await serviceClient
    .from('asset_listings')
    .insert({
      name,
      description: body.description?.toString().trim() || null,
      internal_notes: body.internal_notes?.toString().trim() || null,
      asking_price: askingPrice,
      original_cost: originalCost,
      category: body.category?.toString().trim() || null,
      status,
      allow_offers: body.allow_offers === true,
      is_poa: body.is_poa === true,
      is_zero_rated: body.is_zero_rated === true,
      is_hidden: body.is_hidden === true,
      sold_price_inc_vat:
        body.sold_price_inc_vat === null || body.sold_price_inc_vat === undefined || body.sold_price_inc_vat === ''
          ? null
          : Number(body.sold_price_inc_vat),
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Insert listing error:', error);
    return jsonResponse({ error: 'Failed to create listing.' }, 500);
  }
  return jsonResponse(data, 201);
};
