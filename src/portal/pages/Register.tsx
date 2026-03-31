import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function Register() {
  const [formData, setFormData] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    message: '',
    preferred_fulfilment: '',
    sample_requested: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: string, value: string | boolean) => {
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
          preferred_fulfilment: formData.preferred_fulfilment || null,
          sample_requested: formData.sample_requested,
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
      <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4" style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 w-full max-w-[400px] bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-foreground">Glasgow Mushroom Co.</h1>
            <p className="text-sm text-muted-foreground mt-1">Registration Submitted</p>
          </div>
          <div className="text-center py-6">
            <p className="text-foreground mb-4">
              Thank you for your interest! We've received your registration request and will
              be in touch shortly with an invitation to set up your account.
            </p>
            <p className="text-sm text-muted-foreground">
              If you have any questions, please contact us at{' '}
              <a href="mailto:wholesale@glasgowmushroomcompany.com" className="text-primary hover:underline">
                wholesale@glasgowmushroomcompany.com
              </a>
            </p>
          </div>
          <div className="mt-8 pt-4 border-t border-border text-center">
            <a href="/home" className="text-sm text-muted-foreground no-underline hover:text-foreground transition-colors">
              &larr; Back to Glasgow Mushroom Co.
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4 py-12" style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 w-full max-w-[520px] bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-foreground">Glasgow Mushroom Co.</h1>
          <p className="text-sm text-muted-foreground mt-1">Register as a Trade Customer</p>
        </div>

        {/* What to expect panel */}
        <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6 text-sm">
          <p className="font-medium text-foreground mb-2">What to expect as a trade customer</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary shrink-0">&#10003;</span>
              <span><strong>Fulfilment options</strong> — delivery within our zone, collection from our farm, or courier nationwide</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">&#10003;</span>
              <span><strong>Wholesale pricing</strong> — tiered pricing based on your order volume</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">&#10003;</span>
              <span><strong>Simple ordering</strong> — place and manage orders online, with real-time status updates</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">&#10003;</span>
              <span><strong>Weekly invoicing</strong> — consolidated weekly invoices with online payment</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">&#10003;</span>
              <span><strong>Free samples</strong> — request a complimentary sample box to try our mushrooms</span>
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm" role="alert">{error}</div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="business_name" className="text-sm font-medium text-foreground">Business name *</label>
            <input
              id="business_name"
              type="text"
              value={formData.business_name}
              onChange={e => handleChange('business_name', e.target.value)}
              placeholder="Your business name"
              required
              autoFocus
              className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="contact_name" className="text-sm font-medium text-foreground">Contact name *</label>
            <input
              id="contact_name"
              type="text"
              value={formData.contact_name}
              onChange={e => handleChange('contact_name', e.target.value)}
              placeholder="Your full name"
              required
              className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="reg_email" className="text-sm font-medium text-foreground">Email address *</label>
            <input
              id="reg_email"
              type="email"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="you@business.com"
              required
              autoComplete="email"
              className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-sm font-medium text-foreground">Phone number</label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="Optional"
              className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="preferred_fulfilment" className="text-sm font-medium text-foreground">Preferred fulfilment</label>
            <select
              id="preferred_fulfilment"
              value={formData.preferred_fulfilment}
              onChange={e => handleChange('preferred_fulfilment', e.target.value)}
              className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground odin-focus"
            >
              <option value="">Select an option...</option>
              <option value="delivery">Delivery (within our delivery zone)</option>
              <option value="collection">Collection from farm</option>
              <option value="courier">Courier (nationwide)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="message" className="text-sm font-medium text-foreground">Tell us about your business</label>
            <textarea
              id="message"
              value={formData.message}
              onChange={e => handleChange('message', e.target.value)}
              placeholder="What products are you interested in? Estimated weekly volumes?"
              rows={3}
              className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 resize-y odin-focus"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.sample_requested}
              onChange={e => handleChange('sample_requested', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-input text-primary accent-primary"
            />
            <span className="text-sm text-foreground">
              I'd like to request a <strong>free sample box</strong> to try your mushrooms
            </span>
          </label>

          <button type="submit" className="py-3 bg-primary text-primary-foreground rounded-md text-base font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Registration'}
          </button>

          <div className="flex justify-between text-sm">
            <Link to="/portal/login" className="text-primary no-underline hover:underline">Already have an account? Sign in</Link>
          </div>
        </form>

        <div className="mt-8 pt-4 border-t border-border text-center">
          <a href="/home" className="text-sm text-muted-foreground no-underline hover:text-foreground transition-colors">
            &larr; Back to Glasgow Mushroom Co.
          </a>
        </div>
      </div>
    </div>
  )
}
