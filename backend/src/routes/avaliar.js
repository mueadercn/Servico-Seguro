const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const supabase = require(path.join(__dirname, '../services/supabase'));
const { enviarMensagem } = require(path.join(__dirname, '../services/whatsapp'));

const FRONTEND_URL = (() => {
  const u = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  return (u && !u.includes('classy-cucurucho')) ? u : 'https://venerable-kitten-a7b2cd.netlify.app';
})();

// ── MARCAR SERVIÇO COMO CONCLUÍDO ────────────────────────────
// POST /api/avaliar/concluir/:orcId
router.post('/concluir/:orcId', async (req, res) => {
  const { orcId } = req.params;

  const { data: orc, error } = await supabase
    .from('orcs')
    .select('*, prestadores(nome, telefone)')
    .eq('id', orcId)
    .single();

  if (error || !orc) return res.status(404).json({ error: 'ORC não encontrado' });
  if (orc.status !== 'CONTRATO ASSINADO') {
    return res.status(400).json({ error: 'O contrato precisa estar assinado por ambas as partes.' });
  }
  if (orc.servico_concluido) {
    return res.status(400).json({ error: 'Serviço já marcado como concluído.' });
  }

  const tokenCliente = crypto.randomBytes(16).toString('hex');
  const tokenPrestador = crypto.randomBytes(16).toString('hex');
  const agora = new Date().toISOString();

  await supabase.from('orcs').update({
    status: 'SERVIÇO CONCLUÍDO',
    servico_concluido: true,
    avaliacao_token_cliente: tokenCliente,
    avaliacao_token_prestador: tokenPrestador,
    avaliacao_solicitada_em: agora,
  }).eq('id', orcId);

  await supabase.from('custodia_log').insert({
    orc_id: orcId,
    acao: 'SERVICO_CONCLUIDO',
    agente: 'prestador',
    dados: { marcado_em: agora }
  });

  const prestadorNome = orc.prestadores?.nome || 'o profissional';
  const clienteNome = orc.nome_cliente || 'o cliente';

  // WhatsApp para o cliente
  if (orc.telefone_cliente) {
    await enviarMensagem(orc.telefone_cliente,
      `⭐ *${clienteNome}*, o serviço *${orc.codigo}* foi concluído!\n\n` +
      `Como foi a experiência com *${prestadorNome}*?\n` +
      `Sua avaliação ajuda outros clientes a escolher com segurança.\n\n` +
      `👉 Avaliar agora: ${FRONTEND_URL}/avaliar/${tokenCliente}`
    );
  }

  // WhatsApp para o prestador
  if (orc.prestadores?.telefone) {
    await enviarMensagem(orc.prestadores.telefone,
      `⭐ *${prestadorNome}*, o serviço *${orc.codigo}* foi marcado como concluído!\n\n` +
      `Como foi trabalhar com *${clienteNome}*?\n` +
      `Sua avaliação é importante para a comunidade.\n\n` +
      `👉 Avaliar agora: ${FRONTEND_URL}/avaliar/${tokenPrestador}`
    );
  }

  res.json({ ok: true, tokenCliente, tokenPrestador });
});

// ── BUSCAR CONTEXTO DA AVALIAÇÃO ─────────────────────────────
// GET /api/avaliar/:token
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  // Tenta token de cliente primeiro, depois prestador
  let { data: orc } = await supabase
    .from('orcs')
    .select('*, prestadores(id, nome, telefone)')
    .eq('avaliacao_token_cliente', token)
    .maybeSingle();

  let papel = 'cliente';
  if (!orc) {
    const result = await supabase
      .from('orcs')
      .select('*, prestadores(id, nome, telefone)')
      .eq('avaliacao_token_prestador', token)
      .maybeSingle();
    orc = result.data;
    papel = 'prestador';
  }

  if (!orc) return res.status(404).json({ error: 'Link de avaliação não encontrado ou já expirou.' });

  // Verificar se já avaliou
  const avaliadorId = papel === 'cliente' ? orc.usuario_id : orc.prestador_id;
  const avaliadorTipo = papel;
  const { data: jaAvaliou } = await supabase
    .from('avaliacoes')
    .select('id')
    .eq('orc_id', orc.id)
    .eq('avaliado_tipo', papel === 'cliente' ? 'prestador' : 'cliente')
    .eq('avaliador', papel)
    .maybeSingle();

  // Prazo de 7 dias
  const expirado = orc.avaliacao_solicitada_em
    ? (Date.now() - new Date(orc.avaliacao_solicitada_em).getTime()) > 7 * 24 * 3600000
    : false;

  res.json({
    papel,
    orc_id: orc.id,
    codigo: orc.codigo,
    avaliador_nome: papel === 'cliente' ? orc.nome_cliente : orc.prestadores?.nome,
    avaliado_nome: papel === 'cliente' ? orc.prestadores?.nome : orc.nome_cliente,
    avaliado_id: papel === 'cliente' ? orc.prestadores?.id : orc.usuario_id,
    avaliado_tipo: papel === 'cliente' ? 'prestador' : 'cliente',
    ja_avaliou: !!jaAvaliou,
    expirado,
  });
});

// ── SUBMETER AVALIAÇÃO ────────────────────────────────────────
// POST /api/avaliar/:token
router.post('/:token', async (req, res) => {
  const { token } = req.params;
  const { nota, comentario } = req.body;

  if (!nota || nota < 1 || nota > 5) {
    return res.status(400).json({ error: 'Nota deve ser entre 1 e 5.' });
  }

  // Encontrar ORC pelo token
  let { data: orc } = await supabase
    .from('orcs')
    .select('*, prestadores(id, nome)')
    .eq('avaliacao_token_cliente', token)
    .maybeSingle();

  let papel = 'cliente';
  if (!orc) {
    const result = await supabase
      .from('orcs')
      .select('*, prestadores(id, nome)')
      .eq('avaliacao_token_prestador', token)
      .maybeSingle();
    orc = result.data;
    papel = 'prestador';
  }

  if (!orc) return res.status(404).json({ error: 'Link de avaliação inválido.' });

  const avaliado_id = papel === 'cliente' ? orc.prestadores?.id : orc.usuario_id;
  const avaliado_tipo = papel === 'cliente' ? 'prestador' : 'cliente';

  // Verificar duplicidade
  const { data: existente } = await supabase
    .from('avaliacoes')
    .select('id')
    .eq('orc_id', orc.id)
    .eq('avaliador', papel)
    .maybeSingle();

  if (existente) return res.status(400).json({ error: 'Você já avaliou este serviço.' });

  // Inserir avaliação
  const { error } = await supabase.from('avaliacoes').insert({
    orc_id: orc.id,
    avaliado_id,
    avaliado_tipo,
    nota: parseInt(nota),
    comentario: comentario || null,
    avaliador: papel,
  });

  if (error) return res.status(500).json({ error: error.message });

  // Atualizar nota média do prestador
  if (avaliado_tipo === 'prestador' && avaliado_id) {
    const { data: todasAvaliacoes } = await supabase
      .from('avaliacoes')
      .select('nota')
      .eq('avaliado_id', avaliado_id)
      .eq('avaliado_tipo', 'prestador');

    if (todasAvaliacoes?.length) {
      const media = todasAvaliacoes.reduce((s, a) => s + a.nota, 0) / todasAvaliacoes.length;
      await supabase.from('prestadores').update({
        nota_media: parseFloat(media.toFixed(1)),
        total_avaliacoes: todasAvaliacoes.length,
      }).eq('id', avaliado_id);
    }
  }

  res.json({ ok: true });
});

module.exports = router;
