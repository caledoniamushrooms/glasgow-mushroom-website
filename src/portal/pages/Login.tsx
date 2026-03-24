import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'
import './Login.css'

export function Login() {
  const { isAuthenticated, loading, signIn, error: authError } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await signIn(email, password)
    setSubmitting(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>Glasgow Mushroom Co.</h1>
          <p>Customer Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {authError && (
            <div className="login-error" role="alert">
              {authError}
            </div>
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
            <Link to="/portal/register">Register as a new customer</Link>
          </div>
        </form>

        <div className="login-back">
          <a href="/home">&larr; Back to Glasgow Mushroom Co.</a>
        </div>
      </div>
    </div>
  )
}
