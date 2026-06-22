const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// ── VALIDAÇÕES ────────────────────────────────────────────────
function validarCPF(cpf) {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10]);
}

function validarCNPJ(cnpj) {
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n, weights) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(n[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return (
    calc(c, [5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(c[12]) &&
    calc(c, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(c[13])
  );
}

// ── LOGIN PRESTADOR ───────────────────────────────────────────
// POST /api/auth/prestador/login
router.post('/prestador/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ ok: false, error: 'Email e senha obrigatórios' });

    const { data, error } = await supabase
      .from('prestador_auth')
      .select('id, prestador_id, senha_hash, prestadores(nome, telefone, verificado)')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .limit(1);

    if (error || !data?.length) return res.status(401).json({ ok: false, error: 'Email não encontrado' });

    const reg = data[0];
    const senhaHash = Buffer.from(senha.trim()).toString('base64');
    if (reg.senha_hash !== senhaHash) return res.status(401).json({ ok: false, error: 'Senha incorreta' });

    await supabase.from('prestador_auth').update({ ultimo_acesso: new Date().toISOString() }).eq('id', reg.id);

    res.json({
      ok: true,
      usuario: {
        id: reg.prestador_id,
        nome: reg.prestadores?.nome,
        email: email.toLowerCase(),
        tipo: 'prestador',
        verificado: reg.prestadores?.verificado
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── LOGIN CONTRATANTE ─────────────────────────────────────────
// POST /api/auth/contratante/login
router.post('/contratante/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ ok: false, error: 'Email e senha obrigatórios' });

    const { data, error } = await supabase
      .from('contratante_auth')
      .select('id, usuario_id, senha_hash, usuarios(nome, telefone)')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .limit(1);

    if (error || !data?.length) return res.status(401).json({ ok: false, error: 'Email não encontrado' });

    const reg = data[0];
    const senhaHash = Buffer.from(senha.trim()).toString('base64');
    if (reg.senha_hash !== senhaHash) return res.status(401).json({ ok: false, error: 'Senha incorreta' });

    await supabase.from('contratante_auth').update({ ultimo_acesso: new Date().toISOString() }).eq('id', reg.id);

    res.json({
      ok: true,
      usuario: {
        id: reg.usuario_id,
        nome: reg.usuarios?.nome,
        email: email.toLowerCase(),
        tipo: 'contratante'
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── CADASTRO PRESTADOR ────────────────────────────────────────
// POST /api/auth/prestador/cadastro
router.post('/prestador/cadastro', async (req, res) => {
  try {
    const { nome, email, telefone, cpf, cnpj, razao_social, tipo_pessoa, cidade, bio, aceita_online, senha, categorias } = req.body;
    if (!nome || !email || !telefone || !senha) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios: nome, email, telefone, senha' });
    }

    // Validar documento
    const tipoPessoa = tipo_pessoa || 'pf';
    if (tipoPessoa === 'pf' && cpf) {
      if (!validarCPF(cpf)) return res.status(400).json({ ok: false, error: 'CPF inválido. Verifique os dígitos.' });
    }
    if (tipoPessoa === 'pj' && cnpj) {
      if (!validarCNPJ(cnpj)) return res.status(400).json({ ok: false, error: 'CNPJ inválido. Verifique os dígitos.' });
    }

    // Verificar email duplicado
    const { data: exist } = await supabase
      .from('prestador_auth').select('id').eq('email', email.toLowerCase()).limit(1);
    if (exist?.length) return res.status(400).json({ ok: false, error: 'Email já cadastrado' });

    // Criar prestador
    const { data: pData, error: pErr } = await supabase
      .from('prestadores')
      .insert({
        nome, email: email.toLowerCase(), telefone,
        cpf: tipoPessoa === 'pf' ? (cpf || null) : null,
        cnpj: tipoPessoa === 'pj' ? (cnpj || null) : null,
        razao_social: tipoPessoa === 'pj' ? (razao_social || nome) : null,
        tipo_pessoa: tipoPessoa,
        cidade: cidade || 'Santa Maria',
        estado: 'RS', bio: bio || null,
        aceita_orcamento_online: aceita_online || false,
        ativo: true, verificado: false
      })
      .select('id');

    if (pErr) throw pErr;
    const prestadorId = pData[0].id;

    // Associar categorias
    if (categorias?.length) {
      await supabase.from('prestador_categorias').insert(
        categorias.map((cid) => ({ prestador_id: prestadorId, categoria_id: cid }))
      );
    }

    // Criar auth
    const senhaHash = Buffer.from(senha).toString('base64');
    await supabase.from('prestador_auth').insert({
      prestador_id: prestadorId,
      email: email.toLowerCase(),
      senha_hash: senhaHash,
      ativo: true
    });

    res.json({
      ok: true,
      usuario: { id: prestadorId, nome, email: email.toLowerCase(), tipo: 'prestador' }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── CADASTRO CONTRATANTE ──────────────────────────────────────
// POST /api/auth/contratante/cadastro
router.post('/contratante/cadastro', async (req, res) => {
  try {
    const { nome, email, telefone, cpf, cidade, senha } = req.body;
    if (!nome || !email || !telefone || !senha) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios: nome, email, telefone, senha' });
    }

    if (cpf && !validarCPF(cpf)) {
      return res.status(400).json({ ok: false, error: 'CPF inválido. Verifique os dígitos.' });
    }

    const { data: exist } = await supabase
      .from('contratante_auth').select('id').eq('email', email.toLowerCase()).limit(1);
    if (exist?.length) return res.status(400).json({ ok: false, error: 'Email já cadastrado' });

    const { data: uData, error: uErr } = await supabase
      .from('usuarios')
      .insert({
        nome, email: email.toLowerCase(), telefone,
        cpf: cpf || null, cidade: cidade || 'Santa Maria',
        estado: 'RS', ativo: true
      })
      .select('id');

    if (uErr) throw uErr;
    const usuarioId = uData[0].id;

    const senhaHash = Buffer.from(senha).toString('base64');
    await supabase.from('contratante_auth').insert({
      usuario_id: usuarioId,
      email: email.toLowerCase(),
      senha_hash: senhaHash,
      ativo: true
    });

    res.json({
      ok: true,
      usuario: { id: usuarioId, nome, email: email.toLowerCase(), tipo: 'contratante' }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
