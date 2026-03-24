import { Link } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'
import { useInvoices } from '../hooks/useInvoices'
import './Dashboard.css'

export function Dashboard() {
  const { portalUser } = useAuthContext()
  const { outstandingBalance, unpaidCount, invoices, payments, loading } = useInvoices()

  const recentInvoices = invoices.slice(0, 5)
  const recentPayments = payments.slice(0, 5)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Welcome back, {portalUser?.display_name}</h1>
        <p>Here's an overview of your account.</p>
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Outstanding Balance</h3>
          <p className="dashboard-stat">
            {loading ? '...' : `\u00A3${outstandingBalance.toFixed(2)}`}
          </p>
          <Link to="/portal/invoices" className="dashboard-card-link">View invoices</Link>
        </div>

        <div className="dashboard-card">
          <h3>Unpaid Invoices</h3>
          <p className="dashboard-stat">{loading ? '...' : unpaidCount}</p>
          <Link to="/portal/invoices" className="dashboard-card-link">View all</Link>
        </div>

        <div className="dashboard-card">
          <h3>Recent Payments</h3>
          <p className="dashboard-stat">{loading ? '...' : payments.length}</p>
          <Link to="/portal/payments" className="dashboard-card-link">View payments</Link>
        </div>

        <div className="dashboard-card">
          <h3>Orders</h3>
          <p className="dashboard-stat">--</p>
          <Link to="/portal/orders" className="dashboard-card-link">View orders</Link>
        </div>
      </div>

      {/* Recent invoices */}
      {recentInvoices.length > 0 && (
        <section style={{ marginTop: 'var(--portal-space-xl)' }}>
          <h2 style={{ fontSize: 'var(--portal-text-lg)', fontWeight: 600, marginBottom: 'var(--portal-space-sm)' }}>
            Recent Invoices
          </h2>
          <div style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius)', overflow: 'hidden' }}>
            {recentInvoices.map(inv => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--portal-space-sm) var(--portal-space-md)', borderBottom: '1px solid var(--portal-gray-100)' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 'var(--portal-text-sm)' }}>{inv.invoice_no}</span>
                  <span style={{ color: 'var(--portal-text-muted)', fontSize: 'var(--portal-text-xs)', marginLeft: 'var(--portal-space-sm)' }}>
                    {new Date(inv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 'var(--portal-text-sm)' }}>&pound;{inv.total?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
