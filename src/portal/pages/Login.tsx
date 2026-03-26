import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'

export function Login() {
  const { isAuthenticated, loading, signIn, signOut, error: authError, session } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4" style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 w-full max-w-[400px] bg-white rounded-xl shadow-lg p-8">
          <p className="text-center text-muted-foreground py-8">Loading...</p>
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
    <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4" style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 w-full max-w-[400px] bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <img src="/images/logo-full.svg" alt="Glasgow Mushroom Co." className="max-w-[200px] h-auto mx-auto block" />
        </div>

        {magicLinkSent ? (
          <div className="text-center py-4">
            <h2 className="text-xl font-semibold text-foreground mb-3">Check your email</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              We've sent a sign-in link to <strong>{email}</strong>.
              Click the link in the email to access your account.
            </p>
            <button
              className="w-full py-3 bg-white text-primary border border-primary rounded-md text-base font-semibold hover:bg-accent transition-colors"
              onClick={() => { setMagicLinkSent(false); setEmail(''); setUseMagicLink(false) }}
            >
              Back to sign in
            </button>
          </div>
        ) : useMagicLink ? (
          <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
            {(error || authError) && (
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm" role="alert">
                {error || authError}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="magic_email" className="text-sm font-medium text-foreground">Email address</label>
              <input
                id="magic_email"
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
              {submitting ? 'Sending link...' : 'Send sign-in link'}
            </button>

            <div className="flex justify-between text-sm">
              <button type="button" className="text-primary hover:underline bg-transparent border-none cursor-pointer p-0 text-sm" onClick={() => setUseMagicLink(false)}>
                Sign in with password instead
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
            {(error || authError) && (
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm" role="alert">
                {error || authError}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email address</label>
              <input
                id="email"
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

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="px-3 py-2.5 border border-input rounded-md text-base bg-white text-foreground placeholder:text-muted-foreground/60 odin-focus"
              />
            </div>

            <button type="submit" className="py-3 bg-primary text-primary-foreground rounded-md text-base font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="flex justify-between text-sm">
              <Link to="/portal/forgot-password" className="text-primary no-underline hover:underline">Forgot password?</Link>
              <button type="button" className="text-primary hover:underline bg-transparent border-none cursor-pointer p-0 text-sm" onClick={() => setUseMagicLink(true)}>
                Use magic link instead
              </button>
            </div>

            <div className="flex justify-between text-sm">
              <Link to="/portal/register" className="text-primary no-underline hover:underline">Register as a new customer</Link>
            </div>
          </form>
        )}

        <div className="mt-8 pt-4 border-t border-border text-center flex flex-col gap-2">
          {session && !isAuthenticated && (
            <button
              onClick={signOut}
              className="text-sm text-red-600 hover:underline bg-transparent border-none cursor-pointer p-0"
            >
              Sign out and try a different account
            </button>
          )}
          <a href="/home" className="text-sm text-muted-foreground no-underline hover:text-foreground transition-colors">
            &larr; Back to Glasgow Mushroom Co.
          </a>
        </div>
      </div>
    </div>
  )
}
