import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrders } from '../hooks/useOrders'
import type { PortalOrder } from '../lib/types'

// Map DB statuses to spec-friendly display labels
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Requested',
  confirmed: 'Confirmed',
  modified: 'Modified',
  cancelled: 'Cancelled',
  fulfilled: 'Delivered',
}

const STATUS_CLASSES: Record<string, string> = {
  submitted: 'badge badge-pending',
  confirmed: 'badge badge-paid',
  modified: 'badge badge-modified',
  cancelled: 'badge badge-cancelled',
  fulfilled: 'badge badge-paid',
}

export function Orders() {
  const { orders, upcomingOrders, products, productTypes, cancelOrder, loading, error } = useOrders()
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<PortalOrder | null>(null)

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

  const getProductName = (productId: string) => {
    const p = products.find(x => x.id === productId)
    return p ? `${p.name}${p.strain ? ` (${p.strain})` : ''}` : 'Unknown'
  }

  const getTypeName = (typeId: string) => {
    return productTypes.find(x => x.id === typeId)?.name || 'Unknown'
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
        <div className="flex gap-2">
          <Link
            to="/portal/orders/stockout"
            className="bg-transparent border border-red-500 text-red-600 px-4 py-2 rounded-md no-underline font-semibold text-sm hover:bg-red-50 transition-colors"
          >
            Report Stockout
          </Link>
          <Link
            to="/portal/orders/new"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md no-underline font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            New Order
          </Link>
        </div>
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
                <tr
                  key={order.id}
                  className="odin-table-row cursor-pointer hover:bg-muted/50"
                  onClick={() => setDetailOrder(order)}
                >
                  <td className="odin-table-cell font-semibold">
                    {new Date(order.actual_date || order.requested_date).toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                    {order.actual_date && order.actual_date !== order.requested_date && (
                      <span className="block text-xs text-blue-500">
                        (moved from {new Date(order.requested_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                      </span>
                    )}
                    {order.is_urgent && (
                      <span className="block text-xs text-red-600 font-semibold">URGENT</span>
                    )}
                  </td>
                  <td className="odin-table-cell text-muted-foreground">
                    {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="odin-table-cell">
                    <span className={STATUS_CLASSES[order.status] || 'badge'}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </td>
                  <td className="odin-table-cell text-muted-foreground text-xs max-w-[200px]">
                    {order.operator_notes && <div><strong>Operator:</strong> {order.operator_notes}</div>}
                    {order.modification_summary && <div>{order.modification_summary}</div>}
                    {order.customer_notes && <div>{order.customer_notes}</div>}
                    {order.cancelled_reason && <div className="text-red-500">{order.cancelled_reason}</div>}
                  </td>
                  <td className="odin-table-cell" onClick={e => e.stopPropagation()}>
                    {order.status === 'submitted' && (
                      <div className="flex gap-2">
                        <Link
                          to={`/portal/orders/${order.id}/edit`}
                          className="bg-transparent border border-primary text-primary px-2 py-0.5 rounded text-xs no-underline hover:bg-primary/5 transition-colors"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleCancel(order.id)}
                          disabled={cancelling === order.id}
                          className="bg-transparent border border-red-500 text-red-500 px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {cancelling === order.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order detail modal */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailOrder(null)}>
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-[500px] w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Order Details</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(detailOrder.actual_date || detailOrder.requested_date).toLocaleDateString('en-GB', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
              <span className={STATUS_CLASSES[detailOrder.status] || 'badge'}>
                {STATUS_LABELS[detailOrder.status] || detailOrder.status}
              </span>
            </div>

            {detailOrder.is_urgent && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-4 font-medium">
                Urgent / Stockout Request
              </div>
            )}

            {/* Items */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Items</h4>
              <div className="space-y-1.5">
                {(detailOrder.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b border-border last:border-b-0">
                    <span>
                      {getProductName(item.product_id)} — {getTypeName(item.product_type_id)}
                    </span>
                    <span className="font-medium">{item.quantity} kg</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status timeline */}
            {detailOrder.actual_date && detailOrder.actual_date !== detailOrder.requested_date && (
              <div className="px-3 py-2 bg-blue-50 rounded-md text-sm text-blue-800 mb-4">
                Date moved from {new Date(detailOrder.requested_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to {new Date(detailOrder.actual_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </div>
            )}

            {/* Notes */}
            {(detailOrder.operator_notes || detailOrder.modification_summary || detailOrder.customer_notes || detailOrder.cancelled_reason) && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-foreground mb-2">Notes</h4>
                <div className="space-y-2 text-sm">
                  {detailOrder.operator_notes && (
                    <div className="px-3 py-2 bg-muted rounded-md">
                      <span className="font-medium">Operator: </span>{detailOrder.operator_notes}
                    </div>
                  )}
                  {detailOrder.modification_summary && (
                    <div className="px-3 py-2 bg-amber-50 rounded-md text-amber-800">
                      <span className="font-medium">Modified: </span>{detailOrder.modification_summary}
                    </div>
                  )}
                  {detailOrder.customer_notes && (
                    <div className="px-3 py-2 bg-muted rounded-md">
                      <span className="font-medium">Your notes: </span>{detailOrder.customer_notes}
                    </div>
                  )}
                  {detailOrder.cancelled_reason && (
                    <div className="px-3 py-2 bg-red-50 rounded-md text-red-700">
                      <span className="font-medium">Cancellation: </span>{detailOrder.cancelled_reason}
                      {detailOrder.cancelled_by && ` (by ${detailOrder.cancelled_by})`}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailOrder(null)}
                className="bg-transparent border border-border px-4 py-2 rounded-md text-sm cursor-pointer text-muted-foreground hover:bg-accent transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
