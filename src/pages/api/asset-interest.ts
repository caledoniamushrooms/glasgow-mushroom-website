export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const admin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
);

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const FROM = 'Glasgow Mushroom Company <hello@glasgowmushroomcompany.co.uk>';
const NOTIFY_TO = 'hendrik@glasgowmushroomcompany.co.uk';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Lightweight in-memory rate limit (per warm Vercel instance)
const ipHits = new Map<string, number[]>();
const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) return true;
  arr.push(now);
  ipHits.set(ip, arr);
  return false;
}

interface SubmittedItem {
  listing_id: string;
  offer_value: number | null;
}

function priceLabel(asking: number, isPoa: boolean): string {
  if (isPoa) return 'POA';
  if (asking === 0) return 'Free';
  return `£${asking.toLocaleString('en-GB')}`;
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
  if (rateLimited(ip)) {
    return jsonResponse({ error: 'Too many submissions. Please try again later.' }, 429);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
  const message = typeof body.message === 'string' ? body.message.trim() || null : null;
  const rawPref = typeof body.collection_preference === 'string' ? body.collection_preference.trim() : '';
  const collection_preference = ['collection', 'delivery', 'either'].includes(rawPref) ? rawPref : null;

  if (!name || !email) return jsonResponse({ error: 'Name and email are required.' }, 400);

  // Validate items
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return jsonResponse({ error: 'Select at least one item.' }, 400);
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
      if (!Number.isFinite(n) || n < 0) {
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
    .select('id, name, asking_price, is_poa')
    .in('id', items.map((i) => i.listing_id));

  const listingMap = new Map<string, { name: string; asking_price: number; is_poa: boolean }>();
  (listingRows ?? []).forEach((l) => {
    listingMap.set(l.id, {
      name: l.name,
      asking_price: Number(l.asking_price),
      is_poa: Boolean(l.is_poa),
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

  // Email summary
  let quotedTotal = 0;
  let poaCount = 0;
  const itemLines: string[] = items.map((i) => {
    const listing = listingMap.get(i.listing_id);
    const name = listing?.name ?? '(unknown item)';
    const asking = listing?.asking_price ?? 0;
    const isPoa = listing?.is_poa ?? false;
    const askingLabel = priceLabel(asking, isPoa);

    let line = `- ${name} — Asking: ${askingLabel}`;
    if (i.offer_value != null) line += ` | Offer: £${i.offer_value.toLocaleString('en-GB')}`;

    if (isPoa) {
      poaCount += 1;
    } else {
      quotedTotal += i.offer_value ?? asking;
    }
    return line;
  });

  const totalLine = (() => {
    const quoted = `£${quotedTotal.toLocaleString('en-GB')}`;
    if (poaCount === 0) return `Quoted total: ${quoted}`;
    return `Quoted total: ${quoted}  (+ ${poaCount} POA item${poaCount === 1 ? '' : 's'})`;
  })();

  await Promise.allSettled([
    resend.emails.send({
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
    }),
    resend.emails.send({
      from: FROM,
      to: email,
      subject: `Thanks for your interest — Glasgow Mushroom Company`,
      text: [
        `Hi ${name},`,
        '',
        `Thanks for registering interest in ${items.length} item${items.length === 1 ? '' : 's'} from our asset register. We've received your details and will be in touch shortly to discuss next steps (viewing, collection / delivery, payment).`,
        '',
        'If you have any questions in the meantime, just reply to this email.',
        '',
        'Best,',
        'Glasgow Mushroom Company',
      ].join('\n'),
    }),
  ]);

  return jsonResponse({ success: true, submission_id: submission.id });
};
