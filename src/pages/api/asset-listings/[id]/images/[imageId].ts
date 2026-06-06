export const prerender = false;

import type { APIRoute } from 'astro';
import { jsonResponse, requireAdmin, serviceClient } from '../../../_lib/admin-auth';

export const DELETE: APIRoute = async ({ request, params }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id: listingId, imageId } = params;
  if (!listingId || !imageId) return jsonResponse({ error: 'ids required' }, 400);

  const { data: image } = await serviceClient
    .from('asset_listing_images')
    .select('storage_path')
    .eq('id', imageId)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (image?.storage_path) {
    await serviceClient.storage.from('asset-images').remove([image.storage_path]);
  }

  const { error } = await serviceClient
    .from('asset_listing_images')
    .delete()
    .eq('id', imageId)
    .eq('listing_id', listingId);

  if (error) {
    console.error('Delete image error:', error);
    return jsonResponse({ error: 'Failed to delete image.' }, 500);
  }
  return jsonResponse({ success: true });
};
