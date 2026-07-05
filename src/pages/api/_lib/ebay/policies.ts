import { ebayFetch, EbayError } from './client';
import { MARKETPLACE_ID, MERCHANT_LOCATION_KEY } from './config';

// One-time seller-account scaffolding, safe to call repeatedly:
// business-policy opt-in, the three required policies, and the inventory location.
// Everything is get-or-create by name so repeat calls are cheap and idempotent.

const POLICY_NAMES = {
  payment: 'GMC managed payments',
  return: 'GMC no returns',
  fulfillment: 'GMC collection only',
} as const;

const CATEGORY_TYPES = [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }];

export type SellerPolicies = {
  paymentPolicyId: string;
  returnPolicyId: string;
  fulfillmentPolicyId: string;
  merchantLocationKey: string;
};

let cached: SellerPolicies | null = null;

export async function ensureSellerPolicies(): Promise<SellerPolicies> {
  if (cached) return cached;

  await optInToBusinessPolicies();

  const [paymentPolicyId, returnPolicyId, fulfillmentPolicyId] = await Promise.all([
    ensurePaymentPolicy(),
    ensureReturnPolicy(),
    ensureFulfillmentPolicy(),
  ]);
  await ensureInventoryLocation();

  cached = {
    paymentPolicyId,
    returnPolicyId,
    fulfillmentPolicyId,
    merchantLocationKey: MERCHANT_LOCATION_KEY,
  };
  return cached;
}

async function optInToBusinessPolicies(): Promise<void> {
  try {
    await ebayFetch('/sell/account/v1/program/opt_in', {
      method: 'POST',
      body: { programType: 'SELLING_POLICY_MANAGEMENT' },
    });
  } catch (e) {
    // Already opted in comes back as an error; that's fine.
    if (e instanceof EbayError && e.status < 500) return;
    throw e;
  }
}

type PolicyList<K extends string> = { [key in K]: Array<{ name: string } & Record<string, string>> };

async function findByName<K extends string>(
  path: string,
  listKey: K,
  idKey: string,
  name: string
): Promise<string | null> {
  const res = await ebayFetch<PolicyList<K>>(`${path}?marketplace_id=${MARKETPLACE_ID}`);
  const match = (res[listKey] ?? []).find((p) => p.name === name);
  return match ? match[idKey] : null;
}

async function ensurePaymentPolicy(): Promise<string> {
  const existing = await findByName(
    '/sell/account/v1/payment_policy',
    'paymentPolicies',
    'paymentPolicyId',
    POLICY_NAMES.payment
  );
  if (existing) return existing;
  const created = await ebayFetch<{ paymentPolicyId: string }>('/sell/account/v1/payment_policy', {
    method: 'POST',
    body: {
      name: POLICY_NAMES.payment,
      marketplaceId: MARKETPLACE_ID,
      categoryTypes: CATEGORY_TYPES,
    },
  });
  return created.paymentPolicyId;
}

async function ensureReturnPolicy(): Promise<string> {
  const existing = await findByName(
    '/sell/account/v1/return_policy',
    'returnPolicies',
    'returnPolicyId',
    POLICY_NAMES.return
  );
  if (existing) return existing;
  const created = await ebayFetch<{ returnPolicyId: string }>('/sell/account/v1/return_policy', {
    method: 'POST',
    body: {
      name: POLICY_NAMES.return,
      marketplaceId: MARKETPLACE_ID,
      categoryTypes: CATEGORY_TYPES,
      returnsAccepted: false,
    },
  });
  return created.returnPolicyId;
}

async function ensureFulfillmentPolicy(): Promise<string> {
  const existing = await findByName(
    '/sell/account/v1/fulfillment_policy',
    'fulfillmentPolicies',
    'fulfillmentPolicyId',
    POLICY_NAMES.fulfillment
  );
  if (existing) return existing;
  const created = await ebayFetch<{ fulfillmentPolicyId: string }>(
    '/sell/account/v1/fulfillment_policy',
    {
      method: 'POST',
      body: {
        name: POLICY_NAMES.fulfillment,
        marketplaceId: MARKETPLACE_ID,
        categoryTypes: CATEGORY_TYPES,
        handlingTime: { value: 3, unit: 'DAY' },
        // Collection in person only — no shipping options at all.
        localPickup: true,
        shippingOptions: [],
      },
    }
  );
  return created.fulfillmentPolicyId;
}

async function ensureInventoryLocation(): Promise<void> {
  try {
    await ebayFetch(`/sell/inventory/v1/location/${MERCHANT_LOCATION_KEY}`);
    return; // exists
  } catch (e) {
    if (!(e instanceof EbayError) || e.status !== 404) throw e;
  }
  await ebayFetch(`/sell/inventory/v1/location/${MERCHANT_LOCATION_KEY}`, {
    method: 'POST',
    body: {
      name: 'Glasgow Mushroom Company',
      location: {
        address: {
          addressLine1: import.meta.env.EBAY_LOCATION_ADDRESS1 ?? '31 Dalsholm Avenue',
          city: import.meta.env.EBAY_LOCATION_CITY ?? 'Glasgow',
          postalCode: import.meta.env.EBAY_LOCATION_POSTCODE ?? 'G20 0TS',
          country: 'GB',
        },
      },
      merchantLocationStatus: 'ENABLED',
      locationTypes: ['WAREHOUSE'],
    },
  });
}
