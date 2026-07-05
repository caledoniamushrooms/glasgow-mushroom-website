import { API_BASE, CONTENT_LANGUAGE, MARKETPLACE_ID } from './config';
import { getAccessToken } from './oauth';

export class EbayError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, path: string) {
    super(`eBay API ${status} on ${path}: ${summarise(body)}`);
    this.status = status;
    this.body = body;
  }
}

function summarise(body: unknown): string {
  const errors = (body as { errors?: Array<{ message?: string; longMessage?: string }> })?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map((e) => e.longMessage || e.message).filter(Boolean).join('; ');
  }
  return JSON.stringify(body).slice(0, 300);
}

/**
 * Authenticated call to an eBay REST API. Returns parsed JSON (or null for 204).
 * Throws EbayError on non-2xx.
 */
export async function ebayFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Required by Inventory API write calls; harmless elsewhere.
      'Content-Language': CONTENT_LANGUAGE,
      'Accept-Language': CONTENT_LANGUAGE,
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE_ID,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (res.status === 204) return null as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new EbayError(res.status, json, path);
  return json as T;
}
