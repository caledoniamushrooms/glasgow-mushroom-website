export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Service-role client — server-side only, bypasses RLS so we can
// both INSERT new rows and UPDATE existing ones during the multi-step
// register flow.
const admin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
);

const resend = new Resend(import.meta.env.RESEND_API_KEY);

const FROM = 'Glasgow Mushroom Company <hello@glasgowmushroomcompany.co.uk>';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normaliseFulfilment(raw: string | null): 'delivery' | 'collection' | 'courier' | null {
  if (raw === 'delivery' || raw === 'collection' || raw === 'courier') return raw;
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const id = data.get('id')?.toString().trim() || null;

  // ---------------------------------------------------------------------
  // UPDATE path — caller has an existing row id and is amending it
  // ---------------------------------------------------------------------
  if (id) {
    const email = data.get('email')?.toString().trim().toLowerCase();
    if (!email) return jsonResponse({ error: 'email required for update' }, 400);

    const patch: Record<string, unknown> = {};
    const message = data.get('message')?.toString().trim();
    const fulfilment = normaliseFulfilment(data.get('fulfilment_method')?.toString().trim() ?? null);
    if (message !== undefined) patch.message = message || null;
    if (fulfilment !== null) patch.fulfilment_method = fulfilment;

    if (Object.keys(patch).length === 0) {
      return jsonResponse({ success: true, id, noop: true });
    }

    // Match on (id, email) to prevent hijacking by id-guess. The caller
    // must know the same email used at insert time.
    const { error: updateErr, data: updated } = await admin
      .from('portal_registration_requests')
      .update(patch)
      .eq('id', id)
      .ilike('email', email)
      .select('id')
      .maybeSingle();

    if (updateErr || !updated) {
      return jsonResponse({ error: 'Could not update your application. Please refresh and try again.' }, 404);
    }

    return jsonResponse({ success: true, id: updated.id });
  }

  // ---------------------------------------------------------------------
  // INSERT path — first submission (Step 1 of /portal/register)
  // ---------------------------------------------------------------------
  const businessName = data.get('business_name')?.toString().trim();
  const contactName = data.get('contact_name')?.toString().trim();
  const email = data.get('email')?.toString().trim();
  const phone = data.get('phone')?.toString().trim() || null;
  const message = data.get('message')?.toString().trim() || null;
  const postcode = data.get('postcode')?.toString().trim().toUpperCase() || null;
  const website = data.get('website')?.toString().trim() || null;
  const addressLine1 = data.get('address_line_1')?.toString().trim() || null;
  const city = data.get('city')?.toString().trim() || null;
  const fulfilment_method = normaliseFulfilment(data.get('fulfilment_method')?.toString().trim() ?? null);

  if (!businessName || !contactName || !email) {
    return jsonResponse({ error: 'Please complete all required fields.' }, 400);
  }

  const normEmail = email.toLowerCase();

  // Already has a portal account
  const { data: existingUser } = await admin
    .from('portal_users')
    .select('id')
    .ilike('email', normEmail)
    .maybeSingle();
  if (existingUser) {
    return jsonResponse(
      { error: 'This email already has a trade account. Please sign in instead.' },
      409,
    );
  }

  // Already has an in-flight application
  const { data: existingApp } = await admin
    .from('portal_registration_requests')
    .select('id, status')
    .ilike('email', normEmail)
    .not('status', 'in', '(rejected,active)')
    .maybeSingle();
  if (existingApp) {
    return jsonResponse(
      { error: 'We already have an application in progress for this email. Please check your inbox or contact accounts@glasgowmushroomcompany.co.uk.' },
      409,
    );
  }

  const { data: inserted, error: insertErr } = await admin
    .from('portal_registration_requests')
    .insert({
      business_name: businessName,
      contact_name: contactName,
      email: normEmail,
      phone,
      message,
      postcode,
      website,
      address_line_1: addressLine1,
      city,
      fulfilment_method,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500);
  }

  // Fire-and-forget emails: applicant confirmation + admin notification
  await Promise.allSettled([
    resend.emails.send({
      from: FROM,
      to: email,
      subject: 'We\'ve received your trade account application',
      text: `Hi ${contactName},\n\nThanks for applying for a Glasgow Mushroom Company trade account on behalf of ${businessName}.\n\nWe'll review your application and email you once your account has been approved. At that point you'll be able to complete the rest of your onboarding and start placing orders.\n\nIf you have any questions in the meantime, just reply to this email.\n\nBest,\nGlasgow Mushroom Company`,
    }),
    resend.emails.send({
      from: FROM,
      to: 'accounts@glasgowmushroomcompany.co.uk',
      subject: `New trade account application: ${businessName}`,
      text: `New application:\n\nBusiness: ${businessName}\nContact: ${contactName}\nEmail: ${email}\nPhone: ${phone ?? '—'}\nPostcode: ${postcode ?? '—'}\nFulfilment preference: ${fulfilment_method ?? 'not set (in delivery area)'}\nAddress (from Places): ${addressLine1 ?? '—'}${city ? ', ' + city : ''}\nWebsite: ${website ?? '—'}\n\nMessage:\n${message ?? '—'}\n\nReview at: https://www.glasgowmushroomcompany.co.uk/portal/admin/registrations`,
    }),
  ]);

  return jsonResponse({ success: true, id: inserted.id });
};
