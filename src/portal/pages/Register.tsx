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
        <div className="fixed inset-0 bg-black/55" />
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

  const steps = [
    'Apply for an account',
    'Create and manage orders',
    'Manage sales account and much more',
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4 py-12" style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
      <div className="fixed inset-0 bg-black/55" />

      {/* Process flow — outside the card */}
      <h2 className="relative z-10 text-white text-4xl font-semibold text-center mb-3" style={{ fontFamily: "'Abhaya Libre', serif" }}>How it works</h2>
      <div className="relative z-10 w-full max-w-[720px] mb-8 bg-[#1a1a1a] border border-white/10 rounded-xl px-6 py-5 shadow-lg">
        <div className="grid grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <div key={step} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-white/15 border-2 border-white/50 flex items-center justify-center text-white text-base font-bold shrink-0">
                {i + 1}
              </div>
              <p className="text-white text-xs font-semibold mt-2 leading-tight">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[480px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-white text-center mb-6" style={{ fontFamily: "'Abhaya Libre', serif" }}>Register as a Trade Customer</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="px-3 py-2.5 bg-red-900/30 border border-red-500/30 rounded-md text-red-300 text-sm" role="alert">{error}</div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="business_name" className="text-sm font-medium text-white/90">Business name *</label>
            <input
              id="business_name"
              type="text"
              value={formData.business_name}
              onChange={e => handleChange('business_name', e.target.value)}
              placeholder="Your business name"
              required
              autoFocus
              className="px-3 py-2.5 border border-white/15 rounded-md text-base bg-[#2a2a2a] text-white placeholder:text-white/40 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="contact_name" className="text-sm font-medium text-white/90">Contact name *</label>
            <input
              id="contact_name"
              type="text"
              value={formData.contact_name}
              onChange={e => handleChange('contact_name', e.target.value)}
              placeholder="Your full name"
              required
              className="px-3 py-2.5 border border-white/15 rounded-md text-base bg-[#2a2a2a] text-white placeholder:text-white/40 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="reg_email" className="text-sm font-medium text-white/90">Email address *</label>
            <input
              id="reg_email"
              type="email"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="you@business.com"
              required
              autoComplete="email"
              className="px-3 py-2.5 border border-white/15 rounded-md text-base bg-[#2a2a2a] text-white placeholder:text-white/40 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-sm font-medium text-white/90">Phone number</label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="Optional"
              className="px-3 py-2.5 border border-white/15 rounded-md text-base bg-[#2a2a2a] text-white placeholder:text-white/40 odin-focus"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="preferred_fulfilment" className="text-sm font-medium text-white/90">Preferred fulfilment</label>
            <select
              id="preferred_fulfilment"
              value={formData.preferred_fulfilment}
              onChange={e => handleChange('preferred_fulfilment', e.target.value)}
              className={`px-3 pr-8 py-2.5 border border-white/15 rounded-md text-base bg-[#2a2a2a] appearance-none odin-focus bg-[length:16px_16px] bg-[position:right_10px_center] bg-no-repeat ${formData.preferred_fulfilment ? 'text-white' : 'text-white/40'}`}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
            >
              <option value="" disabled>Select an option...</option>
              <option value="delivery">Delivery (within our delivery zone)</option>
              <option value="collection">Collection from farm</option>
              <option value="courier">Courier (nationwide)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="message" className="text-sm font-medium text-white/90">Tell us about your business</label>
            <textarea
              id="message"
              value={formData.message}
              onChange={e => handleChange('message', e.target.value)}
              placeholder="What products are you interested in? Estimated weekly volumes?"
              rows={3}
              className="px-3 py-2.5 border border-white/15 rounded-md text-base bg-[#2a2a2a] text-white placeholder:text-white/40 resize-y odin-focus"
            />
          </div>

          <button type="submit" className="py-3 bg-[#4a7c59] text-white rounded-md text-base font-semibold hover:bg-[#3d6a4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Registration'}
          </button>

          <div className="flex justify-between text-sm">
            <Link to="/portal/login" className="text-white/60 no-underline hover:text-white hover:underline">Already have an account? Sign in</Link>
          </div>
        </form>

        <div className="mt-8 pt-4 border-t border-white/10 text-center">
          <a href="/home" className="text-sm text-white/40 no-underline hover:text-white transition-colors">
            &larr; Back to Glasgow Mushroom Co.
          </a>
        </div>
      </div>
    </div>
  )
}
