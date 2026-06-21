const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// ── ADMIN — DASHBOARD ─────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [orcs, prests, users, contratos] = await Promise.all([
      supabase.from('orcs').select('id, status', { count: 'exact' }),
      supabase.from('prestadores').select('id, ativo, verificado', { count: 'exact' }),
      supabase.from('usuarios').select('id', { count: 'exact' }),
      supabase.from('contratos').select('id, valor, comissao', { count: 'exact' }),
    ]);

    const totalComissao = (contratos.data || []).reduce((a, c) => a + (Number(c.comissao) || 0), 0);

    res.json({
      ok: true,
      stats: {
        total_orcs: orcs.count || 0,
        orcs_ativos: (orcs.data || []).filter(o => !['ENCERRADO','CANCELADO','NÃO FECHOU'].includes(o.status)).length,
        total_prestadores: prests.count || 0,
        prestadores_ativos: (prests.data || []).filter(p => p.ativo).length,
        prestadores_verificados: (prests.data || []).filter(p => p.verificado).length,
        total_usuarios: users.count || 0,
        total_contratos: contratos.count || 0,
        total_comissao: totalComissao,
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/orcs — todos os ORCs
router.get('/orcs', async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    let query = supabase
      .from('orcs')
      .select('*, prestadores(nome,telefone), usuarios(nome,telefone)')
      .order('criado_em', { ascending: false })
      .limit(Number(limit));
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ ok: true, orcs: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/prestadores
router.get('/prestadores', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prestadores').select('*').order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, prestadores: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/usuarios
router.get('/usuarios', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios').select('*').order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, usuarios: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/contratos
router.get('/contratos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contratos')
      .select('*, orcs(codigo, nome_cliente, prestadores(nome))')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, contratos: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/custodia
router.get('/custodia', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('custodia_log').select('*').order('criado_em', { ascending: false }).limit(200);
    if (error) throw error;
    res.json({ ok: true, logs: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/admin/prestadores/:id/verificado
router.put('/prestadores/:id/verificado', async (req, res) => {
  try {
    const { verificado } = req.body;
    const { data, error } = await supabase
      .from('prestadores').update({ verificado }).eq('id', req.params.id).select().single();
    if (error) throw error;

    await supabase.from('custodia_log').insert({
      acao: verificado ? 'PRESTADOR_VERIFICADO_ADMIN' : 'PRESTADOR_VERIFICACAO_REMOVIDA',
      agente: 'admin',
      dados: { prestador_id: req.params.id }
    });

    res.json({ ok: true, prestador: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── CATEGORIAS ────────────────────────────────────────────────
// GET /api/admin/categorias
router.get('/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categorias').select('*').order('nome');
    if (error) throw error;
    res.json({ ok: true, categorias: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/categorias
router.post('/categorias', async (req, res) => {
  try {
    const { nome, icone, descricao } = req.body;
    const { data, error } = await supabase.from('categorias')
      .insert({ nome, icone, descricao, ativa: true }).select().single();
    if (error) throw error;
    res.json({ ok: true, categoria: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/admin/categorias/:id
router.put('/categorias/:id', async (req, res) => {
  try {
    const { nome, icone, descricao, ativa } = req.body;
    const { data, error } = await supabase.from('categorias')
      .update({ nome, icone, descricao, ativa }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ ok: true, categoria: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── AVALIAÇÕES ────────────────────────────────────────────────
// GET /api/admin/avaliacoes
router.get('/avaliacoes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('avaliacoes').select('*, orcs(codigo)')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, avaliacoes: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/avaliacoes — admin cria avaliação
router.post('/avaliacoes', async (req, res) => {
  try {
    const { orc_id, avaliado_id, avaliado_tipo, nota, comentario } = req.body;
    const { data, error } = await supabase.from('avaliacoes')
      .insert({ orc_id, avaliado_id, avaliado_tipo, nota, comentario, avaliador: 'admin' })
      .select().single();
    if (error) throw error;

    // Atualizar nota média do prestador
    if (avaliado_tipo === 'prestador') {
      const { data: avs } = await supabase.from('avaliacoes')
        .select('nota').eq('avaliado_id', avaliado_id).eq('avaliado_tipo', 'prestador');
      if (avs?.length) {
        const media = avs.reduce((a, v) => a + v.nota, 0) / avs.length;
        await supabase.from('prestadores').update({
          nota_media: Number(media.toFixed(1)),
          total_avaliacoes: avs.length
        }).eq('id', avaliado_id);
      }
    }

    res.json({ ok: true, avaliacao: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── COMISSÕES ─────────────────────────────────────────────────
// GET /api/admin/comissoes
router.get('/comissoes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('comissoes').select('*').order('ordem');
    if (error) throw error;
    res.json({ ok: true, comissoes: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/admin/comissoes/:id
router.put('/comissoes/:id', async (req, res) => {
  try {
    const { valor, tipo } = req.body;
    const { data, error } = await supabase.from('comissoes')
      .update({ valor, tipo }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ ok: true, comissao: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── BIOMETRIA ─────────────────────────────────────────────────
// POST /api/admin/biometria/verificar — registra verificação biométrica
router.post('/biometria/verificar', async (req, res) => {
  try {
    const { usuario_id, tipo_usuario, confianca, aprovado } = req.body;
    const tabela = tipo_usuario === 'prestador' ? 'prestadores' : 'usuarios';

    if (aprovado) {
      await supabase.from(tabela).update({ verificado: true }).eq('id', usuario_id);
    }

    await supabase.from('custodia_log').insert({
      acao: aprovado ? 'BIOMETRIA_VERIFICADA' : 'BIOMETRIA_REPROVADA',
      agente: `${tipo_usuario}:${usuario_id}`,
      dados: {
        confianca,
        aprovado,
        timestamp: new Date().toISOString(),
        tipo_usuario
      }
    });

    res.json({ ok: true, verificado: aprovado });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/biometria — lista status de verificação
router.get('/biometria', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prestadores')
      .select('id, nome, telefone, cidade, verificado, criado_em')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({
      ok: true,
      prestadores: data,
      stats: {
        verificados: (data || []).filter(p => p.verificado).length,
        pendentes: (data || []).filter(p => !p.verificado).length,
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
