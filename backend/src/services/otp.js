const crypto = require('crypto');
const supabase = require('./supabase');

const OTP_VALIDADE_MIN = 10;
const OTP_MAX_TENTATIVAS = 5;

function gerarCodigo() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashCodigo(codigo) {
  return crypto.createHash('sha256').update(String(codigo)).digest('hex');
}

// Invalida OTPs anteriores da parte e cria um novo. Retorna o código em claro
// (apenas para envio imediato via WhatsApp — no banco fica só o hash).
async function criarOtp(parteId, telefone) {
  await supabase
    .from('blindado_otp')
    .update({ usado: true })
    .eq('parte_id', parteId)
    .eq('usado', false);

  const codigo = gerarCodigo();
  const expiraEm = new Date(Date.now() + OTP_VALIDADE_MIN * 60 * 1000).toISOString();

  const { error } = await supabase.from('blindado_otp').insert({
    parte_id: parteId,
    telefone,
    codigo_hash: hashCodigo(codigo),
    expira_em: expiraEm,
  });

  if (error) throw new Error(error.message);
  return codigo;
}

async function verificarOtp(parteId, codigo) {
  const { data: otp } = await supabase
    .from('blindado_otp')
    .select('*')
    .eq('parte_id', parteId)
    .eq('usado', false)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return { ok: false, error: 'Nenhum código pendente. Solicite um novo.' };

  if (new Date(otp.expira_em) < new Date()) {
    await supabase.from('blindado_otp').update({ usado: true }).eq('id', otp.id);
    return { ok: false, error: 'Código expirado. Solicite um novo.' };
  }

  if (otp.tentativas >= OTP_MAX_TENTATIVAS) {
    await supabase.from('blindado_otp').update({ usado: true }).eq('id', otp.id);
    return { ok: false, error: 'Muitas tentativas. Solicite um novo código.' };
  }

  if (hashCodigo(codigo) !== otp.codigo_hash) {
    await supabase
      .from('blindado_otp')
      .update({ tentativas: otp.tentativas + 1 })
      .eq('id', otp.id);
    const restantes = OTP_MAX_TENTATIVAS - otp.tentativas - 1;
    return { ok: false, error: `Código incorreto. ${restantes > 0 ? `${restantes} tentativa(s) restante(s).` : 'Solicite um novo código.'}` };
  }

  await supabase.from('blindado_otp').update({ usado: true }).eq('id', otp.id);
  return { ok: true, telefone: otp.telefone };
}

module.exports = { criarOtp, verificarOtp, gerarCodigo, hashCodigo };
