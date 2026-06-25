const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// GET /api/servicos — listar com filtros
router.get('/', async (req, res) => {
  try {
    const { cat, cidade, q, prestador_id, limit = 50 } = req.query;
    let query = supabase
      .from('servicos')
      .select('*, prestadores(nome,nota_media,verificado,aceita_orcamento_online), categorias(nome,icone)')
      .eq('ativo', true)
      .limit(Number(limit));

    if (prestador_id) query = query.eq('prestador_id', prestador_id);
    if (cidade) query = query.eq('cidade', cidade);

    const { data, error } = await query;
    if (error) throw error;

    let result = data || [];
    if (q) {
      const qLower = q.toLowerCase();
      result = result.filter(s =>
        s.titulo?.toLowerCase().includes(qLower) ||
        s.categorias?.nome?.toLowerCase().includes(qLower) ||
        s.prestadores?.nome?.toLowerCase().includes(qLower)
      );
    }
    if (cat) {
      result = result.filter(s => s.categorias?.nome === cat);
    }

    res.json({ ok: true, servicos: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/servicos/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servicos')
      .select('*, prestadores(*), categorias(*), servico_fotos(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json({ ok: true, servico: data });
  } catch (err) {
    res.status(404).json({ ok: false, error: 'Serviço não encontrado' });
  }
});

// POST /api/servicos — criar
router.post('/', async (req, res) => {
  try {
    const { titulo, descricao, prestador_id, categoria_id, tipo, valor_fixo, cidade, aceita_orcamento_online, tags } = req.body;
    if (!titulo || !prestador_id) return res.status(400).json({ ok: false, error: 'Título e prestador obrigatórios' });

    const tagsLimpo = Array.isArray(tags) ? tags.slice(0, 3) : [];
    const { data, error } = await supabase
      .from('servicos')
      .insert({ titulo, descricao, prestador_id, categoria_id, tipo: tipo || 'orcamento', valor_fixo, cidade, aceita_orcamento_online: aceita_orcamento_online || false, ativo: true, tags: tagsLimpo })
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, servico: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/servicos/:id — atualizar
router.put('/:id', async (req, res) => {
  try {
    const { titulo, descricao, categoria_id, tipo, valor_fixo, cidade, aceita_orcamento_online, ativo, tags } = req.body;
    const tagsLimpo = Array.isArray(tags) ? tags.slice(0, 3) : undefined;
    const { data, error } = await supabase
      .from('servicos')
      .update({ titulo, descricao, categoria_id, tipo, valor_fixo, cidade, aceita_orcamento_online, ativo, ...(tagsLimpo !== undefined ? { tags: tagsLimpo } : {}) })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, servico: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/servicos/:id
router.delete('/:id', async (req, res) => {
  try {
    await supabase.from('servicos').update({ ativo: false }).eq('id', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/servicos/:id/fotos — adicionar foto
router.post('/:id/fotos', async (req, res) => {
  try {
    const { url, ordem } = req.body;
    const { data, error } = await supabase
      .from('servico_fotos')
      .insert({ servico_id: req.params.id, url, ordem: ordem || 0 })
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, foto: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/servicos/fotos/:fotoId
router.delete('/fotos/:fotoId', async (req, res) => {
  try {
    await supabase.from('servico_fotos').delete().eq('id', req.params.fotoId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
