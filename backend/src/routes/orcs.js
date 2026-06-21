const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { enviarMensagem, templates } = require('../services/whatsapp');
const { conduzirAnamnese, gerarResumo } = require('../services/ia');

// ── CRIAR ORC ─────────────────────────────────────────────────
// POST /api/orcs
router.post('/', async (req, res) => {
  try {
    const {
      servico_id, nome_cliente, telefone_cliente,
      canal = 'site', cat_nome, servico_nome
    } = req.body;

    const codigo = gerarCodigo();

    const { data, error } = await supabase
      .from('orcs')
      .insert({
        codigo,
        servico_id: servico_id || null,
        nome_cliente,
        telefone_cliente,
        canal,
        status: 'NOVO'
      })
      .select()
      .single();

    if (error) throw error;

    // Notificar admin via WhatsApp se configurado
    const adminNum = process.env.ADMIN_WHATSAPP;
    if (adminNum && telefone_cliente) {
      await enviarMensagem(adminNum,
        `🆕 Novo ORC: ${codigo}\nCliente: ${nome_cliente}\nServiço: ${servico_nome || 'N/A'}\nCanal: ${canal}`
      );
    }

    res.json({ ok: true, orc: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── LISTAR ORCs ───────────────────────────────────────────────
// GET /api/orcs
router.get('/', async (req, res) => {
  try {
    const { status, prestador_id, usuario_id, limit = 50 } = req.query;

    let query = supabase
      .from('orcs')
      .select('*, prestadores(nome, telefone), usuarios(nome, telefone)')
      .order('criado_em', { ascending: false })
      .limit(Number(limit));

    if (status) query = query.eq('status', status);
    if (prestador_id) query = query.eq('prestador_id', prestador_id);
    if (usuario_id) query = query.eq('usuario_id', usuario_id);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ ok: true, orcs: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── BUSCAR ORC POR ID ─────────────────────────────────────────
// GET /api/orcs/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orcs')
      .select('*, prestadores(*), usuarios(*), mensagens(*), contratos(*)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ ok: true, orc: data });
  } catch (err) {
    res.status(404).json({ ok: false, error: 'ORC não encontrado' });
  }
});

// ── ATUALIZAR STATUS ──────────────────────────────────────────
// PATCH /api/orcs/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, ...extras } = req.body;
    const statusValidos = [
      'NOVO', 'EM ANAMNESE', 'ANAMNESE CONCLUÍDA', 'PRESTADOR NOTIFICADO',
      'AGUARDANDO PRESTADOR', 'VISITA AGENDADA', 'ORÇAMENTO ONLINE',
      'VISITA REALIZADA', 'AGUARDANDO DECISÃO', 'FECHADO',
      'CONTRATO GERADO', 'AGUARDANDO ASSINATURA', 'CONTRATO ASSINADO',
      'SERVIÇO CONCLUÍDO', 'AVALIAÇÃO PENDENTE', 'ENCERRADO',
      'DIVERGÊNCIA DE VALOR', 'SEM RESPOSTA CLIENTE',
      'SEM RESPOSTA PRESTADOR', 'NÃO FECHOU', 'CANCELADO'
    ];

    if (!statusValidos.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Status inválido' });
    }

    const { data, error } = await supabase
      .from('orcs')
      .update({ status, atualizado_em: new Date().toISOString(), ...extras })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Log custódia
    await supabase.from('custodia_log').insert({
      orc_id: req.params.id,
      acao: `STATUS_${status.replace(/ /g, '_')}`,
      agente: 'sistema',
      dados: { status_anterior: data.status, status_novo: status }
    });

    res.json({ ok: true, orc: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── VINCULAR PRESTADOR ────────────────────────────────────────
// POST /api/orcs/:id/prestador
router.post('/:id/prestador', async (req, res) => {
  try {
    const { prestador_id } = req.body;

    // Buscar dados do prestador e do ORC
    const [orcRes, prestRes] = await Promise.all([
      supabase.from('orcs').select('*, usuarios(nome,telefone)').eq('id', req.params.id).single(),
      supabase.from('prestadores').select('*').eq('id', prestador_id).single()
    ]);

    if (orcRes.error || prestRes.error) throw new Error('ORC ou prestador não encontrado');

    const orc = orcRes.data;
    const prest = prestRes.data;

    // Atualizar ORC
    await supabase.from('orcs').update({
      prestador_id,
      status: 'PRESTADOR NOTIFICADO'
    }).eq('id', req.params.id);

    // Enviar lead ao prestador via WhatsApp
    const msgPrestador = templates.novoLead(
      prest.nome,
      orc.codigo,
      orc.resumo_anamnese || 'Detalhes a confirmar',
      orc.disponibilidade_cliente || 'A combinar'
    );

    const resultadoEnvio = await enviarMensagem(prest.telefone, msgPrestador);

    // Verificar se envio funcionou
    if (!resultadoEnvio.ok) {
      console.error(`[ORC] FALHA ao enviar WhatsApp para prestador ${prest.nome} (${prest.telefone}): ${resultadoEnvio.error}`);

      // Registrar falha no log de custódia
      await supabase.from('custodia_log').insert({
        orc_id: req.params.id,
        acao: 'FALHA_WHATSAPP_PRESTADOR',
        agente: 'sistema',
        dados: {
          prestador_id: prestador_id,
          prestador_nome: prest.nome,
          telefone: prest.telefone,
          erro: resultadoEnvio.error,
          timestamp: new Date().toISOString()
        }
      });

      // Avisar admin via WhatsApp sobre a falha
      const adminNum = process.env.ADMIN_WHATSAPP;
      if (adminNum) {
        await enviarMensagem(adminNum,
          `⚠️ *ATENÇÃO — Falha no envio WhatsApp*\n\n` +
          `ORC: ${orc.codigo}\n` +
          `Prestador: ${prest.nome}\n` +
          `Telefone: ${prest.telefone}\n` +
          `Erro: ${resultadoEnvio.error}\n\n` +
          `Por favor, contate o prestador manualmente.`
        );
      }

      return res.json({
        ok: true,
        message: 'Prestador vinculado mas houve falha no WhatsApp',
        whatsapp_error: resultadoEnvio.error,
        prestador_telefone: prest.telefone
      });
    }

    // Notificar contratante
    if (orc.telefone_cliente) {
      await enviarMensagem(orc.telefone_cliente,
        `${orc.nome_cliente}, encontramos um profissional para o seu serviço! ` +
        `Ele foi notificado e entrará em contato em breve para confirmar o horário. 😊`
      );
    }

    res.json({ ok: true, message: 'Prestador vinculado e notificado com sucesso' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── ANAMNESE VIA IA ───────────────────────────────────────────
// POST /api/orcs/:id/anamnese
router.post('/:id/anamnese', async (req, res) => {
  try {
    const { mensagem, historico = [], cat_nome, servico_nome } = req.body;

    // Adicionar mensagem do usuário ao histórico
    const novoHistorico = [...historico, { role: 'user', content: mensagem }];

    // Salvar mensagem no banco
    await supabase.from('mensagens').insert({
      orc_id: req.params.id,
      remetente: 'cliente',
      conteudo: mensagem
    });

    // Chamar IA
    const resultado = await conduzirAnamnese(novoHistorico, cat_nome, servico_nome);

    if (!resultado.ok) {
      return res.status(500).json({ ok: false, error: resultado.error });
    }

    if (resultado.concluida) {
      // Gerar resumo
      const { resumo } = await gerarResumo(novoHistorico, servico_nome);

      // Atualizar ORC
      await supabase.from('orcs').update({
        status: 'ANAMNESE CONCLUÍDA',
        resumo_anamnese: resumo
      }).eq('id', req.params.id);

      return res.json({
        ok: true,
        concluida: true,
        resumo,
        historico: novoHistorico
      });
    }

    // Salvar resposta da IA
    await supabase.from('mensagens').insert({
      orc_id: req.params.id,
      remetente: 'ia',
      conteudo: resultado.resposta
    });

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

// ── CONFIRMAR FECHAMENTO ──────────────────────────────────────
// POST /api/orcs/:id/fechar
router.post('/:id/fechar', async (req, res) => {
  try {
    const { valor_cliente, valor_prestador } = req.body;

    const divergencia = Math.abs(valor_cliente - valor_prestador) > 0.01;
    const status = divergencia ? 'DIVERGÊNCIA DE VALOR' : 'FECHADO';
    const valor_final = divergencia ? null : valor_cliente;

    // Calcular comissão
    let comissao_valor = 0;
    let comissao_percentual = 0;

    if (!divergencia) {
      const { data: tabela } = await supabase
        .from('comissoes').select('*').eq('ativo', true).order('ordem');

      if (tabela) {
        const faixa = tabela.find(c =>
          valor_final >= c.valor_min &&
          (c.valor_max === null || valor_final <= c.valor_max)
        );
        if (faixa) {
          comissao_percentual = faixa.valor;
          comissao_valor = faixa.tipo === 'fixo'
            ? faixa.valor
            : (valor_final * faixa.valor) / 100;
        }
      }
    }

    await supabase.from('orcs').update({
      status,
      valor_cliente,
      valor_prestador,
      valor_final,
      comissao_valor,
      comissao_percentual
    }).eq('id', req.params.id);

    res.json({ ok: true, status, divergencia, valor_final, comissao_valor });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── HELPER ────────────────────────────────────────────────────
function gerarCodigo() {
  const ano = new Date().getFullYear();
  const seq = String(Date.now()).slice(-5);
  return `ORC-${ano}-${seq}`;
}

module.exports = router;
