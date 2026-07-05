import { serviceClient } from '../admin-auth';
import {
  API_BASE,
  AUTH_BASE,
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_ENV,
  EBAY_RUNAME,
  OAUTH_SCOPES,
  assertEbayConfigured,
} from './config';

const TOKEN_URL = `${API_BASE}/identity/v1/oauth2/token`;

function basicAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
}

export function buildConsentUrl(state: string): string {
  assertEbayConfigured();
  const params = new URLSearchParams({
    client_id: EBAY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: EBAY_RUNAME,
    scope: OAUTH_SCOPES.join(' '),
    state,
  });
  return `${AUTH_BASE}/oauth2/authorize?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`eBay token request failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json as TokenResponse;
}

/** One-time exchange after the seller grants consent. Stores the refresh token. */
export async function exchangeAuthCode(code: string): Promise<void> {
  const token = await requestToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: EBAY_RUNAME,
    })
  );
  if (!token.refresh_token) throw new Error('eBay did not return a refresh token.');

  const now = Date.now();
  const { error } = await serviceClient.from('ebay_tokens').upsert({
    environment: EBAY_ENV,
    refresh_token: token.refresh_token,
    refresh_token_expires_at: token.refresh_token_expires_in
      ? new Date(now + token.refresh_token_expires_in * 1000).toISOString()
      : null,
    access_token: token.access_token,
    access_token_expires_at: new Date(now + token.expires_in * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  });
  if (error) throw new Error(`Failed to store eBay tokens: ${error.message}`);
}

/** Returns a valid access token, refreshing via the stored refresh token when needed. */
export async function getAccessToken(): Promise<string> {
  assertEbayConfigured();
  const { data: row, error } = await serviceClient
    .from('ebay_tokens')
    .select('refresh_token, access_token, access_token_expires_at')
    .eq('environment', EBAY_ENV)
    .maybeSingle();
  if (error) throw new Error(`Failed to read eBay tokens: ${error.message}`);
  if (!row) {
    throw new Error(
      `eBay account not connected for ${EBAY_ENV}. Visit /api/ebay/oauth/start to grant access.`
    );
  }

  // 60s slack so a token never expires mid-request.
  if (
    row.access_token &&
    row.access_token_expires_at &&
    new Date(row.access_token_expires_at).getTime() > Date.now() + 60_000
  ) {
    return row.access_token;
  }

  const token = await requestToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
      scope: OAUTH_SCOPES.join(' '),
    })
  );
  const { error: updateError } = await serviceClient
    .from('ebay_tokens')
    .update({
      access_token: token.access_token,
      access_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('environment', EBAY_ENV);
  if (updateError) console.error('Failed to cache eBay access token:', updateError);

  return token.access_token;
}
