import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Resend } from "npm:resend@4"
import { corsHeaders } from "../_shared/cors.ts"

const PORTAL_URL = Deno.env.get("PORTAL_URL") || "https://www.glasgowmushroomcompany.co.uk"
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const APPLICANT_FROM = "Glasgow Mushroom Company <hello@glasgowmushroomcompany.co.uk>"

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

async function sendApprovalEmail(opts: { to: string; contactName: string; businessName: string; actionLink: string }) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set — approval email skipped. Action link:", opts.actionLink)
    return { sent: false, reason: "resend_not_configured" }
  }
  try {
    const { error } = await resend.emails.send({
      from: APPLICANT_FROM,
      to: opts.to,
      subject: "Your Glasgow Mushroom trade account has been approved",
      text:
        `Hi ${opts.contactName},\n\n` +
        `Good news — your trade account application for ${opts.businessName} has been approved.\n\n` +
        `To finish setting up your account, please complete the rest of your onboarding here:\n\n` +
        `${opts.actionLink}\n\n` +
        `This link is single-use and will sign you in automatically. Once you're in, you'll be asked to fill in a short application form covering delivery details, trading preferences, and a site address. We'll review the completed form and confirm your account from there.\n\n` +
        `If you have any questions, just reply to this email.\n\n` +
        `Best,\nGlasgow Mushroom Company`,
      html:
        `<p>Hi ${opts.contactName},</p>` +
        `<p>Good news — your trade account application for <strong>${opts.businessName}</strong> has been approved.</p>` +
        `<p>To finish setting up your account, please complete the rest of your onboarding:</p>` +
        `<p><a href="${opts.actionLink}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Complete your onboarding</a></p>` +
        `<p style="color:#666;font-size:13px">Or copy this link: <br><a href="${opts.actionLink}">${opts.actionLink}</a></p>` +
        `<p>This link is single-use and will sign you in automatically. Once you're in, you'll be asked to fill in a short application form covering delivery details, trading preferences, and a site address. We'll review the completed form and confirm your account from there.</p>` +
        `<p>If you have any questions, just reply to this email.</p>` +
        `<p>Best,<br>Glasgow Mushroom Company</p>`,
    })
    if (error) {
      console.error("Resend send failed:", error)
      return { sent: false, reason: "resend_error" }
    }
    return { sent: true }
  } catch (err) {
    console.error("Resend exception:", err)
    return { sent: false, reason: "resend_exception" }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return errorResponse(401, "Missing authorization header")

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return errorResponse(401, "Not authenticated")

    // Look up portal_users row (if any). Option X: caller is authorised
    // as a reviewer if they have an active system_admin portal_users row
    // OR they have no portal_users row at all (Odin staff).
    const { data: portalUser } = await supabaseAdmin
      .from("portal_users")
      .select("id, role, status, customer_id, email")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    const isPortalAdmin = portalUser?.status === "active"
                       && portalUser.role === "system_admin"
    const isOdinStaff   = !portalUser
    // When Odin's custom_access_token_hook ships, tighten with:
    //   && (user.app_role === "admin" || user.app_role === "staff")
    const canReview = isPortalAdmin || isOdinStaff

    switch (action) {
      case "approve_registration":
        if (!canReview) return errorResponse(403, "Not authorised to review registrations")
        return await approveRegistration(supabaseAdmin, params, user.id)

      case "accept_application":
        if (!isPortalAdmin) return errorResponse(403, "Step-4 acceptance is portal-admin only in v1")
        return await acceptApplication(supabaseAdmin, params, user.id)

      case "reject_application":
        if (!canReview) return errorResponse(403, "Not authorised to reject")
        return await rejectApplication(supabaseAdmin, params, user.id)

      case "submit_application":
        // Caller is the applicant, not a reviewer
        return await submitApplication(supabaseAdmin, params, user)

      case "invite_existing": {
        // Legacy flow — invite an existing customer's team member
        const isAdmin = portalUser?.role === "admin" || isPortalAdmin
        if (!isAdmin) return errorResponse(403, "Only admins can invite users")
        return await inviteExisting(supabaseAdmin, params, user.id, portalUser!, isPortalAdmin)
      }

      default:
        return errorResponse(400, `Unknown action: ${action}`)
    }
  } catch (err) {
    console.error("portal-registration error:", err)
    return errorResponse(500, (err as Error).message || "Internal error")
  }
})

// ---------------------------------------------------------------------
// approve_registration — step 2: interest_submitted → approved
// Creates auth user + portal_users row (NULL customer_id). Does NOT
// create a customers/branches row — that's step 4 (accept_application).
// ---------------------------------------------------------------------
async function approveRegistration(
  supabase: ReturnType<typeof createClient>,
  params: { request_id: string; reviewed_from?: "portal" | "odin" },
  reviewerId: string,
) {
  const { request_id, reviewed_from } = params
  if (!request_id) return errorResponse(400, "request_id is required")
  if (reviewed_from && !["portal", "odin"].includes(reviewed_from)) {
    return errorResponse(400, "invalid reviewed_from")
  }

  // Fetch the request first (no state change yet) so all preconditions
  // run before we flip status. Otherwise a failing precondition would
  // strand the row in `approved` with no invite sent.
  const { data: request, error: fetchErr } = await supabase
    .from("portal_registration_requests")
    .select("*")
    .eq("id", request_id)
    .eq("status", "interest_submitted")
    .maybeSingle()

  if (fetchErr || !request) {
    return errorResponse(409, "Request not found or already processed")
  }

  // Pre-flight dedup against portal_users
  const { data: existing } = await supabase
    .from("portal_users")
    .select("id")
    .eq("email", request.email)
    .maybeSingle()
  if (existing) return errorResponse(409, "email_already_has_portal_account")

  // Guarded transition. Status guard handles the portal/Odin race —
  // second writer no-ops.
  const { error: transitionErr } = await supabase
    .from("portal_registration_requests")
    .update({
      status: "approved",
      approved_by: reviewerId,
      approved_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      reviewed_from: reviewed_from ?? "portal",
    })
    .eq("id", request_id)
    .eq("status", "interest_submitted")

  if (transitionErr) {
    return errorResponse(409, "Request was processed by another reviewer")
  }

  // Create the auth user + get a magic link without sending Supabase
  // Auth's default email. We send our own GMC-branded email via Resend.
  const { data: linkData, error: linkErr } =
    await supabase.auth.admin.generateLink({
      type: "invite",
      email: request.email,
      options: {
        data: { display_name: request.contact_name },
        redirectTo: `${PORTAL_URL}/portal/onboarding`,
      },
    })
  if (linkErr || !linkData?.user) {
    console.error("generateLink failed:", linkErr)
    return errorResponse(500, "Failed to create invitation link")
  }

  const actionLink = linkData.properties?.action_link
  if (!actionLink) {
    console.error("generateLink returned no action_link", linkData)
    return errorResponse(500, "Invitation link missing from auth response")
  }

  // portal_users row with NULL customer_id — backfilled at acceptance
  const { error: userErr } = await supabase
    .from("portal_users")
    .insert({
      auth_user_id: linkData.user.id,
      customer_id: null,
      role: "admin",
      display_name: request.contact_name,
      email: request.email,
      status: "pending",
      invited_by: reviewerId,
      invited_at: new Date().toISOString(),
    })
  if (userErr) {
    console.error("portal_users insert failed:", userErr)
    return errorResponse(500, "Failed to create portal user record")
  }

  // Send our own approval email via Resend. Non-fatal: if it fails we
  // still report success and surface a flag so the admin can retry.
  const emailResult = await sendApprovalEmail({
    to: request.email,
    contactName: request.contact_name,
    businessName: request.business_name,
    actionLink,
  })

  return jsonResponse({
    success: true,
    request_id,
    email_sent: emailResult.sent,
    ...(emailResult.sent ? {} : { email_warning: emailResult.reason }),
  })
}

// ---------------------------------------------------------------------
// submit_application — step 3 → submitted_for_review
// Applicant submits the full onboarding form. Email-matched RLS keeps
// them locked to their own row; this function whitelists fields server-
// side and guards the transition.
// ---------------------------------------------------------------------
const SUBMITTABLE_FIELDS = [
  "website",
  "phone",
  "fulfilment_method",
  "payment_method",
  "site_name",
  "site_type_id",
  "site_type_other",
  "address_line_1",
  "address_line_2",
  "address_line_3",
  "city",
  "postcode",
  "site_phone",
  "site_email",
  "notes",
] as const

async function submitApplication(
  supabase: ReturnType<typeof createClient>,
  params: { request_id: string; payload: Record<string, unknown> },
  user: { id: string; email?: string },
) {
  const { request_id, payload } = params
  if (!request_id || !payload) return errorResponse(400, "request_id and payload required")
  if (!user.email) return errorResponse(400, "User has no email claim")

  const { data: request } = await supabase
    .from("portal_registration_requests")
    .select("email, status")
    .eq("id", request_id)
    .single()

  if (!request) return errorResponse(404, "Request not found")
  if (request.email !== user.email) return errorResponse(403, "Not your application")
  if (!["approved", "onboarding_in_progress"].includes(request.status)) {
    return errorResponse(409, `Cannot submit from status ${request.status}`)
  }

  // Whitelist payload fields — never spread unvalidated input
  const clean: Record<string, unknown> = {}
  for (const key of SUBMITTABLE_FIELDS) {
    if (key in payload) clean[key] = payload[key]
  }

  const { error } = await supabase
    .from("portal_registration_requests")
    .update({ ...clean, status: "submitted_for_review" })
    .eq("id", request_id)
    .in("status", ["approved", "onboarding_in_progress"])

  if (error) {
    console.error("submit_application update failed:", error)
    return errorResponse(500, "Failed to submit application")
  }

  // TODO: notify GMC admins (email or in-portal notification)
  return jsonResponse({ success: true })
}

// ---------------------------------------------------------------------
// accept_application — step 4: submitted_for_review → active
// Atomic-ish create of customers + first branches row. Compensating
// delete on branch failure (JS client has no native multi-statement txn).
// ---------------------------------------------------------------------
const PAYMENT_METHOD_MAP: Record<string, string> = {
  xero_bacs: "xero",
  gocardless_dd: "gocardless",
  cash_on_delivery: "cash",
}

async function acceptApplication(
  supabase: ReturnType<typeof createClient>,
  params: { request_id: string; reviewed_from?: "portal" | "odin" },
  reviewerId: string,
) {
  const { request_id, reviewed_from } = params
  if (!request_id) return errorResponse(400, "request_id is required")
  if (reviewed_from && reviewed_from !== "portal") {
    return errorResponse(400, "Step-4 acceptance is portal-only in v1")
  }

  const { data: request } = await supabase
    .from("portal_registration_requests")
    .select("*")
    .eq("id", request_id)
    .eq("status", "submitted_for_review")
    .single()
  if (!request) return errorResponse(409, "Request not found or not in review state")

  const required = [
    "business_name", "email", "fulfilment_method",
    "site_name", "site_type_id", "address_line_1", "city", "postcode",
  ] as const
  for (const f of required) {
    if (!request[f]) return errorResponse(400, `Missing required field: ${f}`)
  }

  // 1. Create customers row
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .insert({
      name: request.business_name,
      email: request.email,
      phone: request.phone,
      website_url: request.website,
      transmission: request.fulfilment_method,
      payment_method: PAYMENT_METHOD_MAP[request.payment_method] ?? null,
      // price_tier_id, reference_code, payment_terms, xero_*, gocardless_*
      // left NULL — Odin admin populates after acceptance
    })
    .select()
    .single()
  if (custErr || !customer) {
    console.error("customers insert failed:", custErr)
    return errorResponse(500, "Failed to create customer")
  }

  // 2. Create first branch
  const { error: branchErr } = await supabase
    .from("branches")
    .insert({
      customer_id: customer.id,
      name: request.site_name,
      branch_type: "branch",
      type_id: request.site_type_id,
      address_line_1: request.address_line_1,
      address_line_2: request.address_line_2,
      address_line_3: request.address_line_3,
      city: request.city,
      postcode: request.postcode,
      phone: request.site_phone,
      email: request.site_email,
    })
  if (branchErr) {
    console.error("branches insert failed, rolling back customer:", branchErr)
    await supabase.from("customers").delete().eq("id", customer.id)
    return errorResponse(500, "Failed to create branch — customer rolled back")
  }

  // 3. Activate portal_users row
  await supabase
    .from("portal_users")
    .update({
      customer_id: customer.id,
      status: "active",
      accepted_at: new Date().toISOString(),
    })
    .eq("email", request.email)

  // 4. Mark request as active
  await supabase
    .from("portal_registration_requests")
    .update({
      status: "active",
      customer_id: customer.id,
      accepted_by: reviewerId,
      accepted_at: new Date().toISOString(),
      reviewed_from: "portal",
    })
    .eq("id", request_id)

  // TODO: send "you're in" email to applicant
  return jsonResponse({ success: true, customer_id: customer.id })
}

// ---------------------------------------------------------------------
// reject_application — any non-terminal state → rejected
// ---------------------------------------------------------------------
async function rejectApplication(
  supabase: ReturnType<typeof createClient>,
  params: { request_id: string; reason?: string; reviewed_from?: "portal" | "odin" },
  reviewerId: string,
) {
  const { request_id, reason, reviewed_from } = params
  if (!request_id) return errorResponse(400, "request_id is required")
  if (reviewed_from && !["portal", "odin"].includes(reviewed_from)) {
    return errorResponse(400, "invalid reviewed_from")
  }

  const { data, error } = await supabase
    .from("portal_registration_requests")
    .update({
      status: "rejected",
      rejection_reason: reason ?? null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      reviewed_from: reviewed_from ?? "portal",
    })
    .eq("id", request_id)
    .in("status", [
      "interest_submitted",
      "approved",
      "onboarding_in_progress",
      "submitted_for_review",
    ])
    .select()
    .single()

  if (error || !data) return errorResponse(409, "Request not found or already terminal")

  // TODO: send rejection email
  return jsonResponse({ success: true })
}

// ---------------------------------------------------------------------
// invite_existing — unchanged from previous implementation
// ---------------------------------------------------------------------
async function inviteExisting(
  supabase: ReturnType<typeof createClient>,
  params: { customer_id: string; email: string; display_name: string; role?: string },
  invitedBy: string,
  callerPortalUser: { role: string; customer_id: string | null },
  isSystemAdmin: boolean,
) {
  const { customer_id, email, display_name } = params
  const role = params.role === "admin" ? "admin" : "member"

  if (!customer_id || !email || !display_name) {
    return errorResponse(400, "customer_id, email, and display_name are required")
  }

  if (!isSystemAdmin && callerPortalUser.customer_id !== customer_id) {
    return errorResponse(403, "You can only invite users to your own account")
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, portal_enabled")
    .eq("id", customer_id)
    .single()
  if (customerError || !customer) return errorResponse(404, "Customer not found")
  if (!customer.portal_enabled) return errorResponse(400, "Portal access is not enabled for this customer")

  const { data: existingUser } = await supabase
    .from("portal_users")
    .select("id")
    .eq("email", email)
    .eq("customer_id", customer_id)
    .maybeSingle()
  if (existingUser) return errorResponse(409, "This email is already invited to this account")

  const { data: authData, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email, {
      data: { display_name },
      redirectTo: `${PORTAL_URL}/portal/onboarding`,
    })
  if (inviteError) {
    console.error("Failed to invite user:", inviteError)
    return errorResponse(500, "Failed to send invitation email")
  }

  const { error: portalUserError } = await supabase
    .from("portal_users")
    .insert({
      auth_user_id: authData.user.id,
      customer_id,
      role,
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
