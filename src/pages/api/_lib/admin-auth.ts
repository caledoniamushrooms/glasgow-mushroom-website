import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function verifySystemAdmin(token: string): Promise<boolean> {
  const authed = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await authed.auth.getUser(token);
  if (error || !user) return false;
  const { data } = await serviceClient
    .from('portal_users')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('role', 'system_admin')
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function requireAdmin(request: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401) };
  }
  const isAdmin = await verifySystemAdmin(authHeader.slice(7));
  if (!isAdmin) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401) };
  }
  return { ok: true };
}
