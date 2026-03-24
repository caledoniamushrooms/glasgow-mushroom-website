import { useAuthContext } from '../components/AuthProvider'
import './Dashboard.css'

export function Dashboard() {
  const { portalUser } = useAuthContext()

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Welcome back, {portalUser?.display_name}</h1>
        <p>Here's an overview of your account.</p>
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Outstanding Balance</h3>
          <p className="dashboard-stat">--</p>
          <span className="dashboard-label">Coming soon</span>
        </div>

        <div className="dashboard-card">
          <h3>Next Delivery</h3>
          <p className="dashboard-stat">--</p>
          <span className="dashboard-label">Coming soon</span>
        </div>

        <div className="dashboard-card">
          <h3>Recent Orders</h3>
          <p className="dashboard-stat">--</p>
          <span className="dashboard-label">Coming soon</span>
        </div>

        <div className="dashboard-card">
          <h3>Unpaid Invoices</h3>
          <p className="dashboard-stat">--</p>
          <span className="dashboard-label">Coming soon</span>
        </div>
      </div>
    </div>
  )
}
