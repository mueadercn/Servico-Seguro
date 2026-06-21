const express = require('express');
const router = express.Router();
const path = require('path');
const supabase = require(path.join(__dirname, '../services/supabase'));
const { enviarMensagem } = require(path.join(__dirname, '../services/whatsapp'));
const crypto = require('crypto');

// ── BUSCAR CHAT POR TOKEN ─────────────────────────────────────
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  const { data: chat, error } = await supabase
    .from('chat_negociacao')
    .select(`
      *,
      orcs (
        id, codigo, status, resumo_anamnese,
        nome_cliente, telefone_cliente,
        servico_nome,
        prestadores ( id, nome, telefone )
      )
    `)
    .eq('link_token', token)
    .single();

  if (error || !chat) {
    return res.status(404).json({ error: 'Chat não encontrado' });
  }

  res.json(chat);
});

// ── BUSCAR MENSAGENS ──────────────────────────────────────────
router.get('/:token/mensagens', async (req, res) => {
  const { token } = req.params;

  const { data: chat } = await supabase
    .from('chat_negociacao')
    .select('id')
    .eq('link_token', token)
    .single();

  if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });

  const { data: mensagens } = await supabase
    .from('chat_mensagens')
    .select('*')
    .eq('chat_id', chat.id)
    .order('criado_em', { ascending: true });

  res.json(mensagens || []);
});

// ── ENVIAR MENSAGEM ───────────────────────────────────────────
router.post('/:token/mensagens', async (req, res) => {
  const { token } = req.params;
  const { remetente, tipo, conteudo } = req.body;

  if (!remetente || !tipo || !conteudo) {
    return res.status(400).json({ error: 'remetente, tipo e conteudo são obrigatórios' });
  }

  const { data: chat } = await supabase
    .from('chat_negociacao')
    .select('id, status')
    .eq('link_token', token)
    .single();

  if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });
  if (chat.status === 'finalizado') {
    return res.status(400).json({ error: 'Chat já finalizado' });
  }

  const { data: msg, error } = await supabase
    .from('chat_mensagens')
    .insert({ chat_id: chat.id, remetente, tipo, conteudo })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json(msg);
});

// ── ATUALIZAR STATUS ──────────────────────────────────────────
router.patch('/:token/status', async (req, res) => {
  const { token } = req.params;
  const { status } = req.body;

  const statusValidos = ['conversando', 'aguardando_orcamento', 'orcamento_enviado'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const { data: chat, error } = await supabase
    .from('chat_negociacao')
    .update({ status })
    .eq('link_token', token)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json(chat);
});

// ── FINALIZAR NEGOCIAÇÃO ──────────────────────────────────────
router.post('/:token/finalizar', async (req, res) => {
  const { token } = req.params;
  const { papel } = req.body; // 'cliente' | 'prestador'

  if (!['cliente', 'prestador'].includes(papel)) {
    return res.status(400).json({ error: 'papel deve ser cliente ou prestador' });
  }

  const { data: chat } = await supabase
    .from('chat_negociacao')
    .select('*')
    .eq('link_token', token)
    .single();

  if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });
  if (chat.status === 'finalizado') {
    return res.status(400).json({ error: 'Chat já finalizado' });
  }

  const update = {};
  if (papel === 'cliente') update.finalizado_cliente = true;
  if (papel === 'prestador') update.finalizado_prestador = true;

  // Se ambos já confirmaram após esse update, marcar como finalizado
  const ambosConfirmaram =
    (papel === 'cliente' && chat.finalizado_prestador) ||
    (papel === 'prestador' && chat.finalizado_cliente);

  if (ambosConfirmaram) {
    update.status = 'finalizado';
    update.finalizado_em = new Date().toISOString();
  }

  const { data: chatAtualizado, error } = await supabase
    .from('chat_negociacao')
    .update(update)
    .eq('link_token', token)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ chat: chatAtualizado, ambosConfirmaram });
});

// ── UPLOAD DE ARQUIVO (retorna URL do Supabase Storage) ───────
router.post('/:token/upload', async (req, res) => {
  const { token } = req.params;
  const { base64, mimeType, nomeArquivo } = req.body;

  const { data: chat } = await supabase
    .from('chat_negociacao')
    .select('id')
    .eq('link_token', token)
    .single();

  if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });

  const buffer = Buffer.from(base64, 'base64');
  const ext = mimeType === 'audio/webm' ? 'webm' : mimeType === 'audio/ogg' ? 'ogg' : 'jpg';
  const filename = `chat/${chat.id}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('chat-arquivos')
    .upload(filename, buffer, { contentType: mimeType, upsert: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: urlData } = supabase.storage
    .from('chat-arquivos')
    .getPublicUrl(filename);

  res.json({ url: urlData.publicUrl });
});

// ── CRIAR CONTRATO A PARTIR DO CHAT ──────────────────────────
router.post('/:token/contrato', async (req, res) => {
  const { token } = req.params;
  const { valor, prazo, garantia, pagamento, tipo } = req.body;

  if (!valor || !tipo) {
    return res.status(400).json({ error: 'valor e tipo são obrigatórios' });
  }

  const { data: chat } = await supabase
    .from('chat_negociacao')
    .select('id, orc_id, status')
    .eq('link_token', token)
    .single();

  if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });
  if (chat.status !== 'finalizado') {
    return res.status(400).json({ error: 'Ambas as partes precisam confirmar finalização antes de gerar o contrato' });
  }

  // Buscar dados completos do ORC
  const { data: orc } = await supabase
    .from('orcs')
    .select('*, prestadores(nome, cpf, telefone)')
    .eq('id', chat.orc_id)
    .single();

  if (!orc) return res.status(404).json({ error: 'ORC não encontrado' });

  // Verificar se já existe contrato para esse ORC
  const { data: contratoExistente } = await supabase
    .from('contratos')
    .select('id')
    .eq('orc_id', orc.id)
    .maybeSingle();

  if (contratoExistente) {
    return res.json({ ok: true, contrato_id: contratoExistente.id, existente: true });
  }

  const crypto = require('crypto');
  const hashDocumento = crypto.createHash('sha256')
    .update(JSON.stringify({ orc_id: orc.id, valor, tipo, timestamp: new Date().toISOString() }))
    .digest('hex');

  const { data: contrato, error } = await supabase
    .from('contratos')
    .insert({
      orc_id: orc.id,
      tipo: tipo || 'carta_aceite',
      valor: parseFloat(valor),
      prazo: prazo || 'A combinar',
      pagamento: pagamento || 'A combinar',
      garantia: garantia || '90 dias',
      hash_documento: hashDocumento,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('orcs').update({ status: 'CONTRATO GERADO' }).eq('id', orc.id);

  await supabase.from('custodia_log').insert({
    orc_id: orc.id,
    acao: 'CONTRATO_GERADO',
    agente: 'chat',
    dados: { tipo, valor, hash: hashDocumento, chat_token: token }
  });

  res.json({ ok: true, contrato_id: contrato.id });
});

// ── ASSINAR CONTRATO VIA CHAT ─────────────────────────────────
router.post('/:token/contrato/assinar', async (req, res) => {
  const { token } = req.params;
  const { papel, ip } = req.body; // papel: 'cliente' | 'prestador'

  if (!['cliente', 'prestador'].includes(papel)) {
    return res.status(400).json({ error: 'papel deve ser cliente ou prestador' });
  }

  const { data: chat } = await supabase
    .from('chat_negociacao')
    .select('orc_id')
    .eq('link_token', token)
    .single();

  if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });

  const { data: contrato } = await supabase
    .from('contratos')
    .select('*')
    .eq('orc_id', chat.orc_id)
    .single();

  if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado. Gere o contrato primeiro.' });

  const timestamp = new Date().toISOString();
  const update = papel === 'cliente'
    ? { assinado_cliente: true, assinado_cliente_em: timestamp, ip_cliente: ip || 'desconhecido' }
    : { assinado_prestador: true, assinado_prestador_em: timestamp, ip_prestador: ip || 'desconhecido' };

  const { data: contratoAtualizado, error } = await supabase
    .from('contratos')
    .update(update)
    .eq('id', contrato.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('custodia_log').insert({
    orc_id: chat.orc_id,
    acao: `ASSINATURA_${papel.toUpperCase()}`,
    agente: papel,
    ip: ip || 'desconhecido',
    dados: { timestamp, hash: contrato.hash_documento }
  });

  if (contratoAtualizado.assinado_cliente && contratoAtualizado.assinado_prestador) {
    await supabase.from('orcs').update({ status: 'CONTRATO ASSINADO' }).eq('id', chat.orc_id);
  }

  res.json({
    ok: true,
    contrato: contratoAtualizado,
    ambosAssinaram: contratoAtualizado.assinado_cliente && contratoAtualizado.assinado_prestador
  });
});

// ── LISTAR CHATS — ADMIN ─────────────────────────────────────
router.get('/admin/all', async (req, res) => {
  const { data, error } = await supabase
    .from('chat_negociacao')
    .select(`
      id, link_token, status, criado_em, finalizado_em,
      orcs ( id, codigo, nome_cliente, servico_nome, servicos ( titulo ), prestadores ( nome ) )
    `)
    .order('criado_em', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── LISTAR CHATS — PRESTADOR ──────────────────────────────────
router.get('/prestador/:prestadorId', async (req, res) => {
  const { prestadorId } = req.params;
  const { data: orcsData } = await supabase
    .from('orcs')
    .select('id')
    .eq('prestador_id', prestadorId);
  const orcIds = (orcsData || []).map(o => o.id);
  if (!orcIds.length) return res.json([]);
  const { data, error } = await supabase
    .from('chat_negociacao')
    .select(`
      id, link_token, status, criado_em,
      orcs ( id, codigo, nome_cliente, servico_nome, servicos ( titulo ) )
    `)
    .in('orc_id', orcIds)
    .order('criado_em', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── CRIAR CHAT (usado internamente pelo whatsapp.js) ──────────
async function criarChatParaOrc(orcId) {
  const token = crypto.randomBytes(16).toString('hex');

  const { data, error } = await supabase
    .from('chat_negociacao')
    .insert({ orc_id: orcId, link_token: token })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

module.exports = router;
module.exports.criarChatParaOrc = criarChatParaOrc;
