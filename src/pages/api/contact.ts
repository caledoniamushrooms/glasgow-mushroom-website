export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const name = data.get('name')?.toString().trim();
  const email = data.get('email')?.toString().trim();
  const message = data.get('message')?.toString().trim();

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: 'All fields are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await resend.emails.send({
    from: 'Glasgow Mushroom Company <noreply@glasgowmushroomcompany.co.uk>',
    to: 'hello@glasgowmushroomcompany.co.uk',
    replyTo: email,
    subject: `Direct sales enquiry from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
  });

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to send message. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
