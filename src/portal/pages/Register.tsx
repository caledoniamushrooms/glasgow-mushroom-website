import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

export function Register() {
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body = new FormData()
      Object.entries(form).forEach(([k, v]) => body.append(k, v))
      const res = await fetch('/api/register-interest', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.')
      setSubmitted(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4"
         style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 w-full max-w-[440px] bg-white rounded-xl shadow-lg p-8 my-8">
        <div className="text-center mb-8">
          <img src="/images/logo-full.svg" alt="Glasgow Mushroom Co." className="max-w-[200px] h-auto mx-auto block" />
        </div>

        {submitted ? (
          <div className="text-center py-4">
            <h2 className="text-xl font-semibold text-foreground mb-3">Application received</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Thanks — we've received your application. We'll review it and email you once your account is approved, with a link to complete the rest of your onboarding.
            </p>
            <Link
              to="/portal"
              className="inline-block w-full py-3 bg-white text-primary border border-primary rounded-md text-base font-semibold hover:bg-accent transition-colors no-underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-base font-semibold text-foreground">Apply for a trade account</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Tell us about your business and we'll review your application.
              </p>
            </div>

            {error && (
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm" role="alert">{error}</div>
            )}

            <Field
              id="business_name" label="Business name"
              value={form.business_name} onChange={v => handleChange('business_name', v)}
              placeholder="Your business or restaurant" required autoFocus
            />
            <Field
              id="contact_name" label="Your name"
              value={form.contact_name} onChange={v => handleChange('contact_name', v)}
              placeholder="Full name" required
            />
            <Field
              id="email" label="Email address" type="email"
              value={form.email} onChange={v => handleChange('email', v)}
              placeholder="you@business.com" required autoComplete="email"
            />
            <Field
              id="phone" label="Phone" type="tel" optional
              value={form.phone} onChange={v => handleChange('phone', v)}
              placeholder="Phone number"
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="message" className="text-sm font-medium text-foreground">
                Tell us about your business <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                id="message"
                value={form.message}
                onChange={e => handleChange('message', e.target.value)}
                placeholder="What products are you interested in? Estimated weekly volumes?"
                rows={3}
                className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 resize-y odin-focus"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="py-3 bg-primary text-primary-foreground rounded-md text-base font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit application'}
            </button>

            <div className="text-sm text-center">
              <Link to="/portal" className="text-primary no-underline hover:underline">Already have an account? Sign in</Link>
            </div>
          </form>
        )}

        <div className="mt-8 pt-4 border-t border-border text-center">
          <a href="/home" className="text-sm text-muted-foreground no-underline hover:text-foreground transition-colors">
            &larr; Back to Glasgow Mushroom Co.
          </a>
        </div>
      </div>
    </div>
  )
}

function Field(props: {
  id: string; label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; autoFocus?: boolean
  autoComplete?: string; optional?: boolean
}) {
  const { id, label, value, onChange, type = 'text', placeholder, required, autoFocus, autoComplete, optional } = props
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}{optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
      />
    </div>
  )
}
