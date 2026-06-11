export const prerender = false;

import type { APIRoute } from 'astro';
import { serviceClient } from './_lib/admin-auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generous per-IP cap — this only needs to stop floods, not real visitors
// browsing many listings.
const ipHits = new Map<string, number[]>();
const LIMIT = 300;
const WINDOW_MS = 60 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) return true;
  arr.push(now);
  ipHits.set(ip, arr);
  return false;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  if (kind !== 'page' && kind !== 'listing') {
    return new Response(null, { status: 400 });
  }

  let listingId: string | null = null;
  if (kind === 'listing') {
    listingId = typeof body.listing_id === 'string' ? body.listing_id.trim() : '';
    if (!UUID_RE.test(listingId)) return new Response(null, { status: 400 });
  }

  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  if (rateLimited(ip)) return new Response(null, { status: 204 });

  // Fire-and-forget semantics: tracking must never surface errors to the
  // visitor (e.g. a stale listing id failing the FK).
  const { error } = await serviceClient
    .from('asset_page_views')
    .insert({ kind, listing_id: listingId });
  if (error) console.error('asset-track insert error:', error);

  return new Response(null, { status: 204 });
};
