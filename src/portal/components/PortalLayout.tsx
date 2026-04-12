import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthContext } from './AuthProvider'
import { useCustomer } from '../hooks/useCustomer'
import { useRealtime } from '../hooks/useRealtime'
import { useModules } from '../hooks/useModules'
import type { ModuleKey } from '../lib/modules'

interface NavItem {
  to: string
  label: string
  icon: string
  moduleKey: ModuleKey | null // null = always visible
}

const navItems: NavItem[] = [
  { to: '/portal', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', moduleKey: 'dashboard' },
  { to: '/portal/orders', label: 'Orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', moduleKey: 'ordering' },
  { to: '/portal/orders/recurring', label: 'Recurring', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', moduleKey: 'recurring_orders' },
  { to: '/portal/invoices', label: 'Invoices', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z', moduleKey: 'accounts' },
  { to: '/portal/payments', label: 'Payments', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', moduleKey: 'accounts' },
  { to: '/portal/price-list', label: 'Price List', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z', moduleKey: 'pricing' },
  { to: '/portal/delivery-notes', label: 'Delivery Notes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', moduleKey: 'delivery_notes' },
  { to: '/portal/promotions', label: 'Promotions', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7', moduleKey: 'promotions' },
  { to: '/portal/stockouts', label: 'Stockouts', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', moduleKey: 'stockouts' },
  { to: '/portal/profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', moduleKey: null },
  { to: '/portal/team', label: 'Team', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', moduleKey: 'team' },
]

const adminNavItems = [
  { to: '/portal/admin/registrations', label: 'Registrations', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { to: '/portal/markets', label: 'Markets', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
]

export function PortalLayout() {
  const { portalUser, isSystemAdmin, signOut } = useAuthContext()
  const { customer, currentBranch } = useCustomer()
  const { isModuleEnabled } = useModules()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useRealtime()

  const visibleNavItems = navItems.filter(
    item => item.moduleKey === null || isModuleEnabled(item.moduleKey)
  )

  const handleSignOut = async () => {
    await signOut()
    navigate('/portal/login')
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans antialiased">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 bg-white border-b border-border z-30 lg:hidden">
        <button
          className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent transition-colors"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-lg font-semibold text-foreground">Glasgow Mushroom Co.</span>
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-60 bg-white border-r border-border flex flex-col z-40 transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Brand */}
        <div className="px-4 py-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            {customer?.name || 'Glasgow Mushroom Co.'}
          </h2>
          {currentBranch && (
            <p className="text-xs text-muted-foreground mt-1">{currentBranch.name}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">{portalUser?.display_name}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {visibleNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/portal'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors border-l-[3px] ${
                  isActive
                    ? 'text-foreground bg-accent/50 border-l-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30 border-l-transparent'
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          ))}
          {isSystemAdmin && (
            <>
              <div className="border-t border-border my-2 mx-4" />
              <p className="px-4 pt-1 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Admin</p>
              {adminNavItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors border-l-[3px] ${
                      isActive
                        ? 'text-foreground bg-accent/50 border-l-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/30 border-l-transparent'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <button
            className="w-full px-3 py-2 text-sm text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[35] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 mt-16 lg:mt-0 lg:ml-60 p-4 md:p-6 lg:p-8 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
