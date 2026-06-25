const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// GET /api/categorias — listar todas as categorias ativas
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nome, icone')
      .eq('ativa', true)
      .order('nome');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/categorias/:id/tags — tags sugeridas para uma categoria
router.get('/:id/tags', async (req, res) => {
  try {
    const { data } = await supabase
      .from('tags_sugeridas')
      .select('nome')
      .eq('categoria_id', req.params.id)
      .eq('ativo', true)
      .order('nome');
    res.json(data?.map(t => t.nome) || []);
  } catch (err) {
    res.json([]);
  }
});

// POST /api/categorias/:id/tags — adicionar tag sugerida (admin)
router.post('/:id/tags', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ ok: false, error: 'nome obrigatório' });
    const { error } = await supabase.from('tags_sugeridas').insert({
      categoria_id: req.params.id,
      nome: nome.toLowerCase().trim(),
      ativo: true
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/categorias/:id/tags/:nome — remover tag sugerida (admin)
router.delete('/:id/tags/:nome', async (req, res) => {
  try {
    await supabase.from('tags_sugeridas')
      .update({ ativo: false })
      .eq('categoria_id', req.params.id)
      .eq('nome', decodeURIComponent(req.params.nome));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
