import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env'
  )
}

// Use a no-op lock to avoid navigator.locks contention between
// HMR reloads in dev and with Odin running in the same browser.
const noopLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sb-portal-auth',
    lock: noopLock,
  },
})
