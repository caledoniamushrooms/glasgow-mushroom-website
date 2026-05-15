import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type RegistrationStatus =
  | 'interest_submitted'
  | 'approved'
  | 'onboarding_in_progress'
  | 'submitted_for_review'
  | 'active'
  | 'rejected'

export interface RegistrationRequest {
  id: string
  business_name: string
  contact_name: string
  email: string
  phone: string | null
  message: string | null
  status: RegistrationStatus

  website: string | null
  fulfilment_method: 'delivery' | 'collection' | 'courier' | null
  payment_method: 'xero_bacs' | 'gocardless_dd' | 'cash_on_delivery' | null
  site_name: string | null
  site_type_id: string | null
  site_type_other: boolean
  address_line_1: string | null
  address_line_2: string | null
  address_line_3: string | null
  city: string | null
  postcode: string | null
  site_phone: string | null
  site_email: string | null
  notes: string | null

  reviewed_by: string | null
  reviewed_at: string | null
  reviewed_from: 'portal' | 'odin' | null
  approved_by: string | null
  approved_at: string | null
  accepted_by: string | null
  accepted_at: string | null
  rejection_reason: string | null
  customer_id: string | null
  created_at: string
}

export function useRegistrations() {
  const queryClient = useQueryClient()

  const registrationsQuery = useQuery({
    queryKey: ['registration-requests'],
    queryFn: async (): Promise<RegistrationRequest[]> => {
      const { data, error } = await supabase
        .from('portal_registration_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as RegistrationRequest[]
    },
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['registration-requests'] })

  const approveRegistration = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('portal-registration', {
        body: {
          action: 'approve_registration',
          request_id: requestId,
          reviewed_from: 'portal',
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const acceptApplication = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('portal-registration', {
        body: {
          action: 'accept_application',
          request_id: requestId,
          reviewed_from: 'portal',
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const rejectApplication = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('portal-registration', {
        body: {
          action: 'reject_application',
          request_id: requestId,
          reason,
          reviewed_from: 'portal',
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const all = registrationsQuery.data || []
  const interestPending = all.filter(r => r.status === 'interest_submitted')
  const reviewPending = all.filter(r => r.status === 'submitted_for_review')

  return {
    registrations: all,
    interestPending,
    reviewPending,
    interestPendingCount: interestPending.length,
    reviewPendingCount: reviewPending.length,
    loading: registrationsQuery.isLoading,
    error: registrationsQuery.error,
    approveRegistration,
    acceptApplication,
    rejectApplication,
  }
}
