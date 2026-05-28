const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// GET /api/config
router.get('/', async (req, res) => {
  try {
    const { data } = await supabase.from('configuracoes').select('chave, valor, descricao');
    // Remove sensitive keys from public response
    const safe = (data || []).filter(c => !c.chave.includes('key') && !c.chave.includes('secret'));
    res.json({ ok: true, configs: safe });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/config/:chave
router.put('/:chave', async (req, res) => {
  try {
    const { valor } = req.body;
    const { data, error } = await supabase
      .from('configuracoes')
      .upsert({ chave: req.params.chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' })
      .select().single();
    if (error) throw error;
    res.json({ ok: true, config: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/config/comissoes
router.get('/comissoes', async (req, res) => {
  try {
    const { data } = await supabase.from('comissoes').select('*').eq('ativo', true).order('ordem');
    res.json({ ok: true, comissoes: data || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
