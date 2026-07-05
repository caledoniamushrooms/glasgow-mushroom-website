import { serviceClient } from '../admin-auth';
import { ebayFetch } from './client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EbayOrder = {
  orderId: string;
  orderPaymentStatus: string;
  cancelStatus?: { cancelState: string };
  lineItems: Array<{
    sku?: string;
    total?: { value: string; currency: string };
  }>;
};

/**
 * Poll recent eBay orders and mark matching asset listings sold.
 * SKU on the eBay side is the asset_listings UUID, which makes matching exact.
 * Idempotent: already-sold listings are skipped.
 */
export async function pollEbayOrders(): Promise<{
  checked: number;
  markedSold: string[];
}> {
  // 7-day lookback: generous overlap so a few failed cron runs never lose a sale.
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, '.000Z');
  const markedSold: string[] = [];
  let checked = 0;
  let offset = 0;
  const limit = 50;

  for (;;) {
    const page = await ebayFetch<{ orders?: EbayOrder[]; total?: number }>(
      `/sell/fulfillment/v1/order?filter=creationdate:%5B${encodeURIComponent(since)}..%5D&limit=${limit}&offset=${offset}`
    );
    const orders = page.orders ?? [];
    checked += orders.length;

    for (const order of orders) {
      if (order.cancelStatus?.cancelState && order.cancelStatus.cancelState !== 'NONE_REQUESTED') continue;
      for (const item of order.lineItems ?? []) {
        if (!item.sku || !UUID_RE.test(item.sku)) continue;

        const { data: listing } = await serviceClient
          .from('asset_listings')
          .select('id, status, name')
          .eq('id', item.sku)
          .maybeSingle();
        if (!listing || listing.status === 'sold') continue;

        const soldPrice = item.total ? Number(item.total.value) : null;
        const { error } = await serviceClient
          .from('asset_listings')
          .update({
            status: 'sold',
            sold_price_inc_vat: Number.isFinite(soldPrice) ? soldPrice : null,
            ebay_order_id: order.orderId,
            ebay_sync_status: 'ended', // quantity 1 — the eBay listing ends itself on sale
            ebay_sync_error: null,
            ebay_synced_at: new Date().toISOString(),
          })
          .eq('id', listing.id);
        if (error) {
          console.error(`Failed to mark ${listing.id} sold from eBay order ${order.orderId}:`, error);
        } else {
          markedSold.push(`${listing.name} (order ${order.orderId})`);
        }
      }
    }

    if (orders.length < limit) break;
    offset += limit;
  }

  return { checked, markedSold };
}
