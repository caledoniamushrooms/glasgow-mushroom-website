import { Link } from 'react-router-dom'
import { useAuthContext } from '../../components/AuthProvider'
import { useRegistrations } from '../../hooks/useRegistrations'
import { useAdminCustomers } from '../../hooks/useAdminCustomers'

export function AdminDashboard() {
  const { portalUser } = useAuthContext()
  const { registrations, pendingCount, loading: regLoading } = useRegistrations()
  const { customers, loading: custLoading } = useAdminCustomers()

  const recentRegistrations = registrations.slice(0, 5)
  const loading = regLoading || custLoading

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
          Welcome back, {portalUser?.display_name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Trade Portal administration overview.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="odin-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Total Customers</h3>
          <p className="text-3xl font-bold text-foreground">{loading ? '...' : customers.length}</p>
          <Link to="/portal/admin/customers" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">Manage customers</Link>
        </div>

        <div className="odin-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Pending Registrations</h3>
          <p className="text-3xl font-bold text-foreground">{loading ? '...' : pendingCount}</p>
          <Link to="/portal/admin/registrations" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">Review requests</Link>
        </div>

        <div className="odin-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Total Registrations</h3>
          <p className="text-3xl font-bold text-foreground">{loading ? '...' : registrations.length}</p>
          <Link to="/portal/admin/registrations" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">View all</Link>
        </div>

        <div className="odin-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Markets</h3>
          <p className="text-3xl font-bold text-foreground">—</p>
          <Link to="/portal/markets" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">Manage markets</Link>
        </div>
      </div>

      {recentRegistrations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Recent Registrations</h2>
          <div className="odin-table-container">
            {recentRegistrations.map((req, i) => (
              <div
                key={req.id}
                className={`flex justify-between items-center px-4 py-3 ${i < recentRegistrations.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div>
                  <span className="font-semibold text-sm">{req.business_name}</span>
                  <span className="text-muted-foreground text-xs ml-3">{req.contact_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className={`badge ${req.status === 'pending' ? 'badge-pending' : req.status === 'invited' ? 'badge-paid' : req.status === 'rejected' ? 'badge-cancelled' : 'badge-draft'}`}>
                    {req.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
