import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mejzfpivpbdhcmfepfdh.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lanpmcGl2cGJkaGNtZmVwZmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDYxMzcsImV4cCI6MjA5NTIyMjEzN30.NVs6rC27r44rKPngLa91BF3oazkl4XuTpLzJLQbKIfo'

export const supabase = createClient(supabaseUrl, supabaseKey)

export const getPrestador = () => {
  const s = localStorage.getItem('ss_prestador')
  return s ? JSON.parse(s) : null
}

export const getContratante = () => {
  const s = localStorage.getItem('ss_contratante')
  return s ? JSON.parse(s) : null
}

export const logout = () => {
  localStorage.removeItem('ss_prestador')
  localStorage.removeItem('ss_contratante')
  window.location.href = '/auth'
}

const API_URL = import.meta.env.VITE_API_URL || 'https://servi-o-seguro-production.up.railway.app'

export async function apiCall(path: string, options: any = {}) {
  const { body, ...rest } = options
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...rest,
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro')
  return data
}
