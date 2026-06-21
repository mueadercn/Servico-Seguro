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
