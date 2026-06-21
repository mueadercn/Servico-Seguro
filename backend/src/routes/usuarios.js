const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// GET /api/usuarios/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json({ ok: true, usuario: data });
  } catch (err) {
    res.status(404).json({ ok: false, error: 'Usuário não encontrado' });
  }
});

// PUT /api/usuarios/:id
router.put('/:id', async (req, res) => {
  try {
    const { nome, telefone, cpf, cidade, endereco } = req.body;
    const { data, error } = await supabase
      .from('usuarios')
      .update({ nome, telefone, cpf, cidade, endereco })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, usuario: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/usuarios/:id/orcs
router.get('/:id/orcs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orcs').select('*').eq('usuario_id', req.params.id)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, orcs: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/usuarios/:id/contratos
router.get('/:id/contratos', async (req, res) => {
  try {
    const { data: orcs } = await supabase
      .from('orcs').select('id').eq('usuario_id', req.params.id);
    const ids = (orcs || []).map(o => o.id);
    if (!ids.length) return res.json({ ok: true, contratos: [] });

    const { data, error } = await supabase
      .from('contratos').select('*, orcs(codigo, resumo_anamnese)')
      .in('orc_id', ids)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, contratos: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
