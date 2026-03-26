import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { PortalUser } from '../lib/types'

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
      <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4" style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 w-full max-w-[400px] bg-white rounded-xl shadow-lg p-8">
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4" style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 w-full max-w-[480px] bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-foreground">Glasgow Mushroom Co.</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete Your Profile</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm" role="alert">{error}</div>
          )}

          <p className="text-sm text-muted-foreground">
            Welcome! Please review and complete your details to get started.
          </p>

          <div className="flex flex-col gap-1">
            <label htmlFor="display_name" className="text-sm font-medium text-foreground">Your name *</label>
            <input
              id="display_name"
              type="text"
              value={formData.display_name}
              onChange={e => handleChange('display_name', e.target.value)}
              placeholder="Your full name"
              required
              autoFocus
              className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ob_phone" className="text-sm font-medium text-foreground">Phone number</label>
            <input
              id="ob_phone"
              type="tel"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="Optional"
              className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="address" className="text-sm font-medium text-foreground">Delivery address</label>
            <input
              id="address"
              type="text"
              value={formData.address_line_1}
              onChange={e => handleChange('address_line_1', e.target.value)}
              placeholder="Street address"
              className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="city" className="text-sm font-medium text-foreground">City</label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={e => handleChange('city', e.target.value)}
                placeholder="City"
                className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="postcode" className="text-sm font-medium text-foreground">Postcode</label>
              <input
                id="postcode"
                type="text"
                value={formData.postcode}
                onChange={e => handleChange('postcode', e.target.value)}
                placeholder="Postcode"
                className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
              />
            </div>
          </div>

          <button type="submit" className="py-3 bg-primary text-primary-foreground rounded-md text-base font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
            {submitting ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  )
}
