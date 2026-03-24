import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useCustomer } from '../hooks/useCustomer'
import './Invoices.css'

interface PriceEntry {
  product_id: string
  product_name: string
  strain: string | null
  product_type: string
  base_price: number
  tier_multiplier: number
  final_price: number
}

export function PriceList() {
  const { customer } = useCustomer()

  const pricesQuery = useQuery({
    queryKey: ['price-list', customer?.price_tier_id],
    queryFn: async (): Promise<PriceEntry[]> => {
      // Fetch products, product types, price tiers, and base prices
      const [productsRes, typesRes, tierRes] = await Promise.all([
        supabase.from('products').select('*').eq('active', true).order('name'),
        supabase.from('product_types').select('*').order('name'),
        customer?.price_tier_id
          ? supabase.from('price_tiers').select('*').eq('id', customer.price_tier_id).single()
          : Promise.resolve({ data: { multiplier: 1.0, display_name: 'Standard' } }),
      ])

      const products = productsRes.data || []
      const types = typesRes.data || []
      const tier = tierRes.data || { multiplier: 1.0 }

      // Build price list entries
      const entries: PriceEntry[] = []
      for (const product of products) {
        for (const type of types) {
          if (type.price_multiplier === 0) continue // skip gift/sample types
          const basePrice = 10.00 // Base price — in production this comes from product_prices table
          const finalPrice = basePrice * (type.price_multiplier || 1) * (tier.multiplier || 1)
          entries.push({
            product_id: product.id,
            product_name: product.name,
            strain: product.strain,
            product_type: type.name,
            base_price: basePrice,
            tier_multiplier: tier.multiplier || 1,
            final_price: Math.round(finalPrice * 100) / 100,
          })
        }
      }

      return entries
    },
    enabled: !!customer,
  })

  const prices = pricesQuery.data || []

  return (
    <div>
      <header className="invoices-header">
        <div>
          <h1>Price List</h1>
          <p>Your current pricing</p>
        </div>
      </header>

      {pricesQuery.isLoading ? (
        <div className="portal-loading">Loading prices...</div>
      ) : prices.length === 0 ? (
        <div className="invoices-empty"><p>No products available.</p></div>
      ) : (
        <div className="invoices-table-wrap">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Strain</th>
                <th>Type</th>
                <th className="text-right">Price per kg</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p, i) => (
                <tr key={i}>
                  <td className="font-semibold">{p.product_name}</td>
                  <td className="text-muted">{p.strain || '-'}</td>
                  <td>{p.product_type}</td>
                  <td className="text-right font-semibold">&pound;{p.final_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{
        marginTop: 'var(--portal-space-md)',
        fontSize: 'var(--portal-text-xs)',
        color: 'var(--portal-text-muted)',
      }}>
        Prices are estimates and may be adjusted at confirmation. Contact us for volume discounts.
      </p>
    </div>
  )
}
