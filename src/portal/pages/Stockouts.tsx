import { useState, type FormEvent } from 'react'
import { useStockouts } from '../hooks/useStockouts'
import { useOrders } from '../hooks/useOrders'

const STATUS_BADGES: Record<string, string> = {
  submitted: 'badge-pending',
  acknowledged: 'badge-modified',
  resolved: 'badge-paid',
  cancelled: 'badge-cancelled',
}

export function Stockouts() {
  const { requests, loading, error, submitRequest } = useStockouts()
  const { products } = useOrders()

  const [showForm, setShowForm] = useState(false)
  const [productId, setProductId] = useState<string>('')
  const [otherProduct, setOtherProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'urgent'>('normal')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const resetForm = () => {
    setProductId('')
    setOtherProduct('')
    setQuantity('')
    setUrgency('normal')
    setMessage('')
    setFormError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const isOther = productId === 'other'
    if (!productId && !otherProduct) {
      setFormError('Please select a product or describe what you need.')
      return
    }

    try {
      await submitRequest.mutateAsync({
        product_id: isOther || !productId ? null : productId,
        product_name_text: isOther ? otherProduct : null,
        quantity_needed: quantity ? parseFloat(quantity) : null,
        urgency,
        message: message || null,
      })
      resetForm()
      setShowForm(false)
    } catch (err) {
      setFormError((err as Error).message || 'Failed to submit request')
    }
  }

  if (loading) return <div className="odin-loading">Loading...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load stockout requests</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Stockout Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">Report urgent restock requests</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          {showForm ? 'Cancel' : 'New Request'}
        </button>
      </header>

      {/* Submit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="odin-card p-4 mb-6 max-w-[480px]">
          {formError && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-3">{formError}</div>
          )}

          <div className="grid gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Product *</label>
              <select
                value={productId}
                onChange={e => setProductId(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-white odin-focus"
              >
                <option value="">Select a product</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.strain ? ` (${p.strain})` : ''}</option>
                ))}
                <option value="other">Other (not listed)</option>
              </select>
            </div>

            {productId === 'other' && (
              <div>
                <label className="block text-sm font-medium mb-1">Product name *</label>
                <input
                  value={otherProduct}
                  onChange={e => setOtherProduct(e.target.value)}
                  placeholder="Describe the product"
                  required
                  className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-white odin-focus"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Quantity needed (kg)</label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="Optional"
                min="0.1"
                step="0.1"
                className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-white odin-focus"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Urgency</label>
              <div className="flex gap-4">
                {(['low', 'normal', 'urgent'] as const).map(level => (
                  <label key={level} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="urgency"
                      value={level}
                      checked={urgency === level}
                      onChange={() => setUrgency(level)}
                      className="accent-primary"
                    />
                    <span className="capitalize">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Any additional details"
                rows={2}
                className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-white resize-y odin-focus"
              />
            </div>

            <button
              type="submit"
              disabled={submitRequest.isPending}
              className="bg-primary text-primary-foreground px-4 py-2.5 rounded-md text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitRequest.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      {/* Request history */}
      {requests.length === 0 ? (
        <div className="odin-empty">
          <p>No stockout requests submitted.</p>
        </div>
      ) : (
        <div className="odin-table-container overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="odin-table-header">
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Date</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Product</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Qty</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Urgency</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Status</th>
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide">Staff Notes</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.id} className="odin-table-row">
                  <td className="odin-table-cell text-muted-foreground text-xs">
                    {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="odin-table-cell font-semibold">
                    {req.product_name_text || products.find(p => p.id === req.product_id)?.name || 'Unknown'}
                  </td>
                  <td className="odin-table-cell text-muted-foreground">
                    {req.quantity_needed != null ? `${req.quantity_needed}kg` : '—'}
                  </td>
                  <td className="odin-table-cell">
                    <span className={`badge ${req.urgency === 'urgent' ? 'badge-cancelled' : req.urgency === 'normal' ? 'badge-modified' : 'badge-draft'}`}>
                      {req.urgency}
                    </span>
                  </td>
                  <td className="odin-table-cell">
                    <span className={`badge ${STATUS_BADGES[req.status] || 'badge-draft'}`}>{req.status}</span>
                  </td>
                  <td className="odin-table-cell text-muted-foreground text-xs max-w-[200px] truncate">
                    {req.staff_notes || '—'}
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
