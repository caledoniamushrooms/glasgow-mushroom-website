export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin, serviceClient, jsonResponse } from './_lib/admin-auth';

// Admin: view-tracking analytics for the portal Activity page.
// Returns { granularity, timeseries: [{ bucket, page, listing }], ranking: [{ id, name, views }] }.
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await serviceClient.rpc('asset_view_activity');
  if (error) {
    console.error('asset_view_activity error:', error);
    return jsonResponse({ error: 'Failed to load activity.' }, 500);
  }

  return jsonResponse(data ?? { granularity: 'day', timeseries: [], ranking: [] });
};
