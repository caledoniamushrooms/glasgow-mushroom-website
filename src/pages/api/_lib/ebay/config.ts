// eBay app configuration. Keyset lives in env vars (Vercel/Doppler), never the DB.
// EBAY_ENV switches the whole integration between sandbox and production.

export type EbayEnv = 'sandbox' | 'production';

export const EBAY_ENV: EbayEnv =
  import.meta.env.EBAY_ENV === 'production' ? 'production' : 'sandbox';

export const EBAY_CLIENT_ID: string = import.meta.env.EBAY_CLIENT_ID ?? '';
export const EBAY_CLIENT_SECRET: string = import.meta.env.EBAY_CLIENT_SECRET ?? '';
// eBay's OAuth "redirect_uri" is the RuName from the developer console, not a URL.
export const EBAY_RUNAME: string = import.meta.env.EBAY_RUNAME ?? '';
// Shared secret for the marketplace-account-deletion challenge (32-80 chars, set in dev console).
export const EBAY_VERIFICATION_TOKEN: string = import.meta.env.EBAY_VERIFICATION_TOKEN ?? '';

export const API_BASE =
  EBAY_ENV === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
export const AUTH_BASE =
  EBAY_ENV === 'production' ? 'https://auth.ebay.com' : 'https://auth.sandbox.ebay.com';

export const MARKETPLACE_ID = 'EBAY_GB';
// Category tree 3 = ebay.co.uk
export const CATEGORY_TREE_ID = '3';
export const CONTENT_LANGUAGE = 'en-GB';
export const MERCHANT_LOCATION_KEY = 'gmc-farm';

export const OAUTH_SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
];

export function assertEbayConfigured(): void {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    throw new Error('eBay keyset not configured (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET).');
  }
}
