import { Link } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'
import { useInvoices } from '../hooks/useInvoices'

export function Dashboard() {
  const { portalUser } = useAuthContext()
  const { outstandingBalance, unpaidCount, invoices, payments, loading } = useInvoices()

  const recentInvoices = invoices.slice(0, 5)

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
          Welcome back, {portalUser?.display_name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Here's an overview of your account.</p>
      </header>

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
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Orders</h3>
          <p className="text-3xl font-bold text-foreground">--</p>
          <Link to="/portal/orders" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">View orders</Link>
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
