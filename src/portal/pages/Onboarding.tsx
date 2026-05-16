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

    // Find the applicant's request by email
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

    // approved or onboarding_in_progress → show the form
    if (row.status === 'approved') {
      // Move to onboarding_in_progress so admins see them as actively filling in
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
      // Update display_name on portal_users (best-effort)
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

  if (loading) return <Shell><p className="text-center text-muted-foreground py-8">Loading...</p></Shell>

  if (terminalView === 'not_found') {
    return (
      <Shell>
        <Heading subtitle="Application not found" />
        <p className="text-sm text-foreground">
          We couldn't find an approved application for this account. If you've registered
          interest, we'll be in touch once it's reviewed. Otherwise please{' '}
          <a className="text-primary hover:underline" href="/portal/register">register your interest</a>.
        </p>
      </Shell>
    )
  }

  if (terminalView === 'under_review') {
    return (
      <Shell>
        <Heading subtitle="Application under review" />
        <p className="text-sm text-foreground">
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
        <p className="text-sm text-foreground">
          Unfortunately we weren't able to approve your application at this time.
          If you'd like to discuss this, please contact us at{' '}
          <a className="text-primary hover:underline" href="mailto:accounts@glasgowmushroomcompany.co.uk">
            accounts@glasgowmushroomcompany.co.uk
          </a>.
        </p>
      </Shell>
    )
  }

  return (
    <Shell wide>
      <Heading subtitle="Complete your application" />
      <p className="text-sm text-muted-foreground mb-6">
        Please complete the details below to open a trade account with Glasgow Mushroom Company.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
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
          <div className="grid grid-cols-2 gap-3">
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
          <p className="text-xs text-muted-foreground">
            By submitting, you confirm the details provided are accurate and that you are
            authorised to open a trade account on behalf of the business named above.
          </p>
        </Section>

        <button
          type="submit"
          disabled={submitting}
          className="py-3 bg-primary text-primary-foreground rounded-md text-base font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit application'}
        </button>
      </form>
    </Shell>
  )
}

// ---------------------------------------------------------------------
// Local presentational components
// ---------------------------------------------------------------------

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4"
         style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
      <div className="absolute inset-0 bg-black/55" />
      <div className={`relative z-10 w-full bg-white rounded-xl shadow-lg p-8 my-8 ${wide ? 'max-w-[640px]' : 'max-w-[480px]'}`}>
        {children}
      </div>
    </div>
  )
}

function Heading({ subtitle }: { subtitle: string }) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-xl font-semibold text-foreground">Glasgow Mushroom Co.</h1>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
      <legend className="text-sm font-semibold text-foreground -mt-7 px-2 bg-white">{title}</legend>
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
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && ' *'}
        {optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        required={required}
        className={`px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus ${readOnly ? 'bg-gray-50 text-muted-foreground' : ''}`}
      />
    </div>
  )
}

function Textarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 resize-y odin-focus"
    />
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
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}{required && ' *'}</span>
      <div className="flex flex-wrap gap-3">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              required={required}
            />
            <span className="text-sm text-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm" role="alert">
      {children}
    </div>
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
