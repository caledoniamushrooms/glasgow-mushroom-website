import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCustomerTypes } from '../hooks/useCustomerTypes'
import type { RegistrationRequest, RegistrationStatus } from '../hooks/useRegistrations'

type FormState = {
  website: string
  phone: string
  fulfilment_method: '' | 'delivery' | 'collection' | 'courier'
  payment_method: '' | 'xero_bacs' | 'gocardless_dd' | 'cash_on_delivery'
  site_name: string
  site_type_id: string
  address_line_1: string
  address_line_2: string
  address_line_3: string
  city: string
  postcode: string
  site_phone: string
  site_email: string
  notes: string
  display_name: string
}

const emptyForm: FormState = {
  website: '', phone: '', fulfilment_method: '', payment_method: '',
  site_name: '', site_type_id: '',
  address_line_1: '', address_line_2: '', address_line_3: '',
  city: '', postcode: '', site_phone: '', site_email: '',
  notes: '', display_name: '',
}

export function Onboarding() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState<RegistrationRequest | null>(null)
  const [terminalView, setTerminalView] = useState<null | 'under_review' | 'rejected' | 'not_found'>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const { data: customerTypes = [] } = useCustomerTypes()

  useEffect(() => { void bootstrap() }, [])

  const bootstrap = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) {
      navigate('/portal/login')
      return
    }

    const { data: rows } = await supabase
      .from('portal_registration_requests')
      .select('*')
      .eq('email', session.user.email)
      .order('created_at', { ascending: false })
      .limit(1)
    const row = (rows?.[0] as RegistrationRequest | undefined) ?? null

    if (!row) {
      setTerminalView('not_found')
      setLoading(false)
      return
    }

    if (row.status === 'active') {
      navigate('/portal/home')
      return
    }
    if (row.status === 'submitted_for_review') {
      setRequest(row)
      setTerminalView('under_review')
      setLoading(false)
      return
    }
    if (row.status === 'rejected') {
      setRequest(row)
      setTerminalView('rejected')
      setLoading(false)
      return
    }

    if (row.status === 'approved') {
      await supabase
        .from('portal_registration_requests')
        .update({ status: 'onboarding_in_progress' satisfies RegistrationStatus })
        .eq('id', row.id)
        .eq('status', 'approved')
    }

    setRequest(row)
    setForm(prefillFromRequest(row, session.user.user_metadata?.display_name))
    setLoading(false)
  }

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!request) return
    setSubmitting(true)
    setError(null)

    try {
      if (form.display_name) {
        await supabase
          .from('portal_users')
          .update({ display_name: form.display_name })
          .eq('email', request.email)
      }

      const payload = {
        website: form.website || null,
        phone: form.phone || null,
        fulfilment_method: form.fulfilment_method || null,
        payment_method: form.payment_method || null,
        site_name: form.site_name,
        site_type_id: form.site_type_id,
        site_type_other: isOtherType(form.site_type_id, customerTypes),
        address_line_1: form.address_line_1,
        address_line_2: form.address_line_2 || null,
        address_line_3: form.address_line_3 || null,
        city: form.city,
        postcode: form.postcode,
        site_phone: form.site_phone || null,
        site_email: form.site_email || null,
        notes: form.notes || null,
      }

      const { error: invokeError } = await supabase.functions.invoke('portal-registration', {
        body: { action: 'submit_application', request_id: request.id, payload },
      })
      if (invokeError) throw invokeError

      setTerminalView('under_review')
    } catch (err) {
      setError((err as Error).message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <Shell><p className="onboarding-status">Loading…</p></Shell>
  }

  if (terminalView === 'not_found') {
    return (
      <Shell>
        <Heading subtitle="Application not found" />
        <p className="onboarding-prose">
          We couldn't find an approved application for this account. If you've registered
          interest, we'll be in touch once it's reviewed. Otherwise please{' '}
          <a className="onboarding-link" href="/portal/register">register your interest</a>.
        </p>
      </Shell>
    )
  }

  if (terminalView === 'under_review') {
    return (
      <Shell>
        <Heading subtitle="Application under review" />
        <p className="onboarding-prose">
          Thanks — we've received your application and will be in touch shortly.
          You can close this page.
        </p>
      </Shell>
    )
  }

  if (terminalView === 'rejected') {
    return (
      <Shell>
        <Heading subtitle="Application not approved" />
        <p className="onboarding-prose">
          Unfortunately we weren't able to approve your application at this time.
          If you'd like to discuss this, please contact us at{' '}
          <a className="onboarding-link" href="mailto:accounts@glasgowmushroomcompany.co.uk">
            accounts@glasgowmushroomcompany.co.uk
          </a>.
        </p>
      </Shell>
    )
  }

  return (
    <Shell wide>
      <Heading subtitle="Complete your application" />
      <p className="onboarding-prose onboarding-prose--centred">
        Please complete the details below to open a trade account with Glasgow Mushroom Company.
      </p>

      <form onSubmit={handleSubmit} className="onboarding-form">
        {error && <Alert>{error}</Alert>}

        <Section title="Business">
          <Field label="Company name" value={request?.business_name ?? ''} readOnly />
          <Field label="Website" value={form.website} onChange={v => handleChange('website', v)} optional />
          <Field label="Email" value={request?.email ?? ''} readOnly />
          <Field label="Phone" value={form.phone} onChange={v => handleChange('phone', v)} type="tel" />
        </Section>

        <Section title="Trading preferences">
          <RadioGroup
            label="How would you like to receive orders?"
            value={form.fulfilment_method}
            onChange={v => handleChange('fulfilment_method', v)}
            options={[
              { value: 'delivery', label: 'Delivery' },
              { value: 'collection', label: 'Collection' },
              { value: 'courier', label: 'Courier' },
            ]}
            required
          />
          <RadioGroup
            label="Preferred payment method"
            value={form.payment_method}
            onChange={v => handleChange('payment_method', v)}
            options={[
              { value: 'xero_bacs', label: 'Xero Invoice / BACS' },
              { value: 'gocardless_dd', label: 'Direct Debit (GoCardless)' },
              { value: 'cash_on_delivery', label: 'Cash on Delivery' },
            ]}
            required
          />
        </Section>

        <Section title="Delivery / branch site">
          <Field label="Site name / reference" value={form.site_name} onChange={v => handleChange('site_name', v)} required />
          <RadioGroup
            label="Site type"
            value={form.site_type_id}
            onChange={v => handleChange('site_type_id', v)}
            options={customerTypes.map(t => ({ value: t.id, label: t.name }))}
            required
          />
          <Field label="Address line 1" value={form.address_line_1} onChange={v => handleChange('address_line_1', v)} required />
          <Field label="Address line 2" value={form.address_line_2} onChange={v => handleChange('address_line_2', v)} optional />
          <Field label="Address line 3" value={form.address_line_3} onChange={v => handleChange('address_line_3', v)} optional />
          <div className="onboarding-grid">
            <Field label="City" value={form.city} onChange={v => handleChange('city', v)} required />
            <Field label="Postcode" value={form.postcode} onChange={v => handleChange('postcode', v)} required />
          </div>
          <Field label="Site phone" value={form.site_phone} onChange={v => handleChange('site_phone', v)} type="tel" optional />
          <Field label="Site email" value={form.site_email} onChange={v => handleChange('site_email', v)} type="email" optional />
        </Section>

        <Section title="Notes / special requirements">
          <Textarea value={form.notes} onChange={v => handleChange('notes', v)} rows={3} />
        </Section>

        <Section title="Authorisation">
          <Field label="Print name" value={form.display_name} onChange={v => handleChange('display_name', v)} required />
          <p className="onboarding-hint">
            By submitting, you confirm the details provided are accurate and that you are
            authorised to open a trade account on behalf of the business named above.
          </p>
        </Section>

        <button type="submit" disabled={submitting} className="onboarding-submit cta-btn">
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </Shell>
  )
}

// ---------------------------------------------------------------------
// Presentational components — dark portal-login theme
// Uses CSS variables exposed by src/styles/global.css (--color-bg-footer,
// --font-heading, --font-body). Styles are colocated below to keep the
// dark theme self-contained inside the SPA bundle.
// ---------------------------------------------------------------------

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="onboarding-shell">
      <OnboardingStyles />
      <div className={`onboarding-card ${wide ? 'onboarding-card--wide' : ''}`}>
        {children}
      </div>
    </div>
  )
}

function Heading({ subtitle }: { subtitle: string }) {
  return (
    <div className="onboarding-header">
      <h1>Trade Portal</h1>
      <p className="onboarding-subtitle">{subtitle}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="onboarding-section">
      <legend className="onboarding-legend">{title}</legend>
      {children}
    </fieldset>
  )
}

function Field(props: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  required?: boolean
  optional?: boolean
  readOnly?: boolean
}) {
  const { label, value, onChange, type = 'text', required, optional, readOnly } = props
  return (
    <div className="onboarding-field">
      <label>
        {label}
        {required && ' *'}
        {optional && <span className="onboarding-optional"> (optional)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        required={required}
        className={readOnly ? 'is-readonly' : ''}
      />
    </div>
  )
}

function Textarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="onboarding-field">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
      />
    </div>
  )
}

function RadioGroup(props: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  required?: boolean
}) {
  const { label, value, onChange, options, required } = props
  return (
    <div className="onboarding-radio-group">
      <span className="onboarding-radio-label">{label}{required && ' *'}</span>
      <div className="onboarding-radio-options">
        {options.map(opt => (
          <label key={opt.value} className={`onboarding-radio ${value === opt.value ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              required={required}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboarding-alert" role="alert">{children}</div>
  )
}

// ---------------------------------------------------------------------
// Scoped stylesheet (injected once per Shell mount)
// ---------------------------------------------------------------------

function OnboardingStyles() {
  return (
    <style>{`
      .onboarding-shell {
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 3rem 1.5rem;
        background: #0a0a0a;
        color: rgba(255,255,255,0.9);
        font-family: var(--font-body, Arial, sans-serif);
      }
      .onboarding-card {
        background: var(--color-bg-footer, #161616);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 2.5rem;
        max-width: 480px;
        width: 100%;
      }
      .onboarding-card--wide { max-width: 640px; }

      .onboarding-header { text-align: center; margin-bottom: 2rem; }
      .onboarding-header h1 {
        font-family: var(--font-heading, 'Abhaya Libre', serif);
        font-size: 2.5rem;
        font-weight: 700;
        color: #fff;
        line-height: 1.1;
        margin: 0;
      }
      .onboarding-subtitle {
        font-family: var(--font-heading, 'Abhaya Libre', serif);
        font-size: 1.1rem;
        color: hsl(142 71% 45%);
        margin: 0.25rem 0 0;
      }

      .onboarding-prose {
        color: rgba(255,255,255,0.85);
        font-size: 0.9rem;
        line-height: 1.5;
      }
      .onboarding-prose--centred { text-align: center; margin: 0 0 2rem; }
      .onboarding-link { color: hsl(142 71% 55%); text-decoration: none; }
      .onboarding-link:hover { text-decoration: underline; }
      .onboarding-status { color: rgba(255,255,255,0.7); text-align: center; padding: 2rem 0; }

      .onboarding-form { display: flex; flex-direction: column; gap: 1.75rem; }

      .onboarding-section {
        border: none;
        border-top: 1px solid rgba(255,255,255,0.1);
        padding: 1.25rem 0 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .onboarding-section:first-of-type { border-top: none; padding-top: 0; }

      .onboarding-legend {
        font-family: var(--font-heading, 'Abhaya Libre', serif);
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
        padding: 0;
        margin-bottom: 0.25rem;
      }

      .onboarding-field { display: flex; flex-direction: column; gap: 0.4rem; }
      .onboarding-field label {
        font-family: var(--font-heading, 'Abhaya Libre', serif);
        font-size: 0.875rem;
        font-weight: 700;
        color: rgba(255,255,255,0.85);
      }
      .onboarding-optional { color: rgba(255,255,255,0.45); font-weight: 400; }

      .onboarding-field input,
      .onboarding-field textarea {
        width: 100%;
        padding: 0.6rem 0.75rem;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        color: #fff;
        font-family: var(--font-body, Arial, sans-serif);
        font-size: 0.875rem;
        box-sizing: border-box;
        transition: border-color 0.2s ease;
        resize: vertical;
      }
      .onboarding-field input::placeholder,
      .onboarding-field textarea::placeholder { color: rgba(255,255,255,0.35); }
      .onboarding-field input:focus,
      .onboarding-field textarea:focus {
        outline: none;
        border-color: hsl(142 71% 35%);
      }
      .onboarding-field input.is-readonly {
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.55);
        cursor: default;
      }

      .onboarding-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

      .onboarding-radio-group { display: flex; flex-direction: column; gap: 0.6rem; }
      .onboarding-radio-label {
        font-family: var(--font-heading, 'Abhaya Libre', serif);
        font-size: 0.875rem;
        font-weight: 700;
        color: rgba(255,255,255,0.85);
      }
      .onboarding-radio-options { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .onboarding-radio {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.85rem;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 999px;
        color: rgba(255,255,255,0.85);
        font-size: 0.875rem;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .onboarding-radio input { accent-color: hsl(142 71% 35%); }
      .onboarding-radio:hover { border-color: rgba(255,255,255,0.3); }
      .onboarding-radio.is-selected {
        background: rgba(34, 197, 94, 0.12);
        border-color: hsl(142 71% 35%);
        color: #fff;
      }

      .onboarding-hint {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.55);
        margin: 0;
        line-height: 1.5;
      }

      .onboarding-alert {
        padding: 0.6rem 0.85rem;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.35);
        border-radius: 6px;
        color: #fecaca;
        font-size: 0.875rem;
      }

      .onboarding-submit {
        width: 100%;
        margin-top: 0.5rem;
      }

      @media (max-width: 479px) {
        .onboarding-shell { padding: 2rem 1rem; }
        .onboarding-card { padding: 2rem 1.5rem; }
        .onboarding-card h1, .onboarding-header h1 { font-size: 2rem; }
        .onboarding-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  )
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function prefillFromRequest(row: RegistrationRequest, authDisplayName?: string): FormState {
  return {
    website: row.website ?? '',
    phone: row.phone ?? '',
    fulfilment_method: row.fulfilment_method ?? '',
    payment_method: row.payment_method ?? '',
    site_name: row.site_name ?? '',
    site_type_id: row.site_type_id ?? '',
    address_line_1: row.address_line_1 ?? '',
    address_line_2: row.address_line_2 ?? '',
    address_line_3: row.address_line_3 ?? '',
    city: row.city ?? '',
    postcode: row.postcode ?? '',
    site_phone: row.site_phone ?? '',
    site_email: row.site_email ?? '',
    notes: row.notes ?? '',
    display_name: authDisplayName ?? row.contact_name ?? '',
  }
}

function isOtherType(siteTypeId: string, customerTypes: { id: string; name: string }[]): boolean {
  const t = customerTypes.find(t => t.id === siteTypeId)
  return t?.name?.toLowerCase() === 'other'
}
