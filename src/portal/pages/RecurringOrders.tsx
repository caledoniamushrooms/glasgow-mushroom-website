import { useState, type FormEvent } from 'react'
import { useRecurringOrders } from '../hooks/useRecurringOrders'
import { useOrders } from '../hooks/useOrders'
import { useCustomer } from '../hooks/useCustomer'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface NewItem {
  product_type_id: string
  quantity: number
}

export function RecurringOrders() {
  const { recurringOrders, createRecurring, cancelRecurring, loading, error } = useRecurringOrders()
  const { upcomingOrders, products, productTypes } = useOrders()
  const { branches, deliverySchedules } = useCustomer()
  const [cancelling, setCancelling] = useState<string | null>(null)

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [items, setItems] = useState<NewItem[]>([])
  const [createError, setCreateError] = useState<string | null>(null)

  const scheduleItems = buildSchedule(upcomingOrders, recurringOrders, deliverySchedules)
  const allowedDays = deliverySchedules.map(s => s.day_of_week)

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

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const addItem = () => {
    if (productTypes.length === 0) return
    setItems(prev => [...prev, { product_type_id: productTypes[0].id, quantity: 1 }])
  }

  const updateItem = (index: number, field: keyof NewItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const resetForm = () => {
    setName('')
    setBranchId(branches[0]?.id || '')
    setSelectedDays([])
    setItems([])
    setCreateError(null)
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (selectedDays.length === 0) {
      setCreateError('Please select at least one delivery day.')
      return
    }
    if (items.length === 0) {
      setCreateError('Please add at least one item.')
      return
    }

    try {
      await createRecurring.mutateAsync({
        name: name || 'Standing order',
        branch_id: branchId || null,
        days_of_week: selectedDays,
        items: items.map(i => ({ product_type_id: i.product_type_id, quantity: i.quantity })),
      })
      resetForm()
      setShowCreate(false)
    } catch (err) {
      setCreateError((err as Error).message || 'Failed to create recurring order')
    }
  }

  if (loading) return <div className="odin-loading">Loading...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load recurring orders</div>

  const selectSmClass = 'w-full p-1.5 border border-input rounded text-sm bg-white odin-focus'

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Recurring Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Your standing orders and upcoming delivery schedule</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); if (showCreate) resetForm() }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          {showCreate ? 'Cancel' : 'New Recurring Order'}
        </button>
      </header>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="odin-card p-4 mb-6 max-w-[560px]">
          {createError && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm mb-3">{createError}</div>
          )}

          <div className="grid gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Weekly standard order"
                className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-white odin-focus"
              />
            </div>

            {branches.length > 1 && (
              <div>
                <label className="block text-sm font-medium mb-1">Delivery location</label>
                <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-white odin-focus">
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Delivery days *</label>
              <div className="flex gap-2 flex-wrap">
                {DAY_NAMES.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                      selectedDays.includes(i)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {allowedDays.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your delivery days: {allowedDays.map(d => DAY_NAMES[d]).join(', ')}
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Items *</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:opacity-90"
                >
                  + Add Item
                </button>
              </div>
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground">No items added yet.</p>
              )}
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end p-2 bg-muted rounded-md mb-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Product</label>
                    <select value={products.find(p => productTypes.find(pt => pt.id === item.product_type_id))?.id || ''} onChange={e => {
                      const firstType = productTypes[0]
                      if (firstType) updateItem(index, 'product_type_id', firstType.id)
                    }} className={selectSmClass}>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
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

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={createRecurring.isPending}
                className="bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-semibold cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createRecurring.isPending ? 'Creating...' : 'Create Recurring Order'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); resetForm() }}
                className="bg-transparent border border-border px-5 py-2.5 rounded-md text-sm cursor-pointer text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

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
            <p>No recurring orders set up yet.</p>
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
