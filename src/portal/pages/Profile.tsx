import { useState } from 'react'
import { useCustomer } from '../hooks/useCustomer'
import { useAuthContext } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function Profile() {
  const { portalUser } = useAuthContext()
  const { customer, branches, deliverySchedules, loading, error } = useCustomer()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleUpdateProfile = async (field: string, value: string) => {
    if (!customer) return
    setSaving(true)
    setMessage(null)

    const { error: updateError } = await supabase
      .from('customers')
      .update({ [field]: value })
      .eq('id', customer.id)

    if (updateError) {
      setMessage('Failed to update: ' + updateError.message)
    } else {
      setMessage('Updated successfully')
      setTimeout(() => setMessage(null), 3000)
    }
    setSaving(false)
  }

  if (loading) return <div className="odin-loading">Loading profile...</div>
  if (error) return <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">Failed to load profile</div>

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Your business details and delivery preferences</p>
        </div>
      </header>

      {message && (
        <div className={`px-4 py-2.5 rounded-md text-sm mb-4 ${
          message.startsWith('Failed')
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="grid gap-6">
        {/* Business Details */}
        <section className="odin-card p-6">
          <h2 className="text-lg font-semibold mb-4">Business Details</h2>
          <div className="grid gap-2.5 text-sm">
            <div><strong>Business name:</strong> {customer?.name}</div>
            <div><strong>Email:</strong> {customer?.email}</div>
            <div><strong>Phone:</strong> {customer?.phone || 'Not set'}</div>
            <div><strong>Payment terms:</strong> {customer?.payment_terms ? `${customer.payment_terms} days` : 'Not set'}</div>
            <div><strong>Delivery method:</strong> {customer?.transmission || 'Not set'}</div>
            <div><strong>Portal user:</strong> {portalUser?.display_name} ({portalUser?.email})</div>
            <div><strong>Role:</strong> {portalUser?.role === 'admin' ? 'Account Admin' : 'Member'}</div>
          </div>
        </section>

        {/* Branches */}
        <section className="odin-card p-6">
          <h2 className="text-lg font-semibold mb-4">Delivery Locations</h2>
          {branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No delivery locations configured.</p>
          ) : (
            <div className="grid gap-4">
              {branches.map(branch => (
                <div key={branch.id} className="pb-3 border-b border-border last:border-b-0">
                  <strong>{branch.name}</strong>
                  <span className="text-muted-foreground text-xs ml-3">{branch.branch_type}</span>
                  {branch.address_line_1 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {[branch.address_line_1, branch.city, branch.postcode].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Delivery Schedule */}
        <section className="odin-card p-6">
          <h2 className="text-lg font-semibold mb-4">Delivery Schedule</h2>
          {deliverySchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No delivery days configured. Contact us to set up your delivery schedule.
            </p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {deliverySchedules.map(s => (
                <span key={s.id} className="badge badge-paid">
                  {DAY_NAMES[s.day_of_week]}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
