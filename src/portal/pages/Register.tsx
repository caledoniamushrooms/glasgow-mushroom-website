import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../pages/Login.css'

export function Register() {
  const [formData, setFormData] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('portal_registration_requests')
        .insert({
          business_name: formData.business_name,
          contact_name: formData.contact_name,
          email: formData.email,
          phone: formData.phone || null,
          message: formData.message || null,
        })

      if (insertError) throw insertError
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Failed to submit registration. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <h1>Glasgow Mushroom Co.</h1>
            <p>Registration Submitted</p>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--portal-space-lg) 0' }}>
            <p style={{ color: 'var(--portal-text)', marginBottom: 'var(--portal-space-md)' }}>
              Thank you for your interest! We've received your registration request and will
              be in touch shortly with an invitation to set up your account.
            </p>
            <p style={{ color: 'var(--portal-text-muted)', fontSize: 'var(--portal-text-sm)' }}>
              If you have any questions, please contact us at{' '}
              <a href="mailto:wholesale@glasgowmushroomcompany.com" style={{ color: 'var(--portal-green)' }}>
                wholesale@glasgowmushroomcompany.com
              </a>
            </p>
          </div>
          <div className="login-back">
            <a href="/home">&larr; Back to Glasgow Mushroom Co.</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: '480px' }}>
        <div className="login-brand">
          <h1>Glasgow Mushroom Co.</h1>
          <p>Register as a B2B Customer</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error" role="alert">{error}</div>}

          <div className="login-field">
            <label htmlFor="business_name">Business name *</label>
            <input
              id="business_name"
              type="text"
              value={formData.business_name}
              onChange={e => handleChange('business_name', e.target.value)}
              placeholder="Your business name"
              required
              autoFocus
            />
          </div>

          <div className="login-field">
            <label htmlFor="contact_name">Contact name *</label>
            <input
              id="contact_name"
              type="text"
              value={formData.contact_name}
              onChange={e => handleChange('contact_name', e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="reg_email">Email address *</label>
            <input
              id="reg_email"
              type="email"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="you@business.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="login-field">
            <label htmlFor="message">Tell us about your business</label>
            <textarea
              id="message"
              value={formData.message}
              onChange={e => handleChange('message', e.target.value)}
              placeholder="What products are you interested in? Estimated weekly volumes?"
              rows={3}
              style={{
                padding: '10px 12px',
                border: '1px solid var(--portal-border)',
                borderRadius: 'var(--portal-radius-sm)',
                fontSize: 'var(--portal-text-base)',
                fontFamily: 'var(--portal-font-body)',
                color: 'var(--portal-text)',
                background: 'var(--portal-white)',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Registration'}
          </button>

          <div className="login-links">
            <Link to="/portal/login">Already have an account? Sign in</Link>
          </div>
        </form>

        <div className="login-back">
          <a href="/home">&larr; Back to Glasgow Mushroom Co.</a>
        </div>
      </div>
    </div>
  )
}
