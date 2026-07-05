export const prerender = false;

import type { APIRoute } from 'astro';
import { exchangeAuthCode } from '../../_lib/ebay/oauth';

// eBay redirects here after the seller grants consent. The auth code is useless
// without our client secret, so no session check is needed to exchange it.
export const GET: APIRoute = async ({ url, redirect }) => {
  const code = url.searchParams.get('code');
  if (!code) return redirect('/portal/admin/assets?ebay=denied');

  try {
    await exchangeAuthCode(code);
    return redirect('/portal/admin/assets?ebay=connected');
  } catch (e) {
    console.error('eBay OAuth callback failed:', e);
    return redirect('/portal/admin/assets?ebay=error');
  }
};
