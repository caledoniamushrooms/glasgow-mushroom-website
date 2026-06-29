import { serviceClient } from './admin-auth';

/**
 * Durable, cross-instance rate limit backed by the Postgres
 * check_rate_limit() RPC (see Odin migration 20260629120000).
 * Replaces per-instance in-memory counters that don't hold across
 * Vercel serverless instances.
 *
 * Fails OPEN: if the RPC errors (e.g. transient DB issue), we log and
 * allow the request rather than blocking legitimate traffic on a soft
 * control.
 *
 * @returns true if the caller is within budget, false if rate limited.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await serviceClient.rpc('check_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('check_rate_limit RPC error:', error);
    return true; // fail open
  }
  return data === true;
}
