import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { PortalUser } from '../lib/types'
import '../pages/Login.css'

export function Onboarding() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null)
  const [formData, setFormData] = useState({
    display_name: '',
    phone: '',
    address_line_1: '',
    city: '',
    postcode: '',
  })

  useEffect(() => {
    checkOnboardingStatus()
  }, [])

  const checkOnboardingStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      navigate('/portal/login')
      return
    }

    // Check if portal_user already exists and is active
    const { data: existingUser } = await supabase
      .from('portal_users')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .single()

    if (existingUser?.status === 'active') {
      navigate('/portal')
      return
    }

    if (existingUser) {
      setPortalUser(existingUser)
      setFormData(prev => ({
        ...prev,
        display_name: existingUser.display_name || '',
      }))
    }

    setLoading(false)
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      // Update portal user to active
      if (portalUser) {
        const { error: updateError } = await supabase
          .from('portal_users')
          .update({
            display_name: formData.display_name,
            status: 'active',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', portalUser.id)

        if (updateError) throw updateError
      }

      // Update customer profile if we have address info
      if (portalUser?.customer_id && formData.address_line_1) {
        await supabase
          .from('branches')
          .update({
            address_line_1: formData.address_line_1,
            city: formData.city,
            postcode: formData.postcode,
          })
          .eq('customer_id', portalUser.customer_id)
          .eq('branch_type', 'company')
      }

      // Refresh the session to pick up new JWT claims
      await supabase.auth.refreshSession()

      navigate('/portal')
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p className="login-loading">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: '480px' }}>
        <div className="login-brand">
          <h1>Glasgow Mushroom Co.</h1>
          <p>Complete Your Profile</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error" role="alert">{error}</div>}

          <p style={{ color: 'var(--portal-text-muted)', fontSize: 'var(--portal-text-sm)' }}>
            Welcome! Please review and complete your details to get started.
          </p>

          <div className="login-field">
            <label htmlFor="display_name">Your name *</label>
            <input
              id="display_name"
              type="text"
              value={formData.display_name}
              onChange={e => handleChange('display_name', e.target.value)}
              placeholder="Your full name"
              required
              autoFocus
            />
          </div>

          <div className="login-field">
            <label htmlFor="ob_phone">Phone number</label>
            <input
              id="ob_phone"
              type="tel"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="login-field">
            <label htmlFor="address">Delivery address</label>
            <input
              id="address"
              type="text"
              value={formData.address_line_1}
              onChange={e => handleChange('address_line_1', e.target.value)}
              placeholder="Street address"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--portal-space-sm)' }}>
            <div className="login-field">
              <label htmlFor="city">City</label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={e => handleChange('city', e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="login-field">
              <label htmlFor="postcode">Postcode</label>
              <input
                id="postcode"
                type="text"
                value={formData.postcode}
                onChange={e => handleChange('postcode', e.target.value)}
                placeholder="Postcode"
              />
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  )
}
