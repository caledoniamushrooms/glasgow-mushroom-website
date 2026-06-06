export const prerender = false;

import type { APIRoute } from 'astro';
import { jsonResponse, requireAdmin, serviceClient } from '../_lib/admin-auth';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return jsonResponse({ error: 'Invalid JSON.' }, 400);

  const name = String(body.name ?? '').trim();
  const askingPrice = Number(body.asking_price);
  if (!name) return jsonResponse({ error: 'Name is required.' }, 400);
  if (!Number.isFinite(askingPrice) || askingPrice < 0) {
    return jsonResponse({ error: 'Asking price must be a positive number.' }, 400);
  }

  const status = ['available', 'reserved', 'sold'].includes(body.status) ? body.status : 'available';

  const { data, error } = await serviceClient
    .from('asset_listings')
    .insert({
      name,
      description: body.description?.toString().trim() || null,
      asking_price: askingPrice,
      category: body.category?.toString().trim() || null,
      status,
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
