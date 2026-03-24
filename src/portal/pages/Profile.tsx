import { useState } from 'react'
import { useCustomer } from '../hooks/useCustomer'
import { useAuthContext } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import './Invoices.css'

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

  if (loading) return <div className="portal-loading">Loading profile...</div>
  if (error) return <div className="portal-error">Failed to load profile</div>

  return (
    <div>
      <header className="invoices-header">
        <div>
          <h1>Profile</h1>
          <p>Your business details and delivery preferences</p>
        </div>
      </header>

      {message && (
        <div style={{
          padding: 'var(--portal-space-sm) var(--portal-space-md)',
          background: message.startsWith('Failed') ? 'hsl(0 72% 97%)' : 'hsl(142 71% 95%)',
          border: `1px solid ${message.startsWith('Failed') ? 'hsl(0 72% 90%)' : 'hsl(142 71% 85%)'}`,
          borderRadius: 'var(--portal-radius-sm)',
          color: message.startsWith('Failed') ? 'hsl(0 72% 40%)' : 'hsl(142 71% 25%)',
          fontSize: 'var(--portal-text-sm)',
          marginBottom: 'var(--portal-space-md)',
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gap: 'var(--portal-space-lg)' }}>
        {/* Business Details */}
        <section className="invoices-table-wrap" style={{ padding: 'var(--portal-space-lg)' }}>
          <h2 style={{ fontSize: 'var(--portal-text-lg)', fontWeight: 600, marginBottom: 'var(--portal-space-md)' }}>
            Business Details
          </h2>
          <div style={{ display: 'grid', gap: 'var(--portal-space-sm)', fontSize: 'var(--portal-text-sm)' }}>
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
        <section className="invoices-table-wrap" style={{ padding: 'var(--portal-space-lg)' }}>
          <h2 style={{ fontSize: 'var(--portal-text-lg)', fontWeight: 600, marginBottom: 'var(--portal-space-md)' }}>
            Delivery Locations
          </h2>
          {branches.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 'var(--portal-text-sm)' }}>No delivery locations configured.</p>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--portal-space-md)' }}>
              {branches.map(branch => (
                <div key={branch.id} style={{ padding: 'var(--portal-space-sm)', borderBottom: '1px solid var(--portal-gray-100)' }}>
                  <strong>{branch.name}</strong>
                  <span className="text-muted" style={{ marginLeft: 'var(--portal-space-sm)', fontSize: 'var(--portal-text-xs)' }}>
                    {branch.branch_type}
                  </span>
                  {branch.address_line_1 && (
                    <p className="text-muted" style={{ fontSize: 'var(--portal-text-sm)', margin: '4px 0 0' }}>
                      {[branch.address_line_1, branch.city, branch.postcode].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Delivery Schedule */}
        <section className="invoices-table-wrap" style={{ padding: 'var(--portal-space-lg)' }}>
          <h2 style={{ fontSize: 'var(--portal-text-lg)', fontWeight: 600, marginBottom: 'var(--portal-space-md)' }}>
            Delivery Schedule
          </h2>
          {deliverySchedules.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 'var(--portal-text-sm)' }}>
              No delivery days configured. Contact us to set up your delivery schedule.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--portal-space-sm)', flexWrap: 'wrap' }}>
              {deliverySchedules.map(s => (
                <span key={s.id} className="invoice-badge badge-paid">
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
