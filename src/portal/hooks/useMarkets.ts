import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { MarketLocation, MarketEvent, MarketEventWithLocation } from '../lib/types'

export function useMarkets() {
  const queryClient = useQueryClient()

  const locationsQuery = useQuery({
    queryKey: ['market-locations'],
    queryFn: async (): Promise<MarketLocation[]> => {
      const { data, error } = await supabase
        .from('market_locations')
        .select('*')
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  const eventsQuery = useQuery({
    queryKey: ['market-events'],
    queryFn: async (): Promise<MarketEventWithLocation[]> => {
      const { data, error } = await supabase
        .from('market_events')
        .select('*, market_locations(*)')
        .order('date')
      if (error) throw error
      return data || []
    },
  })

  const createLocation = useMutation({
    mutationFn: async (location: Omit<MarketLocation, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('market_locations')
        .insert(location)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-locations'] })
    },
  })

  const updateLocation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketLocation> & { id: string }) => {
      const { data, error } = await supabase
        .from('market_locations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-locations'] })
      queryClient.invalidateQueries({ queryKey: ['market-events'] })
    },
  })

  const deleteLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('market_locations')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-locations'] })
      queryClient.invalidateQueries({ queryKey: ['market-events'] })
    },
  })

  const createEvents = useMutation({
    mutationFn: async (events: Omit<MarketEvent, 'id' | 'created_at'>[]) => {
      const { data, error } = await supabase
        .from('market_events')
        .insert(events)
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-events'] })
    },
  })

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('market_events')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-events'] })
    },
  })

  return {
    locationsQuery,
    eventsQuery,
    createLocation,
    updateLocation,
    deleteLocation,
    createEvents,
    deleteEvent,
  }
}
