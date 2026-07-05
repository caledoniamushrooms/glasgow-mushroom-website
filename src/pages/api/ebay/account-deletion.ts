export const prerender = false;

import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { EBAY_VERIFICATION_TOKEN } from '../_lib/ebay/config';

// eBay marketplace-account-deletion notification endpoint. Required before
// eBay will enable a production keyset. We hold no eBay user data, so the
// POST handler just acknowledges receipt.
const ENDPOINT_URL = 'https://www.glasgowmushroom.co/api/ebay/account-deletion';

export const GET: APIRoute = async ({ url }) => {
  const challengeCode = url.searchParams.get('challenge_code');
  if (!challengeCode || !EBAY_VERIFICATION_TOKEN) {
    return new Response('Bad request', { status: 400 });
  }
  // Response is sha256(challengeCode + verificationToken + endpointUrl), hex.
  const challengeResponse = createHash('sha256')
    .update(challengeCode + EBAY_VERIFICATION_TOKEN + ENDPOINT_URL)
    .digest('hex');
  return new Response(JSON.stringify({ challengeResponse }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async () => new Response(null, { status: 200 });
