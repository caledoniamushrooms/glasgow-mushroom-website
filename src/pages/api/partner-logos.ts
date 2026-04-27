export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

/** Anon client for public reads */
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

/** Service role client — bypasses RLS, used for admin writes after auth check */
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

const ALLOWED_ORIGINS = [
  'https://odin.caledoniamushrooms.co',
  'http://localhost:4321',
  'http://localhost:3000',
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
  }
  return {};
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Wrap a handler to inject CORS headers into every response */
function withCors(handler: (ctx: { request: Request }) => Promise<Response>): APIRoute {
  return async (ctx) => {
    const res = await handler(ctx);
    const cors = corsHeaders(ctx.request);
    for (const [k, v] of Object.entries(cors)) {
      res.headers.set(k, v);
    }
    return res;
  };
}

/**
 * Verify the caller is a system_admin portal user.
 * Uses the user's JWT to get their auth ID, then checks portal_users.
 */
async function verifySystemAdmin(token: string): Promise<boolean> {
  const authed = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await authed.auth.getUser(token);
  if (error || !user) return false;

  // Check portal_users via service client (bypasses RLS)
  const { data } = await serviceClient
    .from('portal_users')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('role', 'system_admin')
    .limit(1)
    .maybeSingle();

  return !!data;
}

/**
 * OPTIONS — CORS preflight
 */
export const OPTIONS: APIRoute = withCors(async () => {
  return new Response(null, { status: 204 });
});

/**
 * GET — public list of active partner logos
 */
export const GET: APIRoute = withCors(async () => {
  const { data, error } = await serviceClient
    .from('partner_logos')
    .select('id, logo_url, logo_url_dark, sort_order, customers(name, website_url)')
    .eq('active', true)
    .order('sort_order')
    .order('created_at');

  if (error) {
    return jsonResponse({ error: 'Failed to fetch logos.' }, 500);
  }

  return jsonResponse(data, 200, { 'Cache-Control': 'public, max-age=300' });
});

/**
 * POST — upload a new partner logo (system_admin only)
 *
 * Expects multipart FormData with:
 *   - file: image file (PNG, JPEG, WebP, AVIF)
 *   - name: display name for the logo
 *
 * The image is processed to white-on-transparent PNG via Sharp.
 */
export const POST: APIRoute = withCors(async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const isAdmin = await verifySystemAdmin(token);
  if (!isAdmin) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const customerId = formData.get('customer_id')?.toString().trim();

  if (!file || !customerId) {
    return jsonResponse({ error: 'File and customer are required.' }, 400);
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
  if (!allowedTypes.includes(file.type)) {
    return jsonResponse({ error: 'Only PNG, JPEG, WebP, and AVIF images are accepted.' }, 400);
  }

  // Process image: convert to white silhouette on transparent background
  const buffer = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  let processedDark: Buffer;

  try {
    // Check the ORIGINAL image for meaningful alpha before any conversion
    const originalMeta = await sharp(buffer).metadata();
    const hasRealAlpha = !!originalMeta.hasAlpha;

    // Resize, keeping alpha if present
    const resized = await sharp(buffer)
      .resize({ width: 400, withoutEnlargement: true })
      .png()
      .toBuffer();

    const meta = await sharp(resized).metadata();
    if (!meta.width || !meta.height) {
      return jsonResponse({ error: 'Could not read image dimensions.' }, 400);
    }

    // Build a single-channel alpha mask
    let alphaMask: Buffer;
    if (hasRealAlpha) {
      // Original had alpha — extract it as the mask (logo shape)
      alphaMask = await sharp(resized).extractChannel(3).toBuffer();
    } else {
      // No alpha — derive from luminance: dark content → opaque, light bg → transparent
      alphaMask = await sharp(resized).greyscale().negate().extractChannel(0).toBuffer();
    }

    // Create 3-channel white image, then join the alpha mask as the 4th channel
    const white = await sharp({
      create: {
        width: meta.width,
        height: meta.height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    let combined = await sharp(white)
      .joinChannel(alphaMask)
      .png()
      .toBuffer();

    // Trim transparent borders
    combined = await sharp(combined).trim().png().toBuffer();

    // Normalise visual weight by opaque pixel count (surface area)
    // Target: ~4000 opaque pixels — thin logos stay large, bold logos shrink
    const TARGET_SURFACE_AREA = 4000;
    const trimmedMeta = await sharp(combined).metadata();
    const rawAlpha = await sharp(combined).extractChannel(3).raw().toBuffer();
    let opaqueCount = 0;
    for (let i = 0; i < rawAlpha.length; i++) {
      if (rawAlpha[i] > 128) opaqueCount++;
    }

    if (opaqueCount > 0) {
      const scale = Math.sqrt(TARGET_SURFACE_AREA / opaqueCount);
      const newWidth = Math.round((trimmedMeta.width || 400) * scale);
      // Clamp between 80px and 400px wide
      const clampedWidth = Math.max(80, Math.min(400, newWidth));
      combined = await sharp(combined)
        .resize({ width: clampedWidth })
        .png()
        .toBuffer();
    }

    processed = combined;

    // Generate dark variant (black on transparent) by inverting RGB, keeping alpha
    const darkAlpha = await sharp(combined).extractChannel(3).toBuffer();
    const darkMeta = await sharp(combined).metadata();
    const black = await sharp({
      create: {
        width: darkMeta.width!,
        height: darkMeta.height!,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }).png().toBuffer();
    processedDark = await sharp(black).joinChannel(darkAlpha).png().toBuffer();
  } catch (err) {
    console.error('Sharp processing error:', err);
    return jsonResponse({ error: 'Failed to process image.' }, 500);
  }

  // Upload both variants to Supabase Storage
  const fileId = crypto.randomUUID();
  const lightPath = `${fileId}-light.png`;
  const darkPath = `${fileId}-dark.png`;

  const [lightUpload, darkUpload] = await Promise.all([
    serviceClient.storage.from('partner-logos').upload(lightPath, processed, { contentType: 'image/png', upsert: false }),
    serviceClient.storage.from('partner-logos').upload(darkPath, processedDark, { contentType: 'image/png', upsert: false }),
  ]);

  if (lightUpload.error || darkUpload.error) {
    // Clean up any successful uploads
    await serviceClient.storage.from('partner-logos').remove([lightPath, darkPath]);
    console.error('Storage upload error:', lightUpload.error || darkUpload.error);
    return jsonResponse({ error: 'Failed to upload logo.' }, 500);
  }

  const { data: lightUrl } = serviceClient.storage.from('partner-logos').getPublicUrl(lightPath);
  const { data: darkUrl } = serviceClient.storage.from('partner-logos').getPublicUrl(darkPath);

  // Insert record
  const { data: logo, error: insertError } = await serviceClient
    .from('partner_logos')
    .insert({
      customer_id: customerId,
      logo_url: lightUrl.publicUrl,
      logo_url_dark: darkUrl.publicUrl,
    })
    .select()
    .single();

  if (insertError) {
    await serviceClient.storage.from('partner-logos').remove([lightPath, darkPath]);
    console.error('DB insert error:', insertError);
    return jsonResponse({ error: 'Failed to save logo record.' }, 500);
  }

  return jsonResponse(logo, 201);
});
