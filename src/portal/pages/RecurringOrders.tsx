import { useState } from 'react'
import { useRecurringOrders } from '../hooks/useRecurringOrders'
import { useOrders } from '../hooks/useOrders'
import { useCustomer } from '../hooks/useCustomer'
import './Invoices.css'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function RecurringOrders() {
  const { recurringOrders, cancelRecurring, togglePause, loading, error } = useRecurringOrders()
  const { upcomingOrders } = useOrders()
  const { deliverySchedules } = useCustomer()
  const [cancelling, setCancelling] = useState<string | null>(null)

  // Build upcoming schedule: combine one-off portal orders with recurring order days
  const scheduleItems = buildSchedule(upcomingOrders, recurringOrders, deliverySchedules)

  const handleCancel = async (id: string) => {
    if (!confirm('Deactivate this recurring order?')) return
    setCancelling(id)
    try {
      await cancelRecurring.mutateAsync(id)
    } catch (err) {
      alert('Failed: ' + (err as Error).message)
    }
    setCancelling(null)
  }

  if (loading) return <div className="portal-loading">Loading...</div>
  if (error) return <div className="portal-error">Failed to load recurring orders</div>

  return (
    <div>
      <header className="invoices-header">
        <div>
          <h1>Recurring Orders</h1>
          <p>Your standing orders and upcoming delivery schedule</p>
        </div>
      </header>

      {/* Upcoming Schedule (next 14 days) */}
      <section style={{ marginBottom: 'var(--portal-space-xl)' }}>
        <h2 style={{ fontSize: 'var(--portal-text-lg)', fontWeight: 600, marginBottom: 'var(--portal-space-sm)' }}>
          Upcoming 2 Weeks
        </h2>
        {scheduleItems.length === 0 ? (
          <div className="invoices-empty"><p>No upcoming deliveries scheduled.</p></div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--portal-space-xs)' }}>
            {scheduleItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--portal-space-sm) var(--portal-space-md)',
                background: 'var(--portal-surface)', border: '1px solid var(--portal-border)',
                borderRadius: 'var(--portal-radius-sm)',
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 'var(--portal-text-sm)' }}>
                    {item.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <span style={{ color: 'var(--portal-text-muted)', fontSize: 'var(--portal-text-xs)', marginLeft: 'var(--portal-space-sm)' }}>
                    {item.source}
                  </span>
                </div>
                <span className={`invoice-badge ${item.type === 'one-off' ? 'badge-modified' : 'badge-paid'}`}>
                  {item.type === 'one-off' ? item.status : 'recurring'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Recurring Orders */}
      <section>
        <h2 style={{ fontSize: 'var(--portal-text-lg)', fontWeight: 600, marginBottom: 'var(--portal-space-sm)' }}>
          Standing Orders
        </h2>
        {recurringOrders.length === 0 ? (
          <div className="invoices-empty">
            <p>No recurring orders set up. Contact us to arrange a standing order.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--portal-space-md)' }}>
            {recurringOrders.map(order => (
              <div key={order.id} className="invoices-table-wrap" style={{ padding: 'var(--portal-space-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--portal-space-sm)' }}>
                  <div>
                    <strong>{order.name}</strong>
                    <span className={`invoice-badge ${order.active ? 'badge-paid' : 'badge-cancelled'}`} style={{ marginLeft: 'var(--portal-space-sm)' }}>
                      {order.active ? (order.paused_until ? 'paused' : 'active') : 'inactive'}
                    </span>
                  </div>
                  {order.active && (
                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={cancelling === order.id}
                      style={{
                        background: 'none', border: '1px solid var(--portal-border)',
                        padding: '4px 12px', borderRadius: 'var(--portal-radius-sm)',
                        fontSize: 'var(--portal-text-xs)', cursor: 'pointer',
                        color: 'var(--portal-text-muted)',
                      }}
                    >
                      {cancelling === order.id ? '...' : 'Deactivate'}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 'var(--portal-text-sm)', color: 'var(--portal-text-muted)' }}>
                  <strong>Days:</strong> {order.days_of_week?.map(d => DAY_NAMES[d]).join(', ') || 'None set'}
                </div>
                {order.items && order.items.length > 0 && (
                  <div style={{ fontSize: 'var(--portal-text-sm)', color: 'var(--portal-text-muted)', marginTop: '4px' }}>
                    <strong>Items:</strong> {order.items.length} product{order.items.length !== 1 ? 's' : ''}
                  </div>
                )}
                {order.paused_until && (
                  <div style={{ fontSize: 'var(--portal-text-xs)', color: 'var(--portal-status-pending)', marginTop: '4px' }}>
                    Paused until {new Date(order.paused_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

interface ScheduleItem {
  date: Date
  type: 'one-off' | 'recurring'
  source: string
  status: string
}

function buildSchedule(upcomingOrders: any[], recurringOrders: any[], deliverySchedules: any[]): ScheduleItem[] {
  const items: ScheduleItem[] = []
  const today = new Date()
  const twoWeeks = new Date(today.getTime() + 14 * 86400000)

  // Add one-off portal orders
  for (const order of upcomingOrders) {
    const date = new Date(order.actual_date || order.requested_date)
    if (date >= today && date <= twoWeeks) {
      items.push({ date, type: 'one-off', source: 'Portal order', status: order.status })
    }
  }

  // Add recurring order occurrences
  for (const order of recurringOrders) {
    if (!order.active || !order.days_of_week) continue
    const pausedUntil = order.paused_until ? new Date(order.paused_until) : null

    for (let d = new Date(today); d <= twoWeeks; d = new Date(d.getTime() + 86400000)) {
      if (pausedUntil && d < pausedUntil) continue
      if (order.days_of_week.includes(d.getDay())) {
        items.push({ date: new Date(d), type: 'recurring', source: order.name, status: 'scheduled' })
      }
    }
  }

  items.sort((a, b) => a.date.getTime() - b.date.getTime())
  return items
}
