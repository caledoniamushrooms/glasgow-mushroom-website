export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { priceIncVat, formatGBP } from '../../lib/vat';
import { requireAdmin } from './_lib/admin-auth';
import { checkRateLimit } from './_lib/rate-limit';

const admin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
);

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const FROM = 'Glasgow Mushroom Company <hello@glasgowmushroomcompany.co.uk>';
const NOTIFY_TO = 'hello@glasgowmushroomcompany.co.uk';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Durable rate limit (shared across Vercel instances via Postgres).
const LIMIT = 5;
const WINDOW_SECONDS = 60 * 60;

interface SubmittedItem {
  listing_id: string;
  offer_value: number | null;
}

// Mirrors the public page: POA wins, null price = TBD, explicit 0 = Free,
// otherwise the inc-VAT price the visitor saw on the site.
function priceLabel(asking: number | null, isPoa: boolean, isZeroRated: boolean): string {
  if (isPoa) return 'POA';
  if (asking == null) return 'TBD';
  if (asking === 0) return 'Free';
  return `${formatGBP(priceIncVat(asking, isZeroRated))} inc VAT`;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'Invalid JSON.' }, 400);
  }

  // Honeypot
  if (typeof body.website === 'string' && body.website.trim()) {
    return jsonResponse({ success: true });
  }

  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  if (!(await checkRateLimit(`interest:${ip}`, LIMIT, WINDOW_SECONDS))) {
    return jsonResponse({ error: 'Too many submissions. Please try again later.' }, 429);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
  const message = typeof body.message === 'string' ? body.message.trim() || null : null;
  const rawPref = typeof body.collection_preference === 'string' ? body.collection_preference.trim() : '';
  const collection_preference = ['collection', 'delivery', 'either'].includes(rawPref) ? rawPref : null;

  if (!name || !email) return jsonResponse({ error: 'Name and email are required.' }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return jsonResponse({ error: 'Enter a valid email address.' }, 400);
  }
  if (
    name.length > 200 ||
    email.length > 320 ||
    (phone?.length ?? 0) > 50 ||
    (message?.length ?? 0) > 5000
  ) {
    return jsonResponse({ error: 'One of the fields is too long.' }, 400);
  }

  // Validate items
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return jsonResponse({ error: 'Select at least one item.' }, 400);
  }
  if (body.items.length > 100) {
    return jsonResponse({ error: 'Too many items.' }, 400);
  }

  const items: SubmittedItem[] = [];
  const seenIds = new Set<string>();
  for (const raw of body.items) {
    if (!raw || typeof raw !== 'object') continue;
    const id = typeof raw.listing_id === 'string' ? raw.listing_id.trim() : '';
    if (!UUID_RE.test(id) || seenIds.has(id)) continue;
    seenIds.add(id);

    let offer: number | null = null;
    if (raw.offer_value !== null && raw.offer_value !== undefined && raw.offer_value !== '') {
      const n = Number(raw.offer_value);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        return jsonResponse({ error: `Bad offer value for an item.` }, 400);
      }
      offer = n;
    }
    items.push({ listing_id: id, offer_value: offer });
  }
  if (items.length === 0) return jsonResponse({ error: 'No valid items.' }, 400);

  // Look up listings to build the email summary. Anything missing here is
  // logged but kept on the submission so admin can still see what was tried.
  const { data: listingRows } = await admin
    .from('asset_listings')
    .select('id, name, asking_price, is_poa, is_zero_rated')
    .in('id', items.map((i) => i.listing_id));

  const listingMap = new Map<
    string,
    { name: string; asking_price: number | null; is_poa: boolean; is_zero_rated: boolean }
  >();
  (listingRows ?? []).forEach((l) => {
    listingMap.set(l.id, {
      name: l.name,
      asking_price: l.asking_price == null ? null : Number(l.asking_price),
      is_poa: Boolean(l.is_poa),
      is_zero_rated: Boolean(l.is_zero_rated),
    });
  });

  // Insert submission + items
  const { data: submission, error: insErr } = await admin
    .from('interest_submissions')
    .insert({ name, email, phone, message, collection_preference })
    .select('id')
    .single();
  if (insErr || !submission) {
    console.error('Submission insert error:', insErr);
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500);
  }

  const childRows = items.map((i) => ({
    submission_id: submission.id,
    listing_id: i.listing_id,
    offer_value: i.offer_value,
  }));
  const { error: childErr } = await admin
    .from('interest_submission_items')
    .insert(childRows);
  if (childErr) {
    console.error('Submission items insert error:', childErr);
    // Submission row is already in — surface a soft error rather than
    // leaving a parent with no children. Admin can clean up.
    return jsonResponse({ error: 'Something went wrong saving the items.' }, 500);
  }

  // Email summary — inc-VAT figures so the totals match what the visitor
  // saw on the site. Offers count toward the total even on POA/TBD items.
  let quotedTotal = 0;
  let unpricedCount = 0;
  const itemLines: string[] = items.map((i) => {
    const listing = listingMap.get(i.listing_id);
    const itemName = listing?.name ?? '(unknown item)';
    const asking = listing?.asking_price ?? null;
    const isPoa = listing?.is_poa ?? false;
    const isZeroRated = listing?.is_zero_rated ?? false;

    let line = `- ${itemName} — Asking: ${priceLabel(asking, isPoa, isZeroRated)}`;
    if (i.offer_value != null) line += ` | Offer: ${formatGBP(i.offer_value)}`;

    if (i.offer_value != null) {
      quotedTotal += i.offer_value;
    } else if (isPoa || asking == null) {
      unpricedCount += 1;
    } else {
      quotedTotal += priceIncVat(asking, isZeroRated);
    }
    return line;
  });

  const totalLine = (() => {
    const quoted = `${formatGBP(quotedTotal)} inc VAT`;
    if (unpricedCount === 0) return `Quoted total: ${quoted}`;
    return `Quoted total: ${quoted}  (+ ${unpricedCount} POA/TBD item${unpricedCount === 1 ? '' : 's'})`;
  })();

  // Admin notification only. We deliberately do NOT send a confirmation
  // to the visitor-supplied address: it's unverified, so it would let
  // anyone send GMC-branded mail to arbitrary third parties. The visitor
  // gets the on-page success state instead.
  await resend.emails.send({
    from: FROM,
    to: NOTIFY_TO,
    subject: `Asset interest: ${items.length} item${items.length === 1 ? '' : 's'} — ${name}`,
    text: [
      `New interest in ${items.length} item${items.length === 1 ? '' : 's'}:`,
      '',
      ...itemLines,
      '',
      totalLine,
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone ?? '—'}`,
      `Preference: ${collection_preference ?? '—'}`,
      '',
      'Message:',
      message ?? '—',
      '',
      `Submission: ${submission.id}`,
    ].join('\n'),
  }).catch((err) => console.error('Admin notification email failed:', err));

  return jsonResponse({ success: true, submission_id: submission.id });
};

// Admin: list interest submissions with their items.
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin
    .from('interest_submissions')
    .select('*, interest_submission_items(id, listing_id, offer_value, asset_listings(name, asking_price, is_poa, is_zero_rated))')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('List submissions error:', error);
    return jsonResponse({ error: 'Failed to load submissions.' }, 500);
  }
  return jsonResponse(data ?? []);
};
