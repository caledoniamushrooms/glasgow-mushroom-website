import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthContext } from './AuthProvider'
import { useRealtime } from '../hooks/useRealtime'
import './PortalLayout.css'

const navItems = [
  { to: '/portal', label: 'Dashboard' },
  { to: '/portal/orders', label: 'Orders' },
  { to: '/portal/orders/recurring', label: 'Recurring' },
  { to: '/portal/invoices', label: 'Invoices' },
  { to: '/portal/payments', label: 'Payments' },
  { to: '/portal/price-list', label: 'Price List' },
  { to: '/portal/profile', label: 'Profile' },
  { to: '/portal/team', label: 'Team' },
]

export function PortalLayout() {
  const { portalUser, signOut } = useAuthContext()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Subscribe to Realtime updates for this customer
  useRealtime()

  const handleSignOut = async () => {
    await signOut()
    navigate('/portal/login')
  }

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <button
          className="portal-menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          <span className="portal-menu-icon" />
        </button>
        <span className="portal-header-title">Glasgow Mushroom Co.</span>
        <button className="portal-header-signout" onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <aside className={`portal-sidebar ${sidebarOpen ? 'portal-sidebar--open' : ''}`}>
        <div className="portal-sidebar-brand">
          <h2>Glasgow Mushroom Co.</h2>
          <p className="portal-sidebar-user">{portalUser?.display_name}</p>
        </div>

        <nav className="portal-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/portal'}
              className={({ isActive }) =>
                `portal-nav-link ${isActive ? 'portal-nav-link--active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="portal-sidebar-footer">
          <button className="portal-signout-btn" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="portal-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="portal-main">
        <Outlet />
      </main>
    </div>
  )
}
