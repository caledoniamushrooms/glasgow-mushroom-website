import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '../components/AuthProvider'
import { useInvoices } from '../hooks/useInvoices'
import { supabase } from '../lib/supabase'
import type { Promotion } from '../lib/types'

export function Dashboard() {
  const { portalUser } = useAuthContext()
  const { outstandingBalance, unpaidCount, invoices, payments, loading } = useInvoices()

  const promotionsQuery = useQuery({
    queryKey: ['promotions-active'],
    queryFn: async (): Promise<Promotion[]> => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('active', true)
        .lte('start_date', today)
        .gte('end_date', today)
        .order('end_date')

      if (error) throw error
      return data || []
    },
  })

  const activePromotions = promotionsQuery.data || []
  const recentInvoices = invoices.slice(0, 5)

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
          Welcome back, {portalUser?.display_name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Here's an overview of your account.</p>
      </header>

      {/* Active promotions banner */}
      {activePromotions.length > 0 && (
        <div className="mb-6 space-y-2">
          {activePromotions.map(promo => (
            <div key={promo.id} className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
              <div>
                <span className="font-semibold text-sm text-green-900">{promo.name}</span>
                {promo.description && (
                  <span className="text-sm text-green-700 ml-2">{promo.description}</span>
                )}
              </div>
              <div className="text-right shrink-0 ml-4">
                <span className="font-bold text-green-800">{promo.discount_percent}% off</span>
                <span className="block text-xs text-green-600">
                  until {new Date(promo.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="odin-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Outstanding Balance</h3>
          <p className="text-3xl font-bold text-foreground">
            {loading ? '...' : `\u00A3${outstandingBalance.toFixed(2)}`}
          </p>
          <Link to="/portal/invoices" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">View invoices</Link>
        </div>

        <div className="odin-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Unpaid Invoices</h3>
          <p className="text-3xl font-bold text-foreground">{loading ? '...' : unpaidCount}</p>
          <Link to="/portal/invoices" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">View all</Link>
        </div>

        <div className="odin-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Payments</h3>
          <p className="text-3xl font-bold text-foreground">{loading ? '...' : payments.length}</p>
          <Link to="/portal/payments" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">View payments</Link>
        </div>

        <div className="odin-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Quick Actions</h3>
          <div className="flex flex-col gap-2 mt-1">
            <Link to="/portal/orders/new" className="text-xs text-primary no-underline hover:underline">Place an order</Link>
            <Link to="/portal/orders/stockout" className="text-xs text-red-600 no-underline hover:underline">Report stockout</Link>
          </div>
        </div>
      </div>

      {recentInvoices.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Recent Invoices</h2>
          <div className="odin-table-container">
            {recentInvoices.map((inv, i) => (
              <div
                key={inv.id}
                className={`flex justify-between items-center px-4 py-3 ${i < recentInvoices.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div>
                  <span className="font-semibold text-sm">{inv.invoice_no}</span>
                  <span className="text-muted-foreground text-xs ml-3">
                    {new Date(inv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <span className="font-semibold text-sm">&pound;{inv.total?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
