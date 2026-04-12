import { useState } from 'react'
import { useAdminCustomers } from '../../hooks/useAdminCustomers'
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from '../../lib/modules'

export function Customers() {
  const { customers, loading, error, toggleModule } = useAdminCustomers()
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  const filtered = search
    ? customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
      )
    : customers

  const handleToggle = async (customerId: string, moduleKey: ModuleKey, currentValue: boolean) => {
    const key = `${customerId}-${moduleKey}`
    setToggling(key)
    try {
      await toggleModule.mutateAsync({ customerId, moduleKey, enabled: !currentValue })
    } catch (err) {
      console.error('Failed to toggle module:', err)
    }
    setToggling(null)
  }

  if (loading) return <div className="odin-loading">Loading customers...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load customers</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer accounts and module access ({customers.length} total)
          </p>
        </div>
      </header>

      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full max-w-[320px] px-3 py-2.5 border border-input rounded-md text-sm bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="odin-empty">
          <p>{search ? 'No customers match your search.' : 'No customers found.'}</p>
        </div>
      ) : (
        <div className="odin-table-container overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="odin-table-header">
                <th className="odin-table-cell text-left text-xs uppercase tracking-wide sticky left-0 bg-white z-10">Customer</th>
                {MODULE_KEYS.map(key => (
                  <th key={key} className="odin-table-cell text-center text-xs uppercase tracking-wide whitespace-nowrap">
                    {MODULE_LABELS[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(customer => (
                <tr key={customer.id} className="odin-table-row">
                  <td className="odin-table-cell sticky left-0 bg-white z-10">
                    <div className="font-semibold">{customer.name}</div>
                    <div className="text-xs text-muted-foreground">{customer.email}</div>
                  </td>
                  {MODULE_KEYS.map(key => {
                    const toggleKey = `${customer.id}-${key}`
                    const isToggling = toggling === toggleKey
                    return (
                      <td key={key} className="odin-table-cell text-center">
                        <input
                          type="checkbox"
                          checked={customer.modules[key]}
                          onChange={() => handleToggle(customer.id, key, customer.modules[key])}
                          disabled={isToggling}
                          className="w-4 h-4 accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
