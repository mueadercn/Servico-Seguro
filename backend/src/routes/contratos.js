const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { gerarPDF, gerarHash } = require('../services/pdf');
const { enviarMensagem, templates } = require('../services/whatsapp');

// ── GERAR CONTRATO ────────────────────────────────────────────
// POST /api/contratos
router.post('/', async (req, res) => {
  try {
    const {
      orc_id, tipo, valor, comissao,
      cont_nome, cont_cpf, prest_nome, prest_cpf,
      servico_desc, prazo, pagamento, garantia
    } = req.body;

    const dataGeracao = new Date().toLocaleString('pt-BR');
    const codigo = orc_id ? `ORC-${orc_id.slice(-8).toUpperCase()}` : `CTR-${Date.now()}`;

    const dadosContrato = {
      tipo, codigo, contNome: cont_nome, contCpf: cont_cpf,
      prestNome: prest_nome, prestCpf: prest_cpf,
      servico: servico_desc, valor, comissaoValor: comissao,
      comissaoPct: calcularPct(valor, comissao),
      prazo: prazo || 'A combinar',
      pagamento: pagamento || 'A combinar',
      garantia: garantia || '90 dias',
      dataGeracao,
      assinadoCliente: false, assinadoPrestador: false
    };

    const hashDocumento = gerarHash(dadosContrato);
    dadosContrato.hashDocumento = hashDocumento;

    // Salvar no banco
    const { data, error } = await supabase.from('contratos').insert({
      orc_id: orc_id || null,
      tipo,
      valor,
      comissao,
      hash_documento: hashDocumento,
    }).select().single();

    if (error) throw error;

    // Atualizar status do ORC
    if (orc_id) {
      await supabase.from('orcs').update({
        status: 'CONTRATO GERADO'
      }).eq('id', orc_id);
    }

    // Log custódia
    await supabase.from('custodia_log').insert({
      orc_id,
      acao: 'CONTRATO_GERADO',
      agente: 'sistema',
      dados: { tipo, valor, hash: hashDocumento, codigo }
    });

    res.json({
      ok: true,
      contrato: data,
      hash: hashDocumento,
      dados: dadosContrato
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── ASSINAR CONTRATO ──────────────────────────────────────────
// POST /api/contratos/:id/assinar
router.post('/:id/assinar', async (req, res) => {
  try {
    const { parte, ip, cpf_verificado, biometria_verificada, user_agent, geolocalizacao, telefone } = req.body;
    // parte: 'cliente' | 'prestador'

    const timestamp = new Date().toISOString();
    const update = parte === 'cliente'
      ? { assinado_cliente: true, assinado_cliente_em: timestamp, ip_cliente: ip,
          ua_cliente: user_agent || null, geo_cliente: geolocalizacao || null, tel_cliente: telefone || null }
      : { assinado_prestador: true, assinado_prestador_em: timestamp, ip_prestador: ip,
          ua_prestador: user_agent || null, geo_prestador: geolocalizacao || null, tel_prestador: telefone || null };

    if (parte === 'cliente' && cpf_verificado !== undefined) {
      update.cpf_verificado = cpf_verificado;
    }
    if (biometria_verificada !== undefined) {
      update.biometria_verificada = biometria_verificada;
    }

    const { data, error } = await supabase
      .from('contratos')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Log custódia
    await supabase.from('custodia_log').insert({
      orc_id: data.orc_id,
      acao: `ASSINATURA_${parte.toUpperCase()}`,
      agente: parte,
      ip,
      dados: { timestamp, cpf_verificado, biometria_verificada, hash: data.hash_documento }
    });

    // Se ambos assinaram, atualizar ORC e iniciar rastreamento de comissão
    if (data.assinado_cliente && data.assinado_prestador) {
      if (data.orc_id) {
        await supabase.from('orcs').update({
          status: 'CONTRATO ASSINADO'
        }).eq('id', data.orc_id);

        await supabase.from('chat_negociacao').update({
          status: 'contrato_assinado'
        }).eq('orc_id', data.orc_id);
      }

      // Marcar assinado_em e status_comissao pendente
      await supabase.from('contratos').update({
        assinado_em: new Date().toISOString(),
        status_comissao: 'pendente'
      }).eq('id', data.id);

      // Enviar confirmação para ambos via WhatsApp
      const { data: orc } = await supabase
        .from('orcs').select('*, prestadores(*)')
        .eq('id', data.orc_id).single();

      if (orc) {
        const { data: cfgContratoAssinado } = await supabase
          .from('configuracoes').select('valor').eq('chave', 'followup_contrato_assinado_ativo').maybeSingle();
        if (cfgContratoAssinado?.valor !== 'false') {
          const msgConcluido = `✅ Contrato assinado por ambas as partes!\n\n` +
            `📋 Código: ${orc.codigo}\n` +
            `🛡️ Tipo: ${data.tipo === 'carta_aceite' ? 'Carta Aceite' : 'Contrato Seguro'}\n\n` +
            `Bom serviço! _Serviço Seguro_ 🛡️`;
          if (orc.telefone_cliente) await enviarMensagem(orc.telefone_cliente, msgConcluido);
          if (orc.prestadores?.telefone) await enviarMensagem(orc.prestadores.telefone, msgConcluido);
        }

        // T+0: lembrete de comissão imediato ao prestador
        try {
          const { data: cfgComissaoAtivo } = await supabase
            .from('configuracoes').select('valor').eq('chave', 'followup_comissao_ativo').maybeSingle();
          if (cfgComissaoAtivo?.valor === 'false') throw new Error('comissão desativada');

          const { data: cfgTemplate } = await supabase
            .from('configuracoes').select('valor').eq('chave', 'comissao_mensagem_template').maybeSingle();
          const templateComissao = cfgTemplate?.valor || null;
          const comissaoValor = data.comissao ? `R$ ${Number(data.comissao).toFixed(2)}` : 'o valor combinado';
          const msgComissao = templateComissao
            ? templateComissao
                .replace('{NOME}', orc.prestadores?.nome || 'Prestador')
                .replace('{VALOR}', comissaoValor)
                .replace('{ORC}', orc.codigo || '')
            : `💰 *Comissão Serviço Seguro*\n\n` +
              `Parabéns, ${orc.prestadores?.nome}! O contrato *${orc.codigo}* foi assinado.\n\n` +
              `A comissão da plataforma é de ${comissaoValor}.\n\n` +
              `Por favor, realize o pagamento via PIX para confirmar sua parceria conosco.`;

          if (orc.prestadores?.telefone) await enviarMensagem(orc.prestadores.telefone, msgComissao);
        } catch (e) {
          console.error('[Contrato] Erro ao enviar msg comissão T+0:', e.message);
        }
      }
    }

    res.json({ ok: true, contrato: data, ambosAssinaram: data.assinado_cliente && data.assinado_prestador });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GERAR PDF ─────────────────────────────────────────────────
// GET /api/contratos/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    // Buscar dados completos
    const { data: contrato, error } = await supabase
      .from('contratos')
      .select('*, orcs(*, prestadores(*), usuarios(*))')
      .eq('id', req.params.id)
      .single();

    if (error || !contrato) {
      return res.status(404).json({ ok: false, error: 'Contrato não encontrado' });
    }

    const orc = contrato.orcs;

    const dadosPDF = {
      tipo: contrato.tipo,
      codigo: orc?.codigo || req.params.id,
      contNome: orc?.nome_cliente || 'Contratante',
      contCpf: orc?.usuarios?.cpf || '',
      prestNome: orc?.prestadores?.nome || 'Prestador',
      prestCpf: orc?.prestadores?.cpf || '',
      servico: orc?.resumo_anamnese || 'Serviço contratado',
      valor: contrato.valor,
      comissaoValor: contrato.comissao,
      comissaoPct: calcularPct(contrato.valor, contrato.comissao),
      prazo: 'A combinar',
      pagamento: 'Conforme acordado',
      garantia: '90 dias',
      dataGeracao: new Date(contrato.criado_em).toLocaleString('pt-BR'),
      hashDocumento: contrato.hash_documento,
      assinadoCliente: contrato.assinado_cliente,
      assinadoPrestador: contrato.assinado_prestador,
      ipCliente: contrato.ip_cliente,
      ipPrestador: contrato.ip_prestador,
      timestampCliente: contrato.assinado_cliente_em
        ? new Date(contrato.assinado_cliente_em).toLocaleString('pt-BR') : null,
      timestampPrestador: contrato.assinado_prestador_em
        ? new Date(contrato.assinado_prestador_em).toLocaleString('pt-BR') : null,
      // Evidências digitais — geolocalização, user-agent e telefone das partes
      uaCliente: contrato.ua_cliente || null,
      uaPrestador: contrato.ua_prestador || null,
      geoCliente: contrato.geo_cliente || null,
      geoPrestador: contrato.geo_prestador || null,
      telCliente: contrato.tel_cliente || null,
      telPrestador: contrato.tel_prestador || null,
    };

    // Buscar mensagens do CHAT de negociação (o que realmente importa)
    let mensagensChat = [];
    if (orc?.id) {
      const { data: chat } = await supabase
        .from('chat_negociacao')
        .select('id')
        .eq('orc_id', orc.id)
        .maybeSingle();
      if (chat?.id) {
        const { data: msgs } = await supabase
          .from('chat_mensagens')
          .select('remetente, tipo, conteudo, criado_em')
          .eq('chat_id', chat.id)
          .order('criado_em', { ascending: true });
        mensagensChat = msgs || [];
      }
    }

    dadosPDF.mensagensChat = mensagensChat;

    const pdfBuffer = await gerarPDF(dadosPDF);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contrato-${dadosPDF.codigo}.pdf"`);
    res.send(pdfBuffer);

    // Log
    await supabase.from('custodia_log').insert({
      orc_id: orc?.id,
      acao: 'PDF_BAIXADO',
      agente: 'usuario',
      ip: req.ip,
      dados: { contrato_id: req.params.id }
    });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── BUSCAR CONTRATO POR ORC ───────────────────────────────────
// GET /api/contratos/orc/:orcId
router.get('/orc/:orcId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contratos')
      .select('*, orcs(codigo, nome_cliente, resumo_anamnese, telefone_cliente)')
      .eq('orc_id', req.params.orcId)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: 'Contrato não encontrado para este ORC' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── RETIFICAR CONTRATO ────────────────────────────────────────
// PUT /api/contratos/:id/retificar
router.put('/:id/retificar', async (req, res) => {
  try {
    const { valor, comissao, prazo, pagamento, garantia, servico_desc, retificado_por } = req.body;
    const update = {
      valor, comissao, prazo, pagamento, garantia,
      // Limpar assinaturas anteriores — ambos precisam assinar novamente
      assinado_cliente: false, assinado_cliente_em: null, ip_cliente: null,
      assinado_prestador: false, assinado_prestador_em: null, ip_prestador: null,
      assinado_em: null, status_comissao: null,
    };
    const { data, error } = await supabase.from('contratos').update(update).eq('id', req.params.id).select('*, orcs(codigo, nome_cliente, resumo_anamnese, telefone_cliente)').single();
    if (error) throw error;

    // Voltar status do ORC e chat para contrato_gerado
    if (data.orc_id) {
      await supabase.from('orcs').update({ status: 'CONTRATO GERADO' }).eq('id', data.orc_id);
      await supabase.from('chat_negociacao').update({ status: 'contrato_gerado' }).eq('orc_id', data.orc_id);
    }

    await supabase.from('custodia_log').insert({
      orc_id: data.orc_id,
      acao: 'CONTRATO_RETIFICADO',
      agente: retificado_por || 'usuario',
      dados: { contrato_id: req.params.id, valor, prazo, pagamento, garantia }
    });

    res.json({ ok: true, contrato: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── BUSCAR CONTRATO ───────────────────────────────────────────
// GET /api/contratos/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contratos')
      .select('*, orcs(codigo, nome_cliente, resumo_anamnese)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ ok: true, contrato: data });
  } catch (err) {
    res.status(404).json({ ok: false, error: 'Contrato não encontrado' });
  }
});

function calcularPct(valor, comissao) {
  if (!valor || !comissao) return '';
  const pct = (comissao / valor * 100).toFixed(1);
  return `${pct}% sobre o valor do serviço`;
}

// ── CONTRATOS POR PRESTADOR ───────────────────────────────────
// GET /api/contratos/prestador/:prestadorId
router.get('/prestador/:prestadorId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contratos')
      .select('id, orc_id, valor, comissao, status_comissao, comissao_paga_em, assinado_cliente, assinado_prestador, assinado_em, criado_em, tipo, orcs(codigo, nome_cliente, prestador_id, status)')
      .eq('orcs.prestador_id', req.params.prestadorId)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    // Filtrar apenas os que pertencem a esse prestador (JOIN Supabase não filtra automaticamente inline)
    const meus = (data || []).filter(c => c.orcs?.prestador_id === req.params.prestadorId);
    res.json(meus);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
