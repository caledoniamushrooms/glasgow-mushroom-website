export const prerender = false;

import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { jsonResponse, requireAdmin, serviceClient } from '../../_lib/admin-auth';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

export const POST: APIRoute = async ({ request, params }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const listingId = params.id;
  if (!listingId) return jsonResponse({ error: 'id required' }, 400);

  // Confirm listing exists
  const { data: listing } = await serviceClient
    .from('asset_listings')
    .select('id')
    .eq('id', listingId)
    .maybeSingle();
  if (!listing) return jsonResponse({ error: 'Listing not found.' }, 404);

  const formData = await request.formData();
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return jsonResponse({ error: 'No files supplied.' }, 400);

  // Current max position to append after
  const { data: existing } = await serviceClient
    .from('asset_listing_images')
    .select('position')
    .eq('listing_id', listingId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextPos = (existing?.position ?? -1) + 1;

  const inserted: unknown[] = [];

  for (const file of files) {
    if (!ALLOWED.includes(file.type)) {
      return jsonResponse({ error: `Unsupported file type: ${file.type}` }, 400);
    }
    let processed: Buffer;
    try {
      processed = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate() // honour EXIF orientation
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
    } catch (err) {
      console.error('Sharp error:', err);
      return jsonResponse({ error: 'Failed to process image.' }, 500);
    }

    const fileId = crypto.randomUUID();
    const path = `${listingId}/${fileId}.jpg`;

    const upload = await serviceClient.storage
      .from('asset-images')
      .upload(path, processed, { contentType: 'image/jpeg', upsert: false });
    if (upload.error) {
      console.error('Storage upload error:', upload.error);
      return jsonResponse({ error: 'Failed to upload image.' }, 500);
    }

    const { data, error } = await serviceClient
      .from('asset_listing_images')
      .insert({ listing_id: listingId, storage_path: path, position: nextPos })
      .select()
      .single();
    if (error) {
      await serviceClient.storage.from('asset-images').remove([path]);
      console.error('Image insert error:', error);
      return jsonResponse({ error: 'Failed to save image record.' }, 500);
    }
    inserted.push(data);
    nextPos += 1;
  }

  return jsonResponse(inserted, 201);
};

export const PATCH: APIRoute = async ({ request, params }) => {
  // Reorder: PATCH /api/asset-listings/[id]/images with body { order: [imageId, ...] }
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const listingId = params.id;
  if (!listingId) return jsonResponse({ error: 'id required' }, 400);

  const body = await request.json().catch(() => null);
  const order = Array.isArray(body?.order) ? (body.order as string[]) : null;
  if (!order) return jsonResponse({ error: 'order array required' }, 400);

  // Update each row's position
  await Promise.all(
    order.map((imageId, idx) =>
      serviceClient
        .from('asset_listing_images')
        .update({ position: idx })
        .eq('id', imageId)
        .eq('listing_id', listingId),
    ),
  );

  return jsonResponse({ success: true });
};
