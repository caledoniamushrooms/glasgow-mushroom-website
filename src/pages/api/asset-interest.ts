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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const data = await request.formData();

  // Honeypot
  if (data.get('website')?.toString().trim()) {
    return jsonResponse({ success: true });
  }

  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  if (rateLimited(ip)) return jsonResponse({ error: 'Too many submissions. Please try again later.' }, 429);

  const listingId = data.get('listing_id')?.toString().trim() || null;
  const name = data.get('name')?.toString().trim();
  const email = data.get('email')?.toString().trim().toLowerCase();
  const phone = data.get('phone')?.toString().trim() || null;
  const message = data.get('message')?.toString().trim() || null;
  const rawPref = data.get('collection_preference')?.toString().trim();
  const collection_preference = ['collection', 'delivery', 'either'].includes(rawPref ?? '')
    ? rawPref
    : null;

  if (!name || !email) return jsonResponse({ error: 'Name and email are required.' }, 400);

  // Look up listing for the email summary
  let listingName = 'an item';
  let askingPrice: number | null = null;
  if (listingId) {
    const { data: listing } = await admin
      .from('asset_listings')
      .select('name, asking_price')
      .eq('id', listingId)
      .maybeSingle();
    if (listing) {
      listingName = listing.name;
      askingPrice = Number(listing.asking_price);
    }
  }

  const { error: insertErr } = await admin
    .from('asset_listing_interest')
    .insert({ listing_id: listingId, name, email, phone, message, collection_preference });

  if (insertErr) {
    console.error('Interest insert error:', insertErr);
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500);
  }

  const priceText = askingPrice != null ? `£${askingPrice.toLocaleString('en-GB')}` : '—';

  await Promise.allSettled([
    resend.emails.send({
      from: FROM,
      to: NOTIFY_TO,
      subject: `Asset interest: ${listingName}`,
      text: [
        `New interest in: ${listingName}`,
        `Asking price: ${priceText}`,
        '',
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone ?? '—'}`,
        `Preference: ${collection_preference ?? '—'}`,
        '',
        'Message:',
        message ?? '—',
        '',
        listingId
          ? `Listing: https://www.glasgowmushroomcompany.co.uk/portal/admin/assets#${listingId}`
          : '',
      ].join('\n'),
    }),
    resend.emails.send({
      from: FROM,
      to: email,
      subject: `Thanks for your interest — ${listingName}`,
      text: `Hi ${name},\n\nThanks for registering interest in "${listingName}". We've received your details and will be in touch shortly to discuss next steps (viewing, collection / delivery, payment).\n\nIf you have any questions in the meantime, just reply to this email.\n\nBest,\nGlasgow Mushroom Company`,
    }),
  ]);

  return jsonResponse({ success: true });
};
