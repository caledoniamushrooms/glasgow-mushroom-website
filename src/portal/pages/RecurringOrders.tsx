import { useState } from 'react'
import { useRecurringOrders } from '../hooks/useRecurringOrders'
import { useOrders } from '../hooks/useOrders'
import { useCustomer } from '../hooks/useCustomer'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function RecurringOrders() {
  const { recurringOrders, cancelRecurring, togglePause, loading, error } = useRecurringOrders()
  const { upcomingOrders } = useOrders()
  const { deliverySchedules } = useCustomer()
  const [cancelling, setCancelling] = useState<string | null>(null)

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

  if (loading) return <div className="odin-loading">Loading...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load recurring orders</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Recurring Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Your standing orders and upcoming delivery schedule</p>
        </div>
      </header>

      {/* Upcoming Schedule (next 14 days) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Upcoming 2 Weeks</h2>
        {scheduleItems.length === 0 ? (
          <div className="odin-empty"><p>No upcoming deliveries scheduled.</p></div>
        ) : (
          <div className="grid gap-2">
            {scheduleItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-3 bg-white border border-border rounded-md">
                <div>
                  <span className="font-semibold text-sm">
                    {item.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-muted-foreground text-xs ml-3">{item.source}</span>
                </div>
                <span className={`badge ${item.type === 'one-off' ? 'badge-modified' : 'badge-paid'}`}>
                  {item.type === 'one-off' ? item.status : 'recurring'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Recurring Orders */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Standing Orders</h2>
        {recurringOrders.length === 0 ? (
          <div className="odin-empty">
            <p>No recurring orders set up. Contact us to arrange a standing order.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {recurringOrders.map(order => (
              <div key={order.id} className="odin-card p-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <strong>{order.name}</strong>
                    <span className={`badge ml-3 ${order.active ? 'badge-paid' : 'badge-cancelled'}`}>
                      {order.active ? (order.paused_until ? 'paused' : 'active') : 'inactive'}
                    </span>
                  </div>
                  {order.active && (
                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={cancelling === order.id}
                      className="bg-transparent border border-border px-3 py-1 rounded text-xs cursor-pointer text-muted-foreground hover:bg-accent transition-colors"
                    >
                      {cancelling === order.id ? '...' : 'Deactivate'}
                    </button>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Days:</strong> {order.days_of_week?.map((d: number) => DAY_NAMES[d]).join(', ') || 'None set'}
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="text-sm text-muted-foreground mt-1">
                    <strong>Items:</strong> {order.items.length} product{order.items.length !== 1 ? 's' : ''}
                  </div>
                )}
                {order.paused_until && (
                  <div className="text-xs text-yellow-600 mt-1">
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

  for (const order of upcomingOrders) {
    const date = new Date(order.actual_date || order.requested_date)
    if (date >= today && date <= twoWeeks) {
      items.push({ date, type: 'one-off', source: 'Portal order', status: order.status })
    }
  }

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
