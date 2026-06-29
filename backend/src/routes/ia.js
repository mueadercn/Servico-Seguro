const express = require('express');
const router = express.Router();
const { conduzirAnamnese, gerarResumo, systemPrompts } = require('../services/ia');
const supabase = require('../services/supabase');

// ── CHAT DE ANAMNESE ──────────────────────────────────────────
// POST /api/ia/anamnese
router.post('/anamnese', async (req, res) => {
  try {
    const { mensagem, historico = [], cat_nome, servico_nome, orc_id, prestador_nome = '' } = req.body;

    const novoHistorico = [...historico, { role: 'user', content: mensagem }];

    const resultado = await conduzirAnamnese(novoHistorico, cat_nome, servico_nome, prestador_nome);

    if (!resultado.ok) {
      return res.status(500).json({ ok: false, error: resultado.error });
    }

    if (resultado.concluida) {
      const { resumo } = await gerarResumo(novoHistorico, servico_nome);

      if (orc_id) {
        await supabase.from('orcs').update({
          status: 'ANAMNESE CONCLUÍDA',
          resumo_anamnese: resumo
        }).eq('id', orc_id);
      }

      return res.json({
        ok: true,
        concluida: true,
        resumo,
        historico: novoHistorico
      });
    }

    res.json({
      ok: true,
      concluida: false,
      resposta: resultado.resposta,
      historico: [...novoHistorico, { role: 'assistant', content: resultado.resposta }]
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── SYSTEM PROMPTS (para admin editar) ───────────────────────
// GET /api/ia/prompts
router.get('/prompts', async (req, res) => {
  try {
    const { data } = await supabase
      .from('configuracoes')
      .select('chave, valor, descricao')
      .like('chave', 'system_prompt%');

    res.json({ ok: true, prompts: data || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/ia/prompts/:chave
router.put('/prompts/:chave', async (req, res) => {
  try {
    const { valor } = req.body;
    const { data, error } = await supabase
      .from('configuracoes')
      .upsert({ chave: req.params.chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' })
      .select()
      .single();

    if (error) throw error;
    res.json({ ok: true, config: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
