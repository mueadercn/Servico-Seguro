const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { enviarMensagem } = require('../services/whatsapp');

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

// ── COMISSÕES PENDENTES (contratos) ───────────────────────────
// GET /api/admin/comissoes-contratos
router.get('/comissoes-contratos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contratos')
      .select('id, comissao, status_comissao, comissao_paga_em, assinado_em, criado_em, orcs(codigo, nome_cliente, prestadores(nome, telefone))')
      .in('status_comissao', ['pendente', 'pago'])
      .eq('assinado_cliente', true)
      .eq('assinado_prestador', true)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, comissoes: data || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/admin/comissoes-contratos/:id — marcar como pago ou isento
router.patch('/comissoes-contratos/:id', async (req, res) => {
  try {
    const { status_comissao } = req.body;
    if (!['pago', 'pendente', 'isento'].includes(status_comissao)) {
      return res.status(400).json({ ok: false, error: 'Status inválido' });
    }
    const update = { status_comissao };
    if (status_comissao === 'pago') update.comissao_paga_em = new Date().toISOString();
    const { data, error } = await supabase.from('contratos').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ ok: true, contrato: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/comissoes-contratos/:id/disparar — disparo manual de WhatsApp
router.post('/comissoes-contratos/:id/disparar', async (req, res) => {
  try {
    const { data: contrato, error } = await supabase
      .from('contratos')
      .select('id, comissao, status_comissao, orcs(codigo, prestadores(nome, telefone))')
      .eq('id', req.params.id)
      .single();
    if (error || !contrato) return res.status(404).json({ ok: false, error: 'Contrato não encontrado' });

    const prestador = contrato.orcs?.prestadores;
    if (!prestador?.telefone) return res.status(400).json({ ok: false, error: 'Prestador sem telefone cadastrado' });

    const { data: cfgTemplate } = await supabase
      .from('configuracoes').select('valor').eq('chave', 'comissao_mensagem_template').maybeSingle();
    const templateComissao = cfgTemplate?.valor || null;
    const comissaoValor = contrato.comissao ? `R$ ${Number(contrato.comissao).toFixed(2)}` : 'o valor combinado';

    const msg = templateComissao
      ? templateComissao
          .replace('{NOME}', prestador.nome || 'Prestador')
          .replace('{VALOR}', comissaoValor)
          .replace('{ORC}', contrato.orcs?.codigo || '')
      : `💰 *Comissão Serviço Seguro*\n\n` +
        `Olá, ${prestador.nome}! Lembrando que o contrato *${contrato.orcs?.codigo}* aguarda o pagamento da comissão.\n\n` +
        `O valor é de ${comissaoValor}.\n\n` +
        `Por favor, realize o pagamento via PIX para manter sua parceria conosco.`;

    await enviarMensagem(prestador.telefone, msg);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── SUPORTE ───────────────────────────────────────────────────
// POST /api/admin/suporte — público, recebe mensagem de contato
router.post('/suporte', async (req, res) => {
  try {
    const { nome, email, telefone, assunto, mensagem } = req.body;
    if (!mensagem) return res.status(400).json({ ok: false, error: 'Mensagem obrigatória' });
    const { error } = await supabase.from('suporte_mensagens').insert({ nome, email, telefone, assunto, mensagem });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/suporte
router.get('/suporte', async (req, res) => {
  try {
    const { data, error } = await supabase.from('suporte_mensagens').select('*').order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, mensagens: data || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/admin/suporte/:id
router.patch('/suporte/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase.from('suporte_mensagens').update({ status }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ ok: true, mensagem: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/admin/orcs/:id — remove ORC e todos os dados relacionados
router.delete('/orcs/:id', async (req, res) => {
  try {
    const orcId = req.params.id;

    // Buscar chat_negociacao para pegar o id
    const { data: chats } = await supabase.from('chat_negociacao').select('id').eq('orc_id', orcId);
    const chatIds = (chats || []).map(c => c.id);

    // Deletar em cascata
    if (chatIds.length) {
      await supabase.from('chat_mensagens').delete().in('chat_id', chatIds);
    }
    await supabase.from('chat_negociacao').delete().eq('orc_id', orcId);
    await supabase.from('contratos').delete().eq('orc_id', orcId);
    await supabase.from('avaliacoes').delete().eq('orc_id', orcId);
    await supabase.from('custodia_log').delete().eq('orc_id', orcId);
    await supabase.from('mensagens').delete().eq('orc_id', orcId);
    await supabase.from('sessoes_whatsapp').delete().eq('servico_id', orcId);
    await supabase.from('orcs').delete().eq('id', orcId);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/avaliacoes/publica — avaliação pós-contrato (cliente ou prestador)
router.post('/avaliacoes/publica', async (req, res) => {
  try {
    const { orc_id, avaliado_id, avaliado_tipo, nota, comentario, avaliador_tipo, avaliador_nome } = req.body;
    if (!orc_id || !avaliado_tipo || !nota) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios: orc_id, avaliado_tipo, nota' });
    }

    // Para avaliação de usuário, se não veio avaliado_id, busca no ORC
    let avaliado_id_final = avaliado_id || null;
    if (!avaliado_id_final && avaliado_tipo === 'usuario') {
      const { data: orc } = await supabase.from('orcs').select('usuario_id, telefone_cliente').eq('id', orc_id).single();
      avaliado_id_final = orc?.usuario_id || null;
      // Fallback por telefone
      if (!avaliado_id_final && orc?.telefone_cliente) {
        const sufixo = orc.telefone_cliente.replace(/\D/g, '').slice(-8);
        if (sufixo) {
          const { data: us } = await supabase.from('usuarios').select('id').ilike('telefone', `%${sufixo}`).limit(1);
          avaliado_id_final = us?.[0]?.id || null;
        }
      }
    }

    // Checar se já existe avaliação desse tipo para esse ORC
    const { data: existe } = await supabase.from('avaliacoes')
      .select('id').eq('orc_id', orc_id).eq('avaliado_tipo', avaliado_tipo).maybeSingle();
    if (existe) return res.status(409).json({ ok: false, error: 'Avaliação já registrada para este contrato' });

    // avaliador: nome do avaliador (para exibição) — fallback para tipo ('cliente'/'prestador')
    const avaliador = avaliador_nome || avaliador_tipo || (avaliado_tipo === 'prestador' ? 'cliente' : 'prestador');
    const { data, error } = await supabase.from('avaliacoes')
      .insert({ orc_id, avaliado_id: avaliado_id_final, avaliado_tipo, nota, comentario, avaliador })
      .select().single();
    if (error) throw error;

    // Atualizar nota média do prestador se for avaliação de prestador
    if (avaliado_tipo === 'prestador') {
      const { data: avs } = await supabase.from('avaliacoes')
        .select('nota').eq('avaliado_id', avaliado_id).eq('avaliado_tipo', 'prestador');
      if (avs && avs.length) {
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

// ── FOLLOW UP — listar e controlar mensagens ativas ──────────
const FOLLOWUP_META = [
  { chave: 'followup_novo_lead_ativo', label: 'Notificação de novo lead ao prestador', descricao: 'Mensagem enviada ao prestador quando um cliente inicia a anamnese e ela é concluída.', destinatario: 'Prestador', default: 'true' },
  { chave: 'followup_pos_visita_ativo', label: 'Follow-up pós-visita', descricao: 'Mensagem enviada automaticamente 1 dia após uma visita agendada, para confirmar como foi.', destinatario: 'Cliente + Prestador', default: 'true' },
  { chave: 'followup_chat_sem_resposta_ativo', label: 'Lembrete de chat sem resposta', descricao: 'Lembrete enviado quando o chat de negociação fica sem resposta por várias horas.', destinatario: 'Cliente ou Prestador', default: 'true' },
  { chave: 'followup_contrato_pendente_ativo', label: 'Lembrete de contrato pendente', descricao: 'Alerta de assinatura pendente e aviso ao admin quando contrato não é gerado após negociação.', destinatario: 'Admin + partes', default: 'true' },
  { chave: 'followup_contrato_assinado_ativo', label: 'Confirmação de contrato assinado', descricao: 'Mensagem enviada às duas partes quando o contrato é assinado por ambas.', destinatario: 'Cliente + Prestador', default: 'false' },
  { chave: 'followup_comissao_ativo', label: 'Cobrança de comissão', descricao: 'Lembretes de pagamento de comissão enviados ao prestador nos dias T+0, T+2, T+3 e T+7 após assinatura.', destinatario: 'Prestador', default: 'false' },
];

router.get('/followup', async (req, res) => {
  try {
    const { data: cfgs } = await supabase.from('configuracoes')
      .select('chave, valor')
      .in('chave', FOLLOWUP_META.map(m => m.chave));

    const valorMap = Object.fromEntries((cfgs || []).map(c => [c.chave, c.valor]));

    const resultado = FOLLOWUP_META.map(m => ({
      ...m,
      valor: valorMap[m.chave] ?? m.default,
    }));

    res.json({ ok: true, items: resultado });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/followup', async (req, res) => {
  try {
    const { chave, valor } = req.body;
    if (!chave || valor === undefined) return res.status(400).json({ ok: false, error: 'chave e valor obrigatórios' });

    const { error } = await supabase.from('configuracoes')
      .upsert({ chave, valor: String(valor) }, { onConflict: 'chave' });
    if (error) throw error;

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
