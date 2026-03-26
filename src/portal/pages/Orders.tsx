import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrders } from '../hooks/useOrders'

const STATUS_CLASSES: Record<string, string> = {
  submitted: 'badge badge-pending',
  confirmed: 'badge badge-paid',
  modified: 'badge badge-modified',
  cancelled: 'badge badge-cancelled',
  fulfilled: 'badge badge-paid',
}

export function Orders() {
  const { orders, upcomingOrders, cancelOrder, loading, error } = useOrders()
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  const [cancelling, setCancelling] = useState<string | null>(null)

  const historyOrders = orders.filter(o => ['cancelled', 'fulfilled'].includes(o.status))
  const displayOrders = tab === 'upcoming' ? upcomingOrders : historyOrders

  const handleCancel = async (orderId: string) => {
    if (!confirm('Cancel this order?')) return
    setCancelling(orderId)
    try {
      await cancelOrder.mutateAsync(orderId)
    } catch (err) {
      alert('Failed to cancel: ' + (err as Error).message)
    }
    setCancelling(null)
  }

  if (loading) return <div className="odin-loading">Loading orders...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load orders</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Your upcoming deliveries and order history</p>
        </div>
        <Link
          to="/portal/orders/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md no-underline font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          New Order
        </Link>
      </header>

      {/* Tabs */}
      <div className="flex gap-3 mb-6 border-b border-border">
        {(['upcoming', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm capitalize border-b-2 transition-colors bg-transparent border-x-0 border-t-0 cursor-pointer ${
              tab === t
                ? 'border-b-primary text-primary font-semibold'
                : 'border-b-transparent text-muted-foreground'
            }`}
          >
            {t} ({t === 'upcoming' ? upcomingOrders.length : historyOrders.length})
          </button>
        ))}
      </div>

      {displayOrders.length === 0 ? (
        <div className="odin-empty">
          <p>{tab === 'upcoming' ? 'No upcoming orders.' : 'No past orders.'}</p>
          {tab === 'upcoming' && (
            <Link to="/portal/orders/new" className="text-primary hover:underline">Place your first order</Link>
          )}
        </div>
      ) : (
        <div className="odin-table-container overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="odin-table-header">
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Date</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Items</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Status</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Notes</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayOrders.map(order => (
                <tr key={order.id} className="odin-table-row">
                  <td className="odin-table-cell font-semibold">
                    {new Date(order.actual_date || order.requested_date).toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                    {order.actual_date && order.actual_date !== order.requested_date && (
                      <span className="block text-xs text-blue-500">
                        (moved from {new Date(order.requested_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                      </span>
                    )}
                  </td>
                  <td className="odin-table-cell text-muted-foreground">
                    {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="odin-table-cell">
                    <span className={STATUS_CLASSES[order.status] || 'badge'}>
                      {order.status}
                    </span>
                  </td>
                  <td className="odin-table-cell text-muted-foreground text-xs max-w-[200px]">
                    {order.operator_notes && <div><strong>Operator:</strong> {order.operator_notes}</div>}
                    {order.modification_summary && <div>{order.modification_summary}</div>}
                    {order.customer_notes && <div>{order.customer_notes}</div>}
                    {order.cancelled_reason && <div className="text-red-500">{order.cancelled_reason}</div>}
                  </td>
                  <td className="odin-table-cell">
                    {order.status === 'submitted' && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancelling === order.id}
                        className="bg-transparent border border-red-500 text-red-500 px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {cancelling === order.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
