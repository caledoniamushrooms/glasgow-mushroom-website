export const prerender = false;

import type { APIRoute } from 'astro';
import { jsonResponse, requireAdmin, serviceClient } from '../_lib/admin-auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PATCH: APIRoute = async ({ request, params }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const id = params.id;
  if (!id || !UUID_RE.test(id)) return jsonResponse({ error: 'Invalid listing id.' }, 400);

  const body = await request.json().catch(() => null);
  if (!body) return jsonResponse({ error: 'Invalid JSON.' }, 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return jsonResponse({ error: 'Name is required.' }, 400);
    patch.name = name;
  }
  if ('description' in body) patch.description = body.description?.toString().trim() || null;
  if ('internal_notes' in body) patch.internal_notes = body.internal_notes?.toString().trim() || null;
  if ('asking_price' in body) {
    // Blank/null = TBD. An explicit 0 = Free.
    if (body.asking_price === null || body.asking_price === '' || body.asking_price === undefined) {
      patch.asking_price = null;
    } else {
      const p = Number(body.asking_price);
      if (!Number.isFinite(p) || p < 0) return jsonResponse({ error: 'Bad asking_price' }, 400);
      patch.asking_price = p;
    }
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
  if (!id || !UUID_RE.test(id)) return jsonResponse({ error: 'Invalid listing id.' }, 400);

  // Capture image paths first, but delete the row BEFORE purging storage:
  // if the row delete fails nothing is lost, and orphaned storage files
  // are harmless compared to live rows pointing at deleted images.
  const { data: images } = await serviceClient
    .from('asset_listing_images')
    .select('storage_path')
    .eq('listing_id', id);

  const { error } = await serviceClient.from('asset_listings').delete().eq('id', id);
  if (error) {
    console.error('Delete listing error:', error);
    return jsonResponse({ error: 'Failed to delete listing.' }, 500);
  }

  const paths = (images ?? []).map((r) => r.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await serviceClient.storage.from('asset-images').remove(paths);
    if (storageError) console.error('Storage purge error:', storageError);
  }

  return jsonResponse({ success: true });
};
