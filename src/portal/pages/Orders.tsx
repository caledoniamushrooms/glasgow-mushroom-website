import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrders } from '../hooks/useOrders'
import './Invoices.css'

const STATUS_CLASSES: Record<string, string> = {
  submitted: 'badge-pending',
  confirmed: 'badge-paid',
  modified: 'badge-modified',
  cancelled: 'badge-cancelled',
  fulfilled: 'badge-paid',
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

  if (loading) return <div className="portal-loading">Loading orders...</div>
  if (error) return <div className="portal-error">Failed to load orders</div>

  return (
    <div>
      <header className="invoices-header">
        <div>
          <h1>Orders</h1>
          <p>Your upcoming deliveries and order history</p>
        </div>
        <Link
          to="/portal/orders/new"
          style={{
            background: 'var(--portal-green)',
            color: 'var(--portal-white)',
            padding: '8px 16px',
            borderRadius: 'var(--portal-radius-sm)',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 'var(--portal-text-sm)',
          }}
        >
          New Order
        </Link>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--portal-space-sm)', marginBottom: 'var(--portal-space-lg)', borderBottom: '1px solid var(--portal-border)' }}>
        {(['upcoming', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: 'var(--portal-space-sm) var(--portal-space-md)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--portal-green)' : '2px solid transparent',
              color: tab === t ? 'var(--portal-green)' : 'var(--portal-text-muted)',
              fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer',
              fontSize: 'var(--portal-text-sm)',
              textTransform: 'capitalize',
            }}
          >
            {t} ({t === 'upcoming' ? upcomingOrders.length : historyOrders.length})
          </button>
        ))}
      </div>

      {displayOrders.length === 0 ? (
        <div className="invoices-empty">
          <p>{tab === 'upcoming' ? 'No upcoming orders.' : 'No past orders.'}</p>
          {tab === 'upcoming' && (
            <Link to="/portal/orders/new" style={{ color: 'var(--portal-green)' }}>Place your first order</Link>
          )}
        </div>
      ) : (
        <div className="invoices-table-wrap">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Items</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayOrders.map(order => (
                <tr key={order.id}>
                  <td className="font-semibold">
                    {new Date(order.actual_date || order.requested_date).toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                    {order.actual_date && order.actual_date !== order.requested_date && (
                      <span style={{ color: 'var(--portal-status-modified)', fontSize: 'var(--portal-text-xs)', display: 'block' }}>
                        (moved from {new Date(order.requested_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                      </span>
                    )}
                  </td>
                  <td className="text-muted">
                    {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                  </td>
                  <td>
                    <span className={`invoice-badge ${STATUS_CLASSES[order.status] || ''}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="text-muted" style={{ fontSize: 'var(--portal-text-xs)', maxWidth: '200px' }}>
                    {order.operator_notes && <div><strong>Operator:</strong> {order.operator_notes}</div>}
                    {order.modification_summary && <div>{order.modification_summary}</div>}
                    {order.customer_notes && <div>{order.customer_notes}</div>}
                    {order.cancelled_reason && <div style={{ color: 'var(--portal-status-cancelled)' }}>{order.cancelled_reason}</div>}
                  </td>
                  <td>
                    {order.status === 'submitted' && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancelling === order.id}
                        style={{
                          background: 'none',
                          border: '1px solid var(--portal-status-cancelled)',
                          color: 'var(--portal-status-cancelled)',
                          padding: '2px 8px',
                          borderRadius: 'var(--portal-radius-sm)',
                          fontSize: 'var(--portal-text-xs)',
                          cursor: 'pointer',
                        }}
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
