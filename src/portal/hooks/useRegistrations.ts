import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface RegistrationRequest {
  id: string
  business_name: string
  contact_name: string
  email: string
  phone: string | null
  message: string | null
  status: 'pending' | 'invited' | 'registered' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
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
      return data || []
    },
  })

  const approveRegistration = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('portal-registration', {
        body: { action: 'approve_registration', request_id: requestId },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration-requests'] })
    },
  })

  const rejectRegistration = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('portal-registration', {
        body: { action: 'reject_registration', request_id: requestId, reason },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration-requests'] })
    },
  })

  const pendingCount = (registrationsQuery.data || []).filter(r => r.status === 'pending').length

  return {
    registrations: registrationsQuery.data || [],
    pendingCount,
    loading: registrationsQuery.isLoading,
    error: registrationsQuery.error,
    approveRegistration,
    rejectRegistration,
  }
}
