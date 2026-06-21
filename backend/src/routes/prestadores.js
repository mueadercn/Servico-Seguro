const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// GET /api/prestadores — listar ativos
router.get('/', async (req, res) => {
  try {
    const { cidade, cat, limit = 20 } = req.query;
    let query = supabase.from('prestadores').select('*').eq('ativo', true)
      .order('nota_media', { ascending: false }).limit(Number(limit));
    if (cidade) query = query.eq('cidade', cidade);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ ok: true, prestadores: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/prestadores/:id — perfil
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prestadores')
      .select('*, servicos(*, categorias(nome,icone))')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json({ ok: true, prestador: data });
  } catch (err) {
    res.status(404).json({ ok: false, error: 'Prestador não encontrado' });
  }
});

// PUT /api/prestadores/:id — atualizar perfil
router.put('/:id', async (req, res) => {
  try {
    const { nome, telefone, cpf, cidade, bio, aceita_orcamento_online } = req.body;
    const { data, error } = await supabase
      .from('prestadores')
      .update({ nome, telefone, cpf, cidade, bio, aceita_orcamento_online })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, prestador: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/prestadores/:id/servicos
router.get('/:id/servicos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servicos')
      .select('*, categorias(nome,icone)')
      .eq('prestador_id', req.params.id)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, servicos: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/prestadores/:id/leads
router.get('/:id/leads', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orcs')
      .select('*')
      .eq('prestador_id', req.params.id)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, leads: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/prestadores/:id/avaliacoes
router.get('/:id/avaliacoes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('*')
      .eq('avaliado_id', req.params.id)
      .eq('avaliado_tipo', 'prestador')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, avaliacoes: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/prestadores/:id/verificado — admin aprova verificação
router.put('/:id/verificado', async (req, res) => {
  try {
    const { verificado } = req.body;
    const { data, error } = await supabase
      .from('prestadores')
      .update({ verificado })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, prestador: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
