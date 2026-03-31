import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrders } from '../hooks/useOrders'
import { useCustomer } from '../hooks/useCustomer'
import { useAuthContext } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'

interface OrderItem {
  product_id: string
  product_type_id: string
  quantity: number
  estimated_price: number | null
}

export function StockoutReport() {
  const navigate = useNavigate()
  const { products, productTypes } = useOrders()
  const { portalUser } = useAuthContext()
  const { branches } = useCustomer()

  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '')
  const [customerNotes, setCustomerNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
      setError('Please add at least one item you need restocked.')
      return
    }

    if (!portalUser) {
      setError('Not authenticated')
      return
    }

    setSubmitting(true)

    try {
      // Create urgent order — use tomorrow as default date
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const { data: portalOrder, error: orderError } = await supabase
        .from('portal_orders')
        .insert({
          customer_id: portalUser.customer_id,
          branch_id: branchId || null,
          portal_user_id: portalUser.id,
          requested_date: tomorrow,
          customer_notes: customerNotes || 'Stockout — urgent restock request',
          status: 'submitted',
          is_urgent: true,
        })
        .select()
        .single()

      if (orderError) throw orderError

      const orderItems = items.map(item => ({
        portal_order_id: portalOrder.id,
        product_id: item.product_id,
        product_type_id: item.product_type_id,
        quantity: item.quantity,
        estimated_price: item.estimated_price,
      }))

      const { error: itemsError } = await supabase
        .from('portal_order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      navigate('/portal/orders')
    } catch (err) {
      setError((err as Error).message || 'Failed to submit stockout report')
    } finally {
      setSubmitting(false)
    }
  }

  const selectSmClass = 'w-full p-1.5 border border-input rounded text-sm bg-white odin-focus'

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Report Stockout</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Need an urgent restock? Tell us what you're running low on and we'll prioritise it.
        </p>
      </header>

      <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-800 mb-6">
        This will be flagged as <strong>urgent</strong> and prioritised by our team.
      </div>

      <form onSubmit={handleSubmit} className="max-w-[640px]">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-4">{error}</div>
        )}

        {branches.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Location</label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="w-full px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground odin-focus"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} — {b.address_line_1 || 'No address'}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium">What do you need?</label>
            <button
              type="button"
              onClick={addItem}
              className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
            >
              + Add Item
            </button>
          </div>

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Add the products you need restocked.</p>
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

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Additional details</label>
          <textarea
            value={customerNotes}
            onChange={e => setCustomerNotes(e.target.value)}
            placeholder="When do you need this by? Any other details?"
            rows={2}
            className="w-full px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground resize-y odin-focus"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="bg-red-600 text-white px-6 py-3 rounded-md text-base font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Urgent Request'}
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
