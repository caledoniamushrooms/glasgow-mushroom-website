import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'

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
    <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4" style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 w-full max-w-[400px] bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-foreground">Glasgow Mushroom Co.</h1>
          <p className="text-sm text-muted-foreground mt-1">Reset Your Password</p>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <p className="text-foreground mb-4">
              If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
            </p>
            <Link to="/portal/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm" role="alert">{error}</div>
            )}

            <p className="text-sm text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div className="flex flex-col gap-1">
              <label htmlFor="reset_email" className="text-sm font-medium text-foreground">Email address</label>
              <input
                id="reset_email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@business.com"
                required
                autoComplete="email"
                autoFocus
                className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
              />
            </div>

            <button type="submit" className="py-3 bg-primary text-primary-foreground rounded-md text-base font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="flex justify-between text-sm">
              <Link to="/portal/login" className="text-primary no-underline hover:underline">Back to sign in</Link>
              <Link to="/portal/register" className="text-primary no-underline hover:underline">Register as a new customer</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
