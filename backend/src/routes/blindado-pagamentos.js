const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const stripe = require('../services/stripe');

// Preços SEMPRE definidos no servidor — nunca confiar no frontend.
const PACOTES = [
  { id: 'p1',  qtd: 1,  valor_centavos: 990,   label: '1 contrato' },
  { id: 'p3',  qtd: 3,  valor_centavos: 2670,  label: '3 contratos (R$ 8,90/un)' },
  { id: 'p5',  qtd: 5,  valor_centavos: 3950,  label: '5 contratos (R$ 7,90/un)' },
  { id: 'p10', qtd: 10, valor_centavos: 6900,  label: '10 contratos (R$ 6,90/un)' },
  { id: 'p20', qtd: 20, valor_centavos: 11800, label: '20 contratos (R$ 5,90/un)' },
  { id: 'p50', qtd: 50, valor_centavos: 24500, label: '50 contratos (R$ 4,90/un)' },
];

// ── CREDITAR PAGAMENTO (idempotente — usado por webhook e polling) ──
async function creditarPagamento(paymentIntentId) {
  const { data: pagamento } = await supabase
    .from('blindado_pagamentos')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (!pagamento) {
    console.error('[Blindado Pagamentos] PaymentIntent desconhecido:', paymentIntentId);
    return { ok: false };
  }
  if (pagamento.status === 'pago') return { ok: true, jaCreditado: true };

  const { error: errUpd } = await supabase
    .from('blindado_pagamentos')
    .update({ status: 'pago', pago_em: new Date().toISOString() })
    .eq('id', pagamento.id)
    .eq('status', 'pendente'); // garante que só credita uma vez

  if (errUpd) {
    console.error('[Blindado Pagamentos] Erro ao marcar pago:', errUpd.message);
    return { ok: false };
  }

  const { error: errRpc } = await supabase.rpc('blindado_creditar', {
    p_user_tipo: pagamento.user_tipo,
    p_user_id: pagamento.user_id,
    p_qtd: pagamento.quantidade,
    p_pagamento_id: pagamento.id,
  });

  if (errRpc) {
    console.error('[Blindado Pagamentos] Erro ao creditar:', errRpc.message);
    return { ok: false };
  }

  console.log(`[Blindado Pagamentos] ✅ ${pagamento.quantidade} crédito(s) para ${pagamento.user_tipo}/${pagamento.user_id}`);
  return { ok: true };
}

// ── LISTAR PACOTES ────────────────────────────────────────────
router.get('/pacotes', (req, res) => {
  res.json({ tarifa_unitaria_centavos: 990, pacotes: PACOTES });
});

// ── CHECKOUT PIX ──────────────────────────────────────────────
router.post('/checkout', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Pagamentos não configurados' });

    const { user_tipo, user_id, pacote_id } = req.body;
    if (!['prestador', 'contratante'].includes(user_tipo) || !user_id) {
      return res.status(400).json({ error: 'user_tipo e user_id são obrigatórios' });
    }

    const pacote = PACOTES.find(p => p.id === pacote_id);
    if (!pacote) return res.status(400).json({ error: 'Pacote inválido' });

    // PIX exige billing_details.name — busca nome/email do usuário no banco
    const tabela = user_tipo === 'prestador' ? 'prestadores' : 'usuarios';
    const { data: pessoa } = await supabase
      .from(tabela)
      .select('nome, email')
      .eq('id', user_id)
      .maybeSingle();

    const billing = { name: (pessoa && pessoa.nome) || 'Cliente Serviço Seguro' };
    if (pessoa && pessoa.email) billing.email = pessoa.email;

    const pi = await stripe.paymentIntents.create({
      amount: pacote.valor_centavos,
      currency: 'brl',
      payment_method_types: ['pix'],
      payment_method_data: { type: 'pix', billing_details: billing },
      confirm: true,
      metadata: {
        produto: 'contrato_blindado',
        user_tipo,
        user_id,
        pacote_id,
        quantidade: String(pacote.qtd),
      },
    });

    const { error } = await supabase.from('blindado_pagamentos').insert({
      user_tipo,
      user_id,
      stripe_payment_intent_id: pi.id,
      pacote_id,
      quantidade: pacote.qtd,
      valor_centavos: pacote.valor_centavos,
    });

    if (error) return res.status(500).json({ error: error.message });

    const pix = pi.next_action && pi.next_action.pix_display_qr_code;
    res.json({
      ok: true,
      payment_intent_id: pi.id,
      qr_png: pix ? pix.image_url_png : null,
      copia_cola: pix ? pix.data : null,
      expires_at: pix ? pix.expires_at : null,
      valor_centavos: pacote.valor_centavos,
    });
  } catch (err) {
    // Erros da Stripe trazem a causa real em err.raw.message (ex.: PIX não ativado na conta)
    const detalhe = (err && err.raw && err.raw.message) || err.message || 'erro desconhecido';
    console.error('[Blindado Pagamentos] Erro no checkout:', detalhe);
    res.status(500).json({ error: `Erro ao gerar cobrança PIX: ${detalhe}` });
  }
});

// ── STATUS (polling do frontend) ──────────────────────────────
router.get('/status/:paymentIntentId', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    const { data: pagamento } = await supabase
      .from('blindado_pagamentos')
      .select('status')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (!pagamento) return res.status(404).json({ error: 'Pagamento não encontrado' });

    // Fallback: webhook pode ter atrasado/falhado — consulta o Stripe direto
    if (pagamento.status === 'pendente' && stripe) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.status === 'succeeded') {
        await creditarPagamento(paymentIntentId);
        return res.json({ status: 'pago' });
      }
      if (['canceled'].includes(pi.status)) {
        await supabase
          .from('blindado_pagamentos')
          .update({ status: 'falhou' })
          .eq('stripe_payment_intent_id', paymentIntentId)
          .eq('status', 'pendente');
        return res.json({ status: 'falhou' });
      }
    }

    res.json({ status: pagamento.status });
  } catch (err) {
    console.error('[Blindado Pagamentos] Erro no status:', err.message);
    res.status(500).json({ error: 'Erro ao consultar pagamento' });
  }
});

// ── SALDO ─────────────────────────────────────────────────────
router.get('/saldo', async (req, res) => {
  const { user_tipo, user_id } = req.query;
  if (!user_tipo || !user_id) return res.status(400).json({ error: 'user_tipo e user_id são obrigatórios' });

  const { data } = await supabase
    .from('blindado_creditos')
    .select('saldo')
    .eq('user_tipo', user_tipo)
    .eq('user_id', user_id)
    .maybeSingle();

  res.json({ saldo: data ? data.saldo : 0 });
});

// ── WEBHOOK STRIPE (montado em index.js com express.raw ANTES do json) ──
async function webhookHandler(req, res) {
  if (!stripe) return res.status(500).json({ error: 'Pagamentos não configurados' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Blindado Pagamentos] Assinatura de webhook inválida:', err.message);
    return res.status(400).json({ error: 'Assinatura inválida' });
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      await creditarPagamento(event.data.object.id);
    } else if (['payment_intent.payment_failed', 'payment_intent.canceled'].includes(event.type)) {
      await supabase
        .from('blindado_pagamentos')
        .update({ status: 'falhou' })
        .eq('stripe_payment_intent_id', event.data.object.id)
        .eq('status', 'pendente');
    }
  } catch (err) {
    console.error('[Blindado Pagamentos] Erro ao processar webhook:', err.message);
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler };
