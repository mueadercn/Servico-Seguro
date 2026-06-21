const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
// Tenta SERVICE_KEY primeiro, fallback para ANON_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('[Supabase] URL:', supabaseUrl ? 'OK' : 'MISSING');
console.log('[Supabase] KEY:', supabaseKey ? 'OK (' + supabaseKey.substring(0,20) + '...)' : 'MISSING');
console.log('[Supabase] SERVICE_KEY env:', process.env.SUPABASE_SERVICE_KEY ? 'presente' : 'ausente');
console.log('[Supabase] ANON_KEY env:', process.env.SUPABASE_ANON_KEY ? 'presente' : 'ausente');

if (!supabaseUrl || !supabaseKey) {
  console.error('[Supabase] ERRO FATAL: credenciais ausentes');
  console.error('Variáveis disponíveis:', Object.keys(process.env).filter(k => k.includes('SUPA')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }
});

module.exports = supabase;
