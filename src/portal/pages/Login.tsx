import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import './Login.css'

export function Login() {
  const { isAuthenticated, loading, signIn, error: authError } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p className="login-loading">Loading...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/portal" replace />
  }

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    await signIn(email, password)
    setSubmitting(false)
  }

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/portal`,
      },
    })

    if (otpError) {
      setError(otpError.message)
    } else {
      setMagicLinkSent(true)
    }
    setSubmitting(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/images/logo-full.svg" alt="Glasgow Mushroom Co." className="login-logo" />
        </div>

        {magicLinkSent ? (
          <div className="login-magic-sent">
            <h2>Check your email</h2>
            <p>
              We've sent a sign-in link to <strong>{email}</strong>.
              Click the link in the email to access your account.
            </p>
            <button
              className="login-submit login-submit--outline"
              onClick={() => { setMagicLinkSent(false); setEmail(''); setUseMagicLink(false) }}
            >
              Back to sign in
            </button>
          </div>
        ) : useMagicLink ? (
          <form onSubmit={handleMagicLink} className="login-form">
            {(error || authError) && (
              <div className="login-error" role="alert">{error || authError}</div>
            )}

            <div className="login-field">
              <label htmlFor="magic_email">Email address</label>
              <input
                id="magic_email"
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
              {submitting ? 'Sending link...' : 'Send sign-in link'}
            </button>

            <div className="login-links">
              <button type="button" className="login-toggle" onClick={() => setUseMagicLink(false)}>
                Sign in with password instead
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin} className="login-form">
            {(error || authError) && (
              <div className="login-error" role="alert">{error || authError}</div>
            )}

            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@business.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="login-links">
              <Link to="/portal/forgot-password">Forgot password?</Link>
              <button type="button" className="login-toggle" onClick={() => setUseMagicLink(true)}>
                Use magic link instead
              </button>
            </div>

            <div className="login-links">
              <Link to="/portal/register">Register as a new customer</Link>
            </div>
          </form>
        )}

        <div className="login-back">
          <a href="/home">&larr; Back to Glasgow Mushroom Co.</a>
        </div>
      </div>
    </div>
  )
}
