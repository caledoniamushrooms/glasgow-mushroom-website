export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import { PriceListPdf } from '../../portal/components/PriceListPdf';
import type { PriceGroup } from '../../portal/lib/types';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
);

export const GET: APIRoute = async ({ url }) => {
  try {
    // Fetch retail-tier product prices
    const { data, error } = await supabase
      .from('product_prices')
      .select(`
        price_per_kg,
        products!inner(strain, base_price_per_kg, active),
        product_types!inner(name, price_multiplier),
        price_tiers!inner(name, display_name)
      `)
      .eq('products.active', true)
      .eq('price_tiers.name', 'retail');

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch pricing data.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: 'Retail pricing not available.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filter to A Class only (base price grade) — done in JS because
    // PostgREST join filters on product_types don't reliably narrow rows
    const aClassRows = data.filter((row: any) => row.product_types.name === 'A Class');

    if (aClassRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Retail pricing not available.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Group by product (single grade per product after A Class filter)
    const productMap = new Map<string, PriceGroup>();

    for (const row of aClassRows) {
      const r = row as any;
      const productName = r.products.strain;
      const basePrice = r.products.base_price_per_kg;
      const tierName = r.price_tiers.name;
      const price = r.price_per_kg;

      let group = productMap.get(productName);
      if (!group) {
        group = { product_name: productName, base_price: basePrice, grades: [] };
        productMap.set(productName, group);
      }

      // Single grade entry per product (A Class), grade_name left blank since hideGrade is true
      let grade = group.grades[0];
      if (!grade) {
        grade = { grade_name: '', multiplier: 1, tiers: {} };
        group.grades.push(grade);
      }

      grade.tiers[tierName] = price;
    }

    const grouped = Array.from(productMap.values()).sort((a, b) =>
      a.product_name.localeCompare(b.product_name),
    );

    const tierDisplayName = (aClassRows[0] as any).price_tiers.display_name || 'Retail';
    const now = new Date();
    const generatedDate = now.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const dateStamp = now.toISOString().slice(0, 10);

    const logoUrl = `${url.origin}/images/logo-full.png`;

    const pdfElement = PriceListPdf({
      grouped,
      tiers: [{ key: 'retail', displayName: tierDisplayName }],
      generatedDate,
      wholesaleThresholds: [],
      volumeDiscounts: [],
      logoUrl,
      hideGrade: true,
    });

    const buffer = await renderToBuffer(pdfElement as any);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="GMC-Retail-Price-List-${dateStamp}.pdf"`,
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    });
  } catch (err) {
    console.error('Price list PDF generation failed:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate price list.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
