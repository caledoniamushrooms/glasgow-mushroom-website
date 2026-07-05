export const prerender = false;

import type { APIRoute } from 'astro';
import { jsonResponse, requireAdmin } from '../_lib/admin-auth';
import { pollEbayOrders } from '../_lib/ebay/orders';

// Vercel cron hits this every 15 minutes (see vercel.json). Vercel sends
// Authorization: Bearer <CRON_SECRET> when that env var is set; an admin
// session also works so it can be triggered manually from the portal.
export const GET: APIRoute = async ({ request }) => {
  const cronSecret = import.meta.env.CRON_SECRET;
  const isCron =
    cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`;
  if (!isCron) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
  }

  try {
    const result = await pollEbayOrders();
    if (result.markedSold.length > 0) {
      console.log('eBay poll marked sold:', result.markedSold.join(', '));
    }
    return jsonResponse(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // "Not connected" before OAuth is expected — report cleanly, not as a crash.
    console.error('eBay order poll failed:', message);
    return jsonResponse({ error: message }, 500);
  }
};
