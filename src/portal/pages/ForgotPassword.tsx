import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'
import '../pages/Login.css'

export function ForgotPassword() {
  const { resetPassword } = useAuthContext()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: resetError } = await resetPassword(email)
    if (resetError) {
      setError(resetError.message)
    } else {
      setSent(true)
    }
    setSubmitting(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>Glasgow Mushroom Co.</h1>
          <p>Reset Your Password</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: 'var(--portal-space-lg) 0' }}>
            <p style={{ color: 'var(--portal-text)', marginBottom: 'var(--portal-space-md)' }}>
              If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
            </p>
            <Link to="/portal/login" style={{ color: 'var(--portal-green)' }}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="login-error" role="alert">{error}</div>}

            <p style={{ color: 'var(--portal-text-muted)', fontSize: 'var(--portal-text-sm)' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div className="login-field">
              <label htmlFor="reset_email">Email address</label>
              <input
                id="reset_email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@business.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="login-links">
              <Link to="/portal/login">Back to sign in</Link>
              <Link to="/portal/register">Register as a new customer</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
