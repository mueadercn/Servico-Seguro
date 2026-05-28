import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const getSession = async () => {
  const stored = localStorage.getItem('ss_prestador') || localStorage.getItem('ss_contratante')
  return stored ? JSON.parse(stored) : null
}

export const logout = () => {
  localStorage.removeItem('ss_prestador')
  localStorage.removeItem('ss_contratante')
  window.location.href = '/auth'
}
