const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const supabase = require('../services/supabase');
const { enviarMensagem, formatarNumero } = require('../services/whatsapp');
const { criarOtp, verificarOtp } = require('../services/otp');
const { reverseGeocode } = require('../services/geocoding');
const { gerarPDFBlindado, gerarHash } = require('../services/pdf-blindado');

const BUCKET = 'blindado-anexos';
const SIGNED_URL_TTL = 3600; // 1h
// Barras finais removidas para evitar links com "//" (quebra o roteamento do SPA)
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://servico-seguro.netlify.app').replace(/\/+$/, '');

// ── HELPERS ───────────────────────────────────────────────────

function somenteDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

async function buscarContratoPorToken(token) {
  const { data: contrato } = await supabase
    .from('blindado_contratos')
    .select('*')
    .eq('token', token)
    .single();
  return contrato || null;
}

async function buscarPartes(contratoId) {
  const { data: partes } = await supabase
    .from('blindado_partes')
    .select('*')
    .eq('contrato_id', contratoId)
    .order('papel', { ascending: true }); // convidado, criador (alfabético — frontend usa papel)
  return partes || [];
}

async function signedUrl(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return data ? data.signedUrl : null;
}

async function partesComAnexos(partes) {
  return Promise.all(partes.map(async (p) => ({
    ...p,
    selfie_url: await signedUrl(p.selfie_path),
    documento_url: await signedUrl(p.documento_path),
  })));
}

// ── RATE LIMITS ───────────────────────────────────────────────

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `otp:${req.body?.parte_id || req.ip}`,
  message: { error: 'Muitos envios de código. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const acessoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── 1. CRIAR RASCUNHO ─────────────────────────────────────────
router.post('/contratos', async (req, res) => {
  try {
    const {
      criador_tipo, criador_id,
      servico_desc, valor, prazo, pagamento, garantia,
      partes
    } = req.body;

    if (!['prestador', 'contratante'].includes(criador_tipo) || !criador_id) {
      return res.status(400).json({ error: 'criador_tipo e criador_id são obrigatórios' });
    }
    if (!Array.isArray(partes) || partes.length !== 2) {
      return res.status(400).json({ error: 'É necessário informar exatamente 2 partes' });
    }
    const papeis = partes.map(p => p.papel).sort();
    if (papeis[0] !== 'convidado' || papeis[1] !== 'criador') {
      return res.status(400).json({ error: 'As partes devem ser uma "criador" e uma "convidado"' });
    }
    const contratuais = partes.map(p => p.papel_contratual).sort();
    if (contratuais[0] !== 'contratante' || contratuais[1] !== 'prestador') {
      return res.status(400).json({ error: 'As partes devem ser uma "contratante" e uma "prestador"' });
    }

    const codigo = 'BLD-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const token = crypto.randomBytes(24).toString('hex');

    const { data: contrato, error } = await supabase
      .from('blindado_contratos')
      .insert({
        codigo, token, criador_tipo, criador_id,
        servico_desc: servico_desc || null,
        valor: valor ? parseFloat(valor) : null,
        prazo: prazo || null,
        pagamento: pagamento || null,
        garantia: garantia || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const linhasPartes = partes.map(p => ({
      contrato_id: contrato.id,
      papel: p.papel,
      papel_contratual: p.papel_contratual,
      tipo_pessoa: p.tipo_pessoa === 'pj' ? 'pj' : 'pf',
      nome: p.nome || '',
      cpf_cnpj: somenteDigitos(p.cpf_cnpj),
      data_referencia: p.data_referencia || null,
      telefone: p.telefone ? formatarNumero(p.telefone) : null,
    }));

    const { data: partesCriadas, error: errPartes } = await supabase
      .from('blindado_partes')
      .insert(linhasPartes)
      .select();

    if (errPartes) {
      await supabase.from('blindado_contratos').delete().eq('id', contrato.id);
      return res.status(500).json({ error: errPartes.message });
    }

    res.json({ ok: true, contrato, partes: partesCriadas });
  } catch (err) {
    console.error('[Blindado] Erro ao criar contrato:', err.message);
    res.status(500).json({ error: 'Erro ao criar contrato' });
  }
});

// ── 2. LISTAR CONTRATOS DO CRIADOR + SALDO ────────────────────
router.get('/contratos/meus', async (req, res) => {
  const { criador_tipo, criador_id } = req.query;
  if (!criador_tipo || !criador_id) {
    return res.status(400).json({ error: 'criador_tipo e criador_id são obrigatórios' });
  }

  const { data: contratos } = await supabase
    .from('blindado_contratos')
    .select('*, blindado_partes(id, papel, papel_contratual, nome, telefone_validado, assinado, assinado_em)')
    .eq('criador_tipo', criador_tipo)
    .eq('criador_id', criador_id)
    .order('criado_em', { ascending: false });

  const { data: creditos } = await supabase
    .from('blindado_creditos')
    .select('saldo')
    .eq('user_tipo', criador_tipo)
    .eq('user_id', criador_id)
    .maybeSingle();

  res.json({ contratos: contratos || [], saldo: creditos ? creditos.saldo : 0 });
});

// ── 3. EDITAR RASCUNHO ────────────────────────────────────────
router.put('/contratos/:id', async (req, res) => {
  const { id } = req.params;
  const { criador_tipo, criador_id, servico_desc, valor, prazo, pagamento, garantia, partes } = req.body;

  const { data: contrato } = await supabase
    .from('blindado_contratos')
    .select('*')
    .eq('id', id)
    .single();

  if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });
  if (contrato.criador_tipo !== criador_tipo || contrato.criador_id !== criador_id) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  if (contrato.status !== 'rascunho') {
    return res.status(400).json({ error: 'Contrato já liberado — não pode mais ser editado' });
  }

  const update = {};
  if (servico_desc !== undefined) update.servico_desc = servico_desc;
  if (valor !== undefined) update.valor = valor ? parseFloat(valor) : null;
  if (prazo !== undefined) update.prazo = prazo;
  if (pagamento !== undefined) update.pagamento = pagamento;
  if (garantia !== undefined) update.garantia = garantia;

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('blindado_contratos').update(update).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
  }

  if (Array.isArray(partes)) {
    const partesAtuais = await buscarPartes(id);
    for (const p of partes) {
      const atual = partesAtuais.find(a => a.papel === p.papel);
      if (!atual) continue;

      const updParte = {};
      if (p.nome !== undefined) updParte.nome = p.nome;
      if (p.cpf_cnpj !== undefined) updParte.cpf_cnpj = somenteDigitos(p.cpf_cnpj);
      if (p.tipo_pessoa !== undefined) updParte.tipo_pessoa = p.tipo_pessoa === 'pj' ? 'pj' : 'pf';
      if (p.data_referencia !== undefined) updParte.data_referencia = p.data_referencia || null;
      if (p.papel_contratual !== undefined) updParte.papel_contratual = p.papel_contratual;
      if (p.telefone !== undefined) {
        const novoTel = p.telefone ? formatarNumero(p.telefone) : null;
        if (novoTel !== atual.telefone) {
          updParte.telefone = novoTel;
          updParte.telefone_validado = false;
          updParte.telefone_validado_em = null;
        }
      }

      if (Object.keys(updParte).length > 0) {
        await supabase.from('blindado_partes').update(updParte).eq('id', atual.id);
      }
    }
  }

  const contratoAtualizado = await buscarContratoPorToken(contrato.token);
  const partesAtualizadas = await buscarPartes(id);
  res.json({ ok: true, contrato: contratoAtualizado, partes: partesAtualizadas });
});

// ── 4. VISÃO POR TOKEN ────────────────────────────────────────
router.get('/token/:token', async (req, res) => {
  const contrato = await buscarContratoPorToken(req.params.token);
  if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });

  const partes = await partesComAnexos(await buscarPartes(contrato.id));
  res.json({ contrato, partes });
});

// ── 5. ENVIAR OTP ─────────────────────────────────────────────
router.post('/token/:token/otp/enviar', otpLimiter, async (req, res) => {
  try {
    const { parte_id, telefone } = req.body;
    const contrato = await buscarContratoPorToken(req.params.token);
    if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });

    const partes = await buscarPartes(contrato.id);
    const parte = partes.find(p => p.id === parte_id);
    if (!parte) return res.status(404).json({ error: 'Parte não encontrada neste contrato' });
    if (parte.assinado) return res.status(400).json({ error: 'Parte já assinou' });

    // Permite informar/corrigir o telefone no momento da validação
    let numero = parte.telefone;
    if (telefone) {
      numero = formatarNumero(telefone);
      if (numero !== parte.telefone) {
        await supabase.from('blindado_partes')
          .update({ telefone: numero, telefone_validado: false, telefone_validado_em: null })
          .eq('id', parte.id);
      }
    }
    if (!numero) return res.status(400).json({ error: 'Telefone não informado' });

    const codigo = await criarOtp(parte.id, numero);

    const msg =
      `🔐 *Contrato Blindado*\n\n` +
      `Seu código de verificação: *${codigo}*\n\n` +
      `Contrato: ${contrato.codigo}\n` +
      `Válido por 10 minutos. Não compartilhe com ninguém.`;

    const envio = await enviarMensagem(numero, msg);
    if (!envio.ok) {
      return res.status(400).json({ error: envio.error || 'Falha ao enviar o código pelo WhatsApp. Confira o número.' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Blindado] Erro ao enviar OTP:', err.message);
    res.status(500).json({ error: 'Erro ao enviar código' });
  }
});

// ── 6. VERIFICAR OTP ──────────────────────────────────────────
router.post('/token/:token/otp/verificar', async (req, res) => {
  try {
    const { parte_id, codigo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Código é obrigatório' });

    const contrato = await buscarContratoPorToken(req.params.token);
    if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });

    const partes = await buscarPartes(contrato.id);
    const parte = partes.find(p => p.id === parte_id);
    if (!parte) return res.status(404).json({ error: 'Parte não encontrada neste contrato' });

    const resultado = await verificarOtp(parte.id, somenteDigitos(codigo));
    if (!resultado.ok) return res.status(400).json({ error: resultado.error });

    await supabase.from('blindado_partes')
      .update({ telefone_validado: true, telefone_validado_em: new Date().toISOString() })
      .eq('id', parte.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('[Blindado] Erro ao verificar OTP:', err.message);
    res.status(500).json({ error: 'Erro ao verificar código' });
  }
});

// ── 7. ANEXOS (selfie/documento) ──────────────────────────────
router.post('/token/:token/anexo', async (req, res) => {
  try {
    const { parte_id, tipo, base64, mimeType } = req.body;
    if (!['selfie', 'documento'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo deve ser selfie ou documento' });
    }
    if (!base64) return res.status(400).json({ error: 'base64 é obrigatório' });
    if (base64.length > 7 * 1024 * 1024) {
      return res.status(400).json({ error: 'Imagem muito grande (máx. ~5MB)' });
    }

    const contrato = await buscarContratoPorToken(req.params.token);
    if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });
    if (contrato.status === 'assinado') {
      return res.status(400).json({ error: 'Contrato já assinado — anexos bloqueados' });
    }

    const partes = await buscarPartes(contrato.id);
    const parte = partes.find(p => p.id === parte_id);
    if (!parte) return res.status(404).json({ error: 'Parte não encontrada neste contrato' });
    if (parte.assinado) return res.status(400).json({ error: 'Parte já assinou — anexos bloqueados' });

    const buffer = Buffer.from(base64, 'base64');
    const path = `contratos/${contrato.id}/${parte.id}/${tipo}-${Date.now()}.jpg`;

    const { error: errUpload } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mimeType || 'image/jpeg', upsert: true });

    if (errUpload) return res.status(500).json({ error: errUpload.message });

    // Remove anexo anterior do mesmo tipo, se houver
    const coluna = tipo === 'selfie' ? 'selfie_path' : 'documento_path';
    if (parte[coluna]) {
      await supabase.storage.from(BUCKET).remove([parte[coluna]]);
    }

    await supabase.from('blindado_partes').update({ [coluna]: path }).eq('id', parte.id);

    res.json({ ok: true, url: await signedUrl(path) });
  } catch (err) {
    console.error('[Blindado] Erro no upload de anexo:', err.message);
    res.status(500).json({ error: 'Erro ao enviar anexo' });
  }
});

router.delete('/token/:token/anexo', async (req, res) => {
  const { parte_id, tipo } = req.body;
  if (!['selfie', 'documento'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo deve ser selfie ou documento' });
  }

  const contrato = await buscarContratoPorToken(req.params.token);
  if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });

  const partes = await buscarPartes(contrato.id);
  const parte = partes.find(p => p.id === parte_id);
  if (!parte) return res.status(404).json({ error: 'Parte não encontrada neste contrato' });
  if (parte.assinado) return res.status(400).json({ error: 'Parte já assinou — anexos bloqueados' });

  const coluna = tipo === 'selfie' ? 'selfie_path' : 'documento_path';
  if (parte[coluna]) {
    await supabase.storage.from(BUCKET).remove([parte[coluna]]);
    await supabase.from('blindado_partes').update({ [coluna]: null }).eq('id', parte.id);
  }

  res.json({ ok: true });
});

// ── 8. LIBERAR PARA ASSINATURA (grátis — congela snapshot) ────
router.post('/contratos/:id/liberar', async (req, res) => {
  try {
    const { criador_tipo, criador_id } = req.body;

    const { data: contrato } = await supabase
      .from('blindado_contratos')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });
    if (contrato.criador_tipo !== criador_tipo || contrato.criador_id !== criador_id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    if (contrato.status !== 'rascunho') {
      return res.status(400).json({ error: 'Contrato já liberado' });
    }

    const partes = await buscarPartes(contrato.id);
    const criador = partes.find(p => p.papel === 'criador');
    const convidado = partes.find(p => p.papel === 'convidado');

    if (!criador || !convidado) return res.status(400).json({ error: 'Partes incompletas' });
    if (!criador.telefone_validado) {
      return res.status(400).json({ error: 'Valide seu WhatsApp antes de liberar o contrato' });
    }
    if (!contrato.servico_desc || !contrato.valor) {
      return res.status(400).json({ error: 'Descreva o serviço e informe o valor antes de liberar' });
    }
    if (!convidado.nome || !convidado.cpf_cnpj) {
      return res.status(400).json({ error: 'Complete os dados da outra parte antes de liberar' });
    }

    const snapshot = {
      codigo: contrato.codigo,
      servico_desc: contrato.servico_desc,
      valor: contrato.valor,
      prazo: contrato.prazo,
      pagamento: contrato.pagamento,
      garantia: contrato.garantia,
      partes: partes.map(p => ({
        papel: p.papel,
        papel_contratual: p.papel_contratual,
        tipo_pessoa: p.tipo_pessoa,
        nome: p.nome,
        cpf_cnpj: p.cpf_cnpj,
        data_referencia: p.data_referencia,
        telefone: p.telefone,
      })),
      liberado_em: new Date().toISOString(),
    };

    const hash = gerarHash(snapshot);

    const { error } = await supabase
      .from('blindado_contratos')
      .update({
        status: 'liberado',
        dados_snapshot: snapshot,
        hash_documento: hash,
        liberado_em: snapshot.liberado_em,
      })
      .eq('id', contrato.id);

    if (error) return res.status(500).json({ error: error.message });

    const link = `${FRONTEND_URL}/blindado/c/${contrato.token}`;

    if (convidado.telefone) {
      await enviarMensagem(
        convidado.telefone,
        `🛡️ *Contrato Blindado*\n\n` +
        `Olá, ${convidado.nome}!\n\n` +
        `*${criador.nome}* preparou um contrato para você revisar e assinar:\n\n` +
        `📋 Código: *${contrato.codigo}*\n` +
        `🔧 ${contrato.servico_desc.substring(0, 120)}${contrato.servico_desc.length > 120 ? '...' : ''}\n\n` +
        `Acesse, confira os dados e assine com segurança:\n${link}\n\n` +
        `_Contrato Blindado — formalização com evidências digitais_ 🔐`
      );
    }

    res.json({ ok: true, link, hash });
  } catch (err) {
    console.error('[Blindado] Erro ao liberar contrato:', err.message);
    res.status(500).json({ error: 'Erro ao liberar contrato' });
  }
});

// ── 9. PAGAR COM CRÉDITO (gate das assinaturas) ───────────────
router.post('/contratos/:id/pagar-credito', async (req, res) => {
  try {
    const { criador_tipo, criador_id } = req.body;

    const { data: contrato } = await supabase
      .from('blindado_contratos')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });
    if (contrato.criador_tipo !== criador_tipo || contrato.criador_id !== criador_id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    if (contrato.status !== 'liberado') {
      return res.status(400).json({ error: 'Contrato precisa estar liberado' });
    }
    if (contrato.pago) {
      return res.json({ ok: true, jaPago: true });
    }

    if (process.env.BLINDADO_SKIP_CREDITO !== 'true') {
      const { data: debitou, error: errRpc } = await supabase.rpc('blindado_debitar_credito', {
        p_user_tipo: criador_tipo,
        p_user_id: criador_id,
        p_contrato_id: contrato.id,
      });
      if (errRpc) return res.status(500).json({ error: errRpc.message });
      if (!debitou) {
        return res.status(402).json({ error: 'Sem créditos disponíveis', saldo: 0 });
      }
    }

    const { error } = await supabase
      .from('blindado_contratos')
      .update({ pago: true, pago_em: new Date().toISOString() })
      .eq('id', contrato.id);

    if (error) return res.status(500).json({ error: error.message });

    const partes = await buscarPartes(contrato.id);
    const link = `${FRONTEND_URL}/blindado/c/${contrato.token}`;
    for (const p of partes) {
      if (p.telefone) {
        await enviarMensagem(
          p.telefone,
          `🔓 *Contrato Blindado ${contrato.codigo}*\n\n` +
          `As assinaturas foram liberadas! Acesse para assinar:\n${link}`
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Blindado] Erro ao pagar com crédito:', err.message);
    res.status(500).json({ error: 'Erro ao usar crédito' });
  }
});

// ── 10. ASSINAR ───────────────────────────────────────────────
router.post('/token/:token/assinar', async (req, res) => {
  try {
    const { parte_id, cpf_confirmado, aceite, ip, user_agent, geo } = req.body;

    const contrato = await buscarContratoPorToken(req.params.token);
    if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });
    if (contrato.status === 'assinado') return res.status(400).json({ error: 'Contrato já assinado' });
    if (contrato.status !== 'liberado') {
      return res.status(400).json({ error: 'Contrato ainda não liberado para assinatura' });
    }
    if (!contrato.pago) {
      return res.status(402).json({ error: 'Assinaturas ainda não liberadas — aguardando pagamento' });
    }

    const partes = await buscarPartes(contrato.id);
    const parte = partes.find(p => p.id === parte_id);
    if (!parte) return res.status(404).json({ error: 'Parte não encontrada neste contrato' });
    if (parte.assinado) return res.status(400).json({ error: 'Você já assinou este contrato' });
    if (!parte.telefone_validado) {
      return res.status(400).json({ error: 'Valide seu WhatsApp antes de assinar' });
    }
    if (aceite !== true) {
      return res.status(400).json({ error: 'É necessário aceitar as cláusulas do contrato' });
    }
    if (somenteDigitos(cpf_confirmado) !== parte.cpf_cnpj) {
      return res.status(400).json({ error: 'O documento informado não confere com o cadastrado no contrato' });
    }

    const timestamp = new Date().toISOString();
    const update = {
      assinado: true,
      assinado_em: timestamp,
      ip: ip || 'desconhecido',
      user_agent: user_agent || null,
    };

    if (geo && geo.lat != null && geo.lng != null) {
      update.geo_lat = geo.lat;
      update.geo_lng = geo.lng;
      update.geo_accuracy = geo.accuracy || null;
      const local = await reverseGeocode(geo.lat, geo.lng);
      if (local) {
        update.geo_cidade = local.cidade;
        update.geo_uf = local.uf;
        update.geo_pais = local.pais;
      }
    }

    const { error } = await supabase.from('blindado_partes').update(update).eq('id', parte.id);
    if (error) return res.status(500).json({ error: error.message });

    const outra = partes.find(p => p.id !== parte.id);
    const ambosAssinaram = outra && outra.assinado;

    if (ambosAssinaram) {
      await supabase
        .from('blindado_contratos')
        .update({ status: 'assinado', assinado_em: timestamp })
        .eq('id', contrato.id);

      const link = `${FRONTEND_URL}/blindado/c/${contrato.token}`;
      for (const p of partes) {
        if (p.telefone) {
          await enviarMensagem(
            p.telefone,
            `✅ *Contrato Blindado ${contrato.codigo} assinado!*\n\n` +
            `Ambas as partes assinaram. O contrato está concluído e protegido por evidências digitais.\n\n` +
            `Acesse a versão online e baixe o PDF:\n${link}\n\n` +
            `_Guarde este link. Você também pode recuperar seus contratos em ${FRONTEND_URL}/blindado/acesso usando seu CPF/CNPJ._`
          );
        }
      }
    }

    res.json({ ok: true, ambosAssinaram: !!ambosAssinaram });
  } catch (err) {
    console.error('[Blindado] Erro ao assinar:', err.message);
    res.status(500).json({ error: 'Erro ao assinar contrato' });
  }
});

// ── 11. PDF ───────────────────────────────────────────────────
router.get('/token/:token/pdf', async (req, res) => {
  try {
    const contrato = await buscarContratoPorToken(req.params.token);
    if (!contrato) return res.status(404).json({ error: 'Contrato não encontrado' });
    if (contrato.status === 'rascunho') {
      return res.status(400).json({ error: 'Contrato ainda em rascunho' });
    }

    const partes = await buscarPartes(contrato.id);

    const baixarAnexo = async (path) => {
      if (!path) return null;
      try {
        const { data: blob } = await supabase.storage.from(BUCKET).download(path);
        return blob ? Buffer.from(await blob.arrayBuffer()) : null;
      } catch (e) {
        console.error('[Blindado] Falha ao baixar anexo:', path, e.message);
        return null;
      }
    };

    const partesPDF = await Promise.all(partes.map(async (p) => ({
      papelContratual: p.papel_contratual,
      nome: p.nome,
      cpfCnpj: p.cpf_cnpj,
      tipoPessoa: p.tipo_pessoa,
      telefone: p.telefone,
      telefoneValidadoEm: p.telefone_validado_em,
      assinado: p.assinado,
      assinadoEm: p.assinado_em,
      ip: p.ip,
      userAgent: p.user_agent,
      geoCidade: p.geo_cidade,
      geoUf: p.geo_uf,
      geoLat: p.geo_lat,
      geoLng: p.geo_lng,
      geoAccuracy: p.geo_accuracy,
      selfieBuffer: await baixarAnexo(p.selfie_path),
      documentoBuffer: await baixarAnexo(p.documento_path),
    })));

    const pdf = await gerarPDFBlindado({
      codigo: contrato.codigo,
      servico: contrato.servico_desc,
      valor: contrato.valor,
      prazo: contrato.prazo,
      pagamento: contrato.pagamento,
      garantia: contrato.garantia,
      dataGeracao: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      hashDocumento: contrato.hash_documento || '--',
      partes: partesPDF,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contrato-blindado-${contrato.codigo}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('[Blindado] Erro ao gerar PDF:', err.message);
    res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

// ── 12. ACESSO POR CPF/CNPJ + DATA (sem cadastro) ─────────────
router.post('/acesso', acessoLimiter, async (req, res) => {
  try {
    const cpfCnpj = somenteDigitos(req.body.cpf_cnpj);
    const dataReferencia = req.body.data_referencia;

    // Resposta uniforme (array vazio) para qualquer combinação inválida —
    // não vazar a existência de um CPF na base.
    if (!cpfCnpj || !dataReferencia) return res.json({ contratos: [] });

    const { data: partes } = await supabase
      .from('blindado_partes')
      .select('contrato_id, blindado_contratos!inner(id, codigo, token, status, servico_desc, valor, assinado_em)')
      .eq('cpf_cnpj', cpfCnpj)
      .eq('data_referencia', dataReferencia)
      .eq('blindado_contratos.status', 'assinado');

    const vistos = new Set();
    const contratos = [];
    for (const p of partes || []) {
      const c = p.blindado_contratos;
      if (c && !vistos.has(c.id)) {
        vistos.add(c.id);
        contratos.push({
          codigo: c.codigo,
          token: c.token,
          servico_desc: c.servico_desc,
          valor: c.valor,
          assinado_em: c.assinado_em,
        });
      }
    }

    res.json({ contratos });
  } catch (err) {
    console.error('[Blindado] Erro no acesso por documento:', err.message);
    res.json({ contratos: [] });
  }
});

module.exports = router;
