export const prerender = false;

import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { jsonResponse, requireAdmin } from '../../_lib/admin-auth';
import { buildConsentUrl } from '../../_lib/ebay/oauth';

// Admin kicks off the one-time eBay seller consent flow.
// eBay redirects back to /api/ebay/oauth/callback (via the RuName's accept URL).
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const url = buildConsentUrl(randomBytes(16).toString('hex'));
    return jsonResponse({ url });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'eBay not configured.' }, 500);
  }
};
