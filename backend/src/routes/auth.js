const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

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
    const { nome, email, telefone, cpf, cidade, bio, aceita_online, senha, categorias } = req.body;
    if (!nome || !email || !telefone || !senha) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios: nome, email, telefone, senha' });
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
        cpf: cpf || null, cidade: cidade || 'Santa Maria',
        estado: 'RS', bio: bio || null,
        aceita_orcamento_online: aceita_online || false,
        ativo: true, verificado: false
      })
      .select('id');

    if (pErr) throw pErr;
    const prestadorId = pData[0].id;

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
