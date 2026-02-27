import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Visitor } from '../lib/types'

export function useVisitors() {
  const { site } = useAuth()
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('visitors')
      .select('*')
      .eq('is_anonymised', false)
      .order('name')
      .limit(200)
    setVisitors((data as Visitor[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const search = useCallback(async (query: string) => {
    if (!site) return
    setLoading(true)
    const q = query.trim().toLowerCase()
    let req = supabase
      .from('visitors')
      .select('*')
      .eq('is_anonymised', false)
      .order('name')
      .limit(50)

    if (q) {
      req = req.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
    }

    const { data } = await req
    setVisitors((data as Visitor[]) ?? [])
    setLoading(false)
  }, [site])

  const getById = useCallback(async (id: string): Promise<Visitor | null> => {
    const { data } = await supabase
      .from('visitors')
      .select('*')
      .eq('id', id)
      .single()
    return (data as Visitor) ?? null
  }, [])

  const getByToken = useCallback(async (token: string): Promise<Visitor | null> => {
    const { data } = await supabase
      .from('visitors')
      .select('*')
      .eq('access_token', token)
      .single()
    return (data as Visitor) ?? null
  }, [])

  const createVisitor = useCallback(async (payload: {
    name: string
    email: string
    phone?: string
    company?: string
    visitor_type: 'internal_staff' | 'third_party'
    created_by: string
  }): Promise<Visitor | null> => {
    const { data, error } = await supabase
      .from('visitors')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data as Visitor
  }, [])

  const updateVisitor = useCallback(async (id: string, updates: Partial<Visitor>): Promise<void> => {
    const { error } = await supabase
      .from('visitors')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }, [])

  const checkDuplicate = useCallback(async (_name: string, email: string): Promise<Visitor | null> => {
    const { data } = await supabase
      .from('visitors')
      .select('*')
      .eq('is_anonymised', false)
      .ilike('email', email.trim())
      .maybeSingle()
    return (data as Visitor) ?? null
  }, [])

  return { visitors, loading, search, fetchAll, getById, getByToken, createVisitor, updateVisitor, checkDuplicate }
}
