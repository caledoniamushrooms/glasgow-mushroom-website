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
  const name = data.get('name')?.toString().trim();
  const companyName = data.get('company_name')?.toString().trim();
  const email = data.get('email')?.toString().trim();

  if (!name || !companyName || !email) {
    return new Response(JSON.stringify({ error: 'All fields are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabase
    .from('portal_interest')
    .insert({ name, company_name: companyName, email });

  if (error) {
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Send confirmation and notification emails (non-blocking — record is already saved)
  const from = 'Glasgow Mushroom Company <hello@glasgowmushroomcompany.co.uk>';

  await Promise.allSettled([
    resend.emails.send({
      from,
      to: email,
      subject: 'Thanks for your interest in the GMC Trade Portal',
      text: `Hi ${name},\n\nThanks for registering your interest in the Glasgow Mushroom Company Trade Portal.\n\nWe're building a new platform where our trade customers can manage orders, view pricing, and access account information — all in one place.\n\nWe'll be in touch when it's ready for you.\n\nBest,\nGlasgow Mushroom Company`,
    }),
    resend.emails.send({
      from,
      to: 'hello@glasgowmushroomcompany.co.uk',
      subject: `New Trade Portal interest: ${companyName}`,
      text: `New registration of interest:\n\nName: ${name}\nCompany: ${companyName}\nEmail: ${email}`,
    }),
  ]);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
