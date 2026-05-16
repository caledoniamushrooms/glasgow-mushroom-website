export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const businessName = data.get('business_name')?.toString().trim();
  const contactName = data.get('contact_name')?.toString().trim();
  const email = data.get('email')?.toString().trim();
  const phone = data.get('phone')?.toString().trim() || null;
  const message = data.get('message')?.toString().trim() || null;
  const postcode = data.get('postcode')?.toString().trim().toUpperCase() || null;
  const website = data.get('website')?.toString().trim() || null;
  const addressLine1 = data.get('address_line_1')?.toString().trim() || null;
  const city = data.get('city')?.toString().trim() || null;
  const fulfilmentRaw = data.get('fulfilment_method')?.toString().trim() || null;
  const fulfilment_method = (fulfilmentRaw === 'collection' || fulfilmentRaw === 'courier' || fulfilmentRaw === 'delivery')
    ? fulfilmentRaw
    : null;

  if (!businessName || !contactName || !email) {
    return new Response(JSON.stringify({ error: 'Please complete all required fields.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const normEmail = email.toLowerCase();

  // Already has a portal account
  const { data: existingUser } = await supabase
    .from('portal_users')
    .select('id')
    .ilike('email', normEmail)
    .maybeSingle();
  if (existingUser) {
    return new Response(
      JSON.stringify({ error: 'This email already has a trade account. Please sign in instead.' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Already has an in-flight application
  const { data: existingApp } = await supabase
    .from('portal_registration_requests')
    .select('id, status')
    .ilike('email', normEmail)
    .not('status', 'in', '(rejected,active)')
    .maybeSingle();
  if (existingApp) {
    return new Response(
      JSON.stringify({ error: 'We already have an application in progress for this email. Please check your inbox or contact accounts@glasgowmushroomcompany.co.uk.' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { error } = await supabase
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
    });

  if (error) {
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const from = 'Glasgow Mushroom Company <hello@glasgowmushroomcompany.co.uk>';

  await Promise.allSettled([
    resend.emails.send({
      from,
      to: email,
      subject: 'We\'ve received your trade account application',
      text: `Hi ${contactName},\n\nThanks for applying for a Glasgow Mushroom Company trade account on behalf of ${businessName}.\n\nWe'll review your application and email you once your account has been approved. At that point you'll be able to complete the rest of your onboarding and start placing orders.\n\nIf you have any questions in the meantime, just reply to this email.\n\nBest,\nGlasgow Mushroom Company`,
    }),
    resend.emails.send({
      from,
      to: 'accounts@glasgowmushroomcompany.co.uk',
      subject: `New trade account application: ${businessName}`,
      text: `New application:\n\nBusiness: ${businessName}\nContact: ${contactName}\nEmail: ${email}\nPhone: ${phone ?? '—'}\nPostcode: ${postcode ?? '—'}\nFulfilment preference: ${fulfilment_method ?? 'not set (in delivery area)'}\nAddress (from Places): ${addressLine1 ?? '—'}${city ? ', ' + city : ''}\nWebsite: ${website ?? '—'}\n\nMessage:\n${message ?? '—'}\n\nReview at: https://www.glasgowmushroomcompany.co.uk/portal/admin/registrations`,
    }),
  ]);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
