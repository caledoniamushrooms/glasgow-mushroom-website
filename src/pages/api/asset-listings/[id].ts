export const prerender = false;

import type { APIRoute } from 'astro';
import { jsonResponse, requireAdmin, serviceClient } from '../_lib/admin-auth';

export const PATCH: APIRoute = async ({ request, params }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const id = params.id;
  if (!id) return jsonResponse({ error: 'id required' }, 400);

  const body = await request.json().catch(() => null);
  if (!body) return jsonResponse({ error: 'Invalid JSON.' }, 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if ('description' in body) patch.description = body.description?.toString().trim() || null;
  if ('asking_price' in body) {
    const p = Number(body.asking_price);
    if (!Number.isFinite(p) || p < 0) return jsonResponse({ error: 'Bad asking_price' }, 400);
    patch.asking_price = p;
  }
  if ('original_cost' in body) {
    if (body.original_cost === null || body.original_cost === '' || body.original_cost === undefined) {
      patch.original_cost = null;
    } else {
      const c = Number(body.original_cost);
      if (!Number.isFinite(c) || c < 0) return jsonResponse({ error: 'Bad original_cost' }, 400);
      patch.original_cost = c;
    }
  }
  if ('category' in body) patch.category = body.category?.toString().trim() || null;
  if (typeof body.status === 'string' && ['available', 'under_offer', 'sold'].includes(body.status)) {
    patch.status = body.status;
  }
  if ('allow_offers' in body) patch.allow_offers = body.allow_offers === true;
  if ('is_poa' in body) patch.is_poa = body.is_poa === true;
  if ('is_zero_rated' in body) patch.is_zero_rated = body.is_zero_rated === true;
  if ('sort_order' in body && Number.isFinite(Number(body.sort_order))) {
    patch.sort_order = Number(body.sort_order);
  }

  if (Object.keys(patch).length === 0) return jsonResponse({ error: 'No updates.' }, 400);

  const { data, error } = await serviceClient
    .from('asset_listings')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Update listing error:', error);
    return jsonResponse({ error: 'Failed to update listing.' }, 500);
  }
  return jsonResponse(data);
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const id = params.id;
  if (!id) return jsonResponse({ error: 'id required' }, 400);

  // Get all image paths so we can purge storage after the row goes
  const { data: images } = await serviceClient
    .from('asset_listing_images')
    .select('storage_path')
    .eq('listing_id', id);

  const paths = (images ?? []).map((r) => r.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await serviceClient.storage.from('asset-images').remove(paths);
  }

  const { error } = await serviceClient.from('asset_listings').delete().eq('id', id);
  if (error) {
    console.error('Delete listing error:', error);
    return jsonResponse({ error: 'Failed to delete listing.' }, 500);
  }
  return jsonResponse({ success: true });
};
