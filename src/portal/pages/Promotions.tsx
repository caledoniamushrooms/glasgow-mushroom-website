import { usePromotions } from '../hooks/usePromotions'

const DISCOUNT_LABELS: Record<string, string> = {
  percentage: '% off',
  fixed: '£ off',
  free_sample: 'Free Sample',
  bundle: 'Bundle Deal',
  info_only: 'Info',
}

export function Promotions() {
  const { promotions, loading, error } = usePromotions()

  if (loading) return <div className="odin-loading">Loading promotions...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load promotions</div>

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Promotions &amp; Offers</h1>
        <p className="text-sm text-muted-foreground mt-1">Current promotions available to your account</p>
      </header>

      {promotions.length === 0 ? (
        <div className="odin-empty">
          <p>No active promotions at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map(promo => (
            <div key={promo.id} className="odin-card p-6 flex flex-col">
              {promo.image_url && (
                <img
                  src={promo.image_url}
                  alt={promo.name}
                  className="w-full h-32 object-cover rounded-md mb-4"
                />
              )}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-foreground">{promo.name}</h3>
                <span className="badge badge-paid whitespace-nowrap text-xs">
                  {promo.discount_value != null && promo.discount_type === 'percentage'
                    ? `${promo.discount_value}% off`
                    : promo.discount_value != null && promo.discount_type === 'fixed'
                    ? `£${promo.discount_value} off`
                    : DISCOUNT_LABELS[promo.discount_type] || promo.discount_type}
                </span>
              </div>
              {promo.description && (
                <p className="text-sm text-muted-foreground mb-3 flex-1">{promo.description}</p>
              )}
              <div className="text-xs text-muted-foreground mt-auto pt-2 border-t border-border">
                {promo.end_date
                  ? `Valid until ${new Date(promo.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Ongoing'}
                {promo.min_order_quantity != null && (
                  <span className="ml-2">· Min {promo.min_order_quantity}kg</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
