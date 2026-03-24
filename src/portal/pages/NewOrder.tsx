import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrders } from '../hooks/useOrders'
import { useCustomer } from '../hooks/useCustomer'
import './Invoices.css'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface OrderItem {
  product_id: string
  product_type_id: string
  quantity: number
  estimated_price: number | null
}

export function NewOrder() {
  const navigate = useNavigate()
  const { products, productTypes, submitOrder } = useOrders()
  const { branches, deliverySchedules } = useCustomer()

  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '')
  const [requestedDate, setRequestedDate] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [error, setError] = useState<string | null>(null)

  // Get allowed days for the date picker
  const allowedDays = deliverySchedules.map(s => s.day_of_week)

  const isDateAllowed = (dateStr: string) => {
    if (allowedDays.length === 0) return true // no restrictions if none configured
    const date = new Date(dateStr)
    return allowedDays.includes(date.getDay())
  }

  const addItem = () => {
    if (products.length === 0) return
    const defaultType = productTypes[0]
    setItems(prev => [...prev, {
      product_id: products[0].id,
      product_type_id: defaultType?.id || '',
      quantity: 1,
      estimated_price: null,
    }])
  }

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (items.length === 0) {
      setError('Please add at least one item to your order.')
      return
    }

    if (requestedDate && !isDateAllowed(requestedDate)) {
      setError(`Selected date is not a scheduled delivery day. Your delivery days are: ${allowedDays.map(d => DAY_NAMES[d]).join(', ')}`)
      return
    }

    try {
      await submitOrder.mutateAsync({
        branch_id: branchId || null,
        requested_date: requestedDate,
        customer_notes: customerNotes,
        items,
      })
      navigate('/portal/orders')
    } catch (err) {
      setError((err as Error).message || 'Failed to submit order')
    }
  }

  return (
    <div>
      <header className="invoices-header">
        <div>
          <h1>New Order</h1>
          <p>Place a one-off order for delivery</p>
        </div>
      </header>

      {allowedDays.length > 0 && (
        <div style={{
          padding: 'var(--portal-space-sm) var(--portal-space-md)',
          background: 'hsl(213 94% 95%)',
          borderRadius: 'var(--portal-radius-sm)',
          fontSize: 'var(--portal-text-sm)',
          color: 'hsl(213 94% 30%)',
          marginBottom: 'var(--portal-space-lg)',
        }}>
          Your delivery days: <strong>{allowedDays.map(d => DAY_NAMES[d]).join(', ')}</strong>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '640px' }}>
        {error && <div className="portal-error" style={{ marginBottom: 'var(--portal-space-md)' }}>{error}</div>}

        {/* Branch selector */}
        {branches.length > 1 && (
          <div style={{ marginBottom: 'var(--portal-space-md)' }}>
            <label style={{ display: 'block', fontWeight: 500, fontSize: 'var(--portal-text-sm)', marginBottom: '4px' }}>
              Delivery location
            </label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid var(--portal-border)',
                borderRadius: 'var(--portal-radius-sm)', fontSize: 'var(--portal-text-base)',
                fontFamily: 'var(--portal-font-body)', background: 'var(--portal-white)',
              }}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} — {b.address_line_1 || 'No address'}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date */}
        <div style={{ marginBottom: 'var(--portal-space-md)' }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 'var(--portal-text-sm)', marginBottom: '4px' }}>
            Delivery date *
          </label>
          <input
            type="date"
            value={requestedDate}
            onChange={e => setRequestedDate(e.target.value)}
            required
            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--portal-border)',
              borderRadius: 'var(--portal-radius-sm)', fontSize: 'var(--portal-text-base)',
              fontFamily: 'var(--portal-font-body)',
            }}
          />
        </div>

        {/* Items */}
        <div style={{ marginBottom: 'var(--portal-space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--portal-space-sm)' }}>
            <label style={{ fontWeight: 500, fontSize: 'var(--portal-text-sm)' }}>Items</label>
            <button
              type="button"
              onClick={addItem}
              style={{
                background: 'var(--portal-green)', color: 'var(--portal-white)',
                border: 'none', padding: '4px 12px', borderRadius: 'var(--portal-radius-sm)',
                fontSize: 'var(--portal-text-xs)', cursor: 'pointer', fontWeight: 600,
              }}
            >
              + Add Item
            </button>
          </div>

          {items.length === 0 && (
            <p style={{ color: 'var(--portal-text-muted)', fontSize: 'var(--portal-text-sm)' }}>
              No items added yet. Click "Add Item" to start your order.
            </p>
          )}

          {items.map((item, index) => (
            <div key={index} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr auto auto',
              gap: 'var(--portal-space-sm)', alignItems: 'end',
              padding: 'var(--portal-space-sm)', background: 'var(--portal-gray-50)',
              borderRadius: 'var(--portal-radius-sm)', marginBottom: 'var(--portal-space-xs)',
            }}>
              <div>
                <label style={{ fontSize: 'var(--portal-text-xs)', color: 'var(--portal-text-muted)' }}>Product</label>
                <select
                  value={item.product_id}
                  onChange={e => updateItem(index, 'product_id', e.target.value)}
                  style={{ width: '100%', padding: '6px', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)', fontSize: 'var(--portal-text-sm)' }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.strain ? ` (${p.strain})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--portal-text-xs)', color: 'var(--portal-text-muted)' }}>Type</label>
                <select
                  value={item.product_type_id}
                  onChange={e => updateItem(index, 'product_type_id', e.target.value)}
                  style={{ width: '100%', padding: '6px', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)', fontSize: 'var(--portal-text-sm)' }}
                >
                  {productTypes.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--portal-text-xs)', color: 'var(--portal-text-muted)' }}>Qty (kg)</label>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  min="0.1"
                  step="0.1"
                  style={{ width: '80px', padding: '6px', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)', fontSize: 'var(--portal-text-sm)' }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                style={{ background: 'none', border: 'none', color: 'var(--portal-status-cancelled)', cursor: 'pointer', fontSize: 'var(--portal-text-lg)', padding: '4px' }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 'var(--portal-space-lg)' }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 'var(--portal-text-sm)', marginBottom: '4px' }}>
            Notes (optional)
          </label>
          <textarea
            value={customerNotes}
            onChange={e => setCustomerNotes(e.target.value)}
            placeholder="Any special instructions for this order"
            rows={2}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--portal-border)',
              borderRadius: 'var(--portal-radius-sm)', fontSize: 'var(--portal-text-base)',
              fontFamily: 'var(--portal-font-body)', resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--portal-space-sm)' }}>
          <button
            type="submit"
            disabled={submitOrder.isPending || items.length === 0}
            style={{
              background: 'var(--portal-green)', color: 'var(--portal-white)',
              border: 'none', padding: '12px 24px', borderRadius: 'var(--portal-radius-sm)',
              fontSize: 'var(--portal-text-base)', fontWeight: 600, cursor: 'pointer',
              opacity: submitOrder.isPending || items.length === 0 ? 0.6 : 1,
            }}
          >
            {submitOrder.isPending ? 'Submitting...' : 'Submit Order'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/portal/orders')}
            style={{
              background: 'none', border: '1px solid var(--portal-border)',
              padding: '12px 24px', borderRadius: 'var(--portal-radius-sm)',
              fontSize: 'var(--portal-text-base)', cursor: 'pointer',
              color: 'var(--portal-text-muted)',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
