import { Link, Navigate } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'
import { useInvoices } from '../hooks/useInvoices'
import { useModules } from '../hooks/useModules'
import { useViewAs } from '../components/ViewAsProvider'
import { AdminDashboard } from './admin/AdminDashboard'
import type { ModuleKey } from '../lib/modules'

const MODULE_ROUTES: Record<ModuleKey, string> = {
  dashboard: '/portal/home',
  ordering: '/portal/orders',
  recurring_orders: '/portal/orders/recurring',
  accounts: '/portal/accounts',
  pricing: '/portal/price-list',
  delivery_notes: '/portal/delivery-notes',
  promotions: '/portal/promotions',
  team: '/portal/team',
  stockouts: '/portal/stockouts',
}

export function Dashboard() {
  const { portalUser, isSystemAdmin } = useAuthContext()
  const { isViewingAs } = useViewAs()
  const { isModuleEnabled, enabledModules, loading: modulesLoading } = useModules()

  if (isSystemAdmin && !isViewingAs) return <AdminDashboard />

  // If dashboard module is disabled, redirect to first enabled module
  if (!modulesLoading && !isModuleEnabled('dashboard')) {
    for (const [key, route] of Object.entries(MODULE_ROUTES)) {
      if (key !== 'dashboard' && isModuleEnabled(key as ModuleKey)) {
        return <Navigate to={route} replace />
      }
    }
    // No modules enabled at all — show profile
    return <Navigate to="/portal/profile" replace />
  }
  const { outstandingBalance, unpaidCount, invoices, payments, loading } = useInvoices()

  const showAccounts = isModuleEnabled('accounts')
  const showOrdering = isModuleEnabled('ordering')

  const recentInvoices = showAccounts ? invoices.slice(0, 5) : []

  const hasAnyModule = showAccounts || showOrdering ||
    isModuleEnabled('pricing') || isModuleEnabled('recurring_orders') ||
    isModuleEnabled('team') || isModuleEnabled('delivery_notes') ||
    isModuleEnabled('promotions') || isModuleEnabled('stockouts')

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
          Welcome back, {portalUser?.display_name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Here's an overview of your account.</p>
      </header>

      {!hasAnyModule ? (
        <div className="odin-card p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Your account is being set up</h2>
          <p className="text-sm text-muted-foreground">
            Modules will be enabled for your account shortly. Check back soon.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {showAccounts && (
              <>
                <div className="odin-card p-6">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Outstanding Balance</h3>
                  <p className="text-3xl font-bold text-foreground">
                    {loading ? '...' : `\u00A3${outstandingBalance.toFixed(2)}`}
                  </p>
                  <Link to="/portal/accounts" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">View invoices</Link>
                </div>

                <div className="odin-card p-6">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Unpaid Invoices</h3>
                  <p className="text-3xl font-bold text-foreground">{loading ? '...' : unpaidCount}</p>
                  <Link to="/portal/accounts" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">View all</Link>
                </div>

                <div className="odin-card p-6">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Payments</h3>
                  <p className="text-3xl font-bold text-foreground">{loading ? '...' : payments.length}</p>
                  <Link to="/portal/accounts" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">View payments</Link>
                </div>
              </>
            )}

            {showOrdering && (
              <div className="odin-card p-6">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Orders</h3>
                <p className="text-3xl font-bold text-foreground">--</p>
                <Link to="/portal/orders" className="inline-block mt-2 text-xs text-primary no-underline hover:underline">View orders</Link>
              </div>
            )}
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
                    <span className="font-semibold text-sm">&pound;{inv.invoice_total?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
