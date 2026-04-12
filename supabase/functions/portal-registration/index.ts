import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()

    // Create admin client (service_role key for user management)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Create user client to verify caller identity
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return errorResponse(401, "Missing authorization header")
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )

    // Verify caller is system_admin
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return errorResponse(401, "Not authenticated")
    }

    const { data: callerPortalUser } = await supabaseAdmin
      .from("portal_users")
      .select("role, status")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .single()

    if (!callerPortalUser || callerPortalUser.role !== "system_admin") {
      return errorResponse(403, "Only system admins can perform this action")
    }

    switch (action) {
      case "approve_registration":
        return await approveRegistration(supabaseAdmin, params, user.id)
      case "reject_registration":
        return await rejectRegistration(supabaseAdmin, params, user.id)
      case "invite_existing":
        return await inviteExisting(supabaseAdmin, params, user.id)
      default:
        return errorResponse(400, `Unknown action: ${action}`)
    }
  } catch (err) {
    console.error("portal-registration error:", err)
    return errorResponse(500, err.message || "Internal error")
  }
})

async function approveRegistration(
  supabase: ReturnType<typeof createClient>,
  params: { request_id: string },
  reviewedBy: string,
) {
  const { request_id } = params
  if (!request_id) return errorResponse(400, "request_id is required")

  // Fetch the registration request
  const { data: request, error: fetchError } = await supabase
    .from("portal_registration_requests")
    .select("*")
    .eq("id", request_id)
    .eq("status", "pending")
    .single()

  if (fetchError || !request) {
    return errorResponse(404, "Registration request not found or already processed")
  }

  // Check for duplicate email
  const { data: existingUser } = await supabase
    .from("portal_users")
    .select("id")
    .eq("email", request.email)
    .maybeSingle()

  if (existingUser) {
    return errorResponse(409, "A portal user with this email already exists")
  }

  // 1. Create customer record
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      name: request.business_name,
      email: request.email,
      phone: request.phone || null,
    })
    .select()
    .single()

  if (customerError) {
    console.error("Failed to create customer:", customerError)
    return errorResponse(500, "Failed to create customer record")
  }

  // 2. Create default branch
  const { error: branchError } = await supabase
    .from("branches")
    .insert({
      customer_id: customer.id,
      name: request.business_name,
      branch_type: "company",
    })

  if (branchError) {
    console.error("Failed to create branch:", branchError)
    // Continue — branch is not critical for initial access
  }

  // 3. Invite auth user via email
  const { data: authData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    request.email,
    {
      data: { display_name: request.contact_name },
      redirectTo: `${Deno.env.get("PORTAL_URL") || "https://www.glasgowmushroomcompany.co.uk"}/portal/onboarding`,
    },
  )

  if (inviteError) {
    console.error("Failed to invite user:", inviteError)
    return errorResponse(500, "Failed to send invitation email")
  }

  // 4. Create portal_users record
  const { error: portalUserError } = await supabase
    .from("portal_users")
    .insert({
      auth_user_id: authData.user.id,
      customer_id: customer.id,
      role: "admin",
      display_name: request.contact_name,
      email: request.email,
      status: "pending",
      invited_by: reviewedBy,
      invited_at: new Date().toISOString(),
    })

  if (portalUserError) {
    console.error("Failed to create portal user:", portalUserError)
    return errorResponse(500, "Failed to create portal user record")
  }

  // 5. Update registration request status
  await supabase
    .from("portal_registration_requests")
    .update({
      status: "invited",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", request_id)

  return jsonResponse({ success: true, customer_id: customer.id })
}

async function rejectRegistration(
  supabase: ReturnType<typeof createClient>,
  params: { request_id: string; reason?: string },
  reviewedBy: string,
) {
  const { request_id, reason } = params
  if (!request_id) return errorResponse(400, "request_id is required")

  const { error } = await supabase
    .from("portal_registration_requests")
    .update({
      status: "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", request_id)
    .eq("status", "pending")

  if (error) {
    return errorResponse(500, "Failed to reject registration")
  }

  return jsonResponse({ success: true })
}

async function inviteExisting(
  supabase: ReturnType<typeof createClient>,
  params: { customer_id: string; email: string; display_name: string },
  invitedBy: string,
) {
  const { customer_id, email, display_name } = params
  if (!customer_id || !email || !display_name) {
    return errorResponse(400, "customer_id, email, and display_name are required")
  }

  // Check customer exists
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customer_id)
    .single()

  if (customerError || !customer) {
    return errorResponse(404, "Customer not found")
  }

  // Check for duplicate email
  const { data: existingUser } = await supabase
    .from("portal_users")
    .select("id")
    .eq("email", email)
    .eq("customer_id", customer_id)
    .maybeSingle()

  if (existingUser) {
    return errorResponse(409, "This email is already invited to this account")
  }

  // Invite auth user
  const { data: authData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    email,
    {
      data: { display_name },
      redirectTo: `${Deno.env.get("PORTAL_URL") || "https://www.glasgowmushroomcompany.co.uk"}/portal/onboarding`,
    },
  )

  if (inviteError) {
    console.error("Failed to invite user:", inviteError)
    return errorResponse(500, "Failed to send invitation email")
  }

  // Create portal_users record
  const { error: portalUserError } = await supabase
    .from("portal_users")
    .insert({
      auth_user_id: authData.user.id,
      customer_id,
      role: "member",
      display_name,
      email,
      status: "pending",
      invited_by: invitedBy,
      invited_at: new Date().toISOString(),
    })

  if (portalUserError) {
    console.error("Failed to create portal user:", portalUserError)
    return errorResponse(500, "Failed to create portal user record")
  }

  return jsonResponse({ success: true })
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
