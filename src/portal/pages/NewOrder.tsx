import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrders } from '../hooks/useOrders'
import { useCustomer } from '../hooks/useCustomer'

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

  const allowedDays = deliverySchedules.map(s => s.day_of_week)

  const isDateAllowed = (dateStr: string) => {
    if (allowedDays.length === 0) return true
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

  const inputClass = 'w-full px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground odin-focus'
  const selectSmClass = 'w-full p-1.5 border border-input rounded text-sm bg-white odin-focus'

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">New Order</h1>
          <p className="text-sm text-muted-foreground mt-1">Place a one-off order for delivery</p>
        </div>
      </header>

      {allowedDays.length > 0 && (
        <div className="px-4 py-2.5 bg-blue-50 rounded-md text-sm text-blue-800 mb-6">
          Your delivery days: <strong>{allowedDays.map(d => DAY_NAMES[d]).join(', ')}</strong>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-[640px]">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-4">{error}</div>
        )}

        {/* Branch selector */}
        {branches.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Delivery location</label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className={inputClass}>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} — {b.address_line_1 || 'No address'}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Delivery date *</label>
          <input
            type="date"
            value={requestedDate}
            onChange={e => setRequestedDate(e.target.value)}
            required
            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            className={inputClass}
          />
        </div>

        {/* Items */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium">Items</label>
            <button
              type="button"
              onClick={addItem}
              className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
            >
              + Add Item
            </button>
          </div>

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No items added yet. Click "Add Item" to start your order.
            </p>
          )}

          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-end p-3 bg-muted rounded-md mb-2">
              <div>
                <label className="text-xs text-muted-foreground">Product</label>
                <select
                  value={item.product_id}
                  onChange={e => updateItem(index, 'product_id', e.target.value)}
                  className={selectSmClass}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.strain ? ` (${p.strain})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <select
                  value={item.product_type_id}
                  onChange={e => updateItem(index, 'product_type_id', e.target.value)}
                  className={selectSmClass}
                >
                  {productTypes.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Qty (kg)</label>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  min="0.1"
                  step="0.1"
                  className="w-20 p-1.5 border border-input rounded text-sm bg-white odin-focus"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-red-500 bg-transparent border-none cursor-pointer text-lg p-1 hover:text-red-700"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Notes (optional)</label>
          <textarea
            value={customerNotes}
            onChange={e => setCustomerNotes(e.target.value)}
            placeholder="Any special instructions for this order"
            rows={2}
            className="w-full px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground resize-y odin-focus"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitOrder.isPending || items.length === 0}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-md text-base font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitOrder.isPending ? 'Submitting...' : 'Submit Order'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/portal/orders')}
            className="bg-transparent border border-border px-6 py-3 rounded-md text-base cursor-pointer text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
