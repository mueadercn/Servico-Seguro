const express = require('express');
const router = express.Router();
const path = require('path');
const supabase = require(path.join(__dirname, '../services/supabase'));
const { enviarMensagem, templates } = require(path.join(__dirname, '../services/whatsapp'));
const { conduzirAnamnese, gerarResumo, interpretarResposta } = require(path.join(__dirname, '../services/ia'));

// ── WEBHOOK ───────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true });

  try {
    const payload = req.body;
    if (payload.event !== 'messages.upsert') return;

    const data = payload.data;
    if (!data || data.key?.fromMe) return;

    const remoteJid = data.key?.remoteJidAlt || data.key?.remoteJid || '';
    const numero = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
    const texto = data.message?.conversation ||
                  data.message?.extendedTextMessage?.text ||
                  data.message?.imageMessage?.caption || '';

    if (!numero || !texto) return;

    console.log(`[WhatsApp] <- ${numero}: ${texto.substring(0, 80)}`);
    await processarMensagem(numero, texto);

  } catch (err) {
    console.error('[WhatsApp] Erro webhook:', err.message);
  }
});

// ── PROCESSADOR CENTRAL ───────────────────────────────────────
async function processarMensagem(numero, texto) {

  // 1. Verificar se já tem ORC ativo (pós-anamnese)
  const orc = await buscarOrcAtivo(numero);
  if (orc) {
    console.log(`[PROC] ORC ativo encontrado: ${orc.codigo} - ${orc.status}`);
    await handleOrcAtivo(orc, numero, texto);
    return;
  }

  // 2. Verificar se tem sessão de anamnese em andamento
  const sessao = await buscarSessao(numero);

  if (sessao) {
    console.log(`[PROC] Sessão ativa encontrada para ${numero}`);
    await handleAnamnese(sessao, numero, texto);
    return;
  }

  // 3. Nova mensagem — verificar identificador de serviço
  const ids = extrairIdentificadores(texto);

  if (ids.temIdentificador) {
    console.log(`[PROC] Novo lead com serviço identificado: ${ids.servico_id}`);
    await iniciarSessao(numero, texto, ids);
    return;
  }

  // 4. Mensagem sem contexto — orientar
  await enviarMensagem(numero,
    `Olá! 😊 Sou a assistente do *Serviço Seguro*.\n\n` +
    `Para solicitar um orçamento, acesse nosso site, encontre o serviço e clique em *"Via WhatsApp"*.\n\n` +
    `🌐 classy-cucurucho-4e3455.netlify.app\n\n` +
    `_Serviço Seguro — Serviços com Segurança_ 🛡️`
  );
}

// ── INICIAR SESSÃO DE ANAMNESE ────────────────────────────────
async function iniciarSessao(numero, texto, ids) {
  let servicoNome = 'Serviço solicitado';
  let prestadorId = ids.prestador_id;
  let categoriaNome = ids.categoria || '';

  // Buscar dados do serviço
  if (ids.servico_id) {
    const { data: svc } = await supabase
      .from('servicos')
      .select('titulo, prestador_id, categorias(nome)')
      .eq('id', ids.servico_id).limit(1);
    if (svc?.[0]) {
      servicoNome = svc[0].titulo;
      prestadorId = prestadorId || svc[0].prestador_id;
      categoriaNome = svc[0].categorias?.nome || categoriaNome;
    }
  }

  // Criar sessão temporária
  const { data: sessao, error } = await supabase
    .from('sessoes_whatsapp')
    .upsert({
      telefone: numero,
      servico_id: ids.servico_id || null,
      prestador_id: prestadorId || null,
      servico_nome: servicoNome,
      categoria_nome: categoriaNome,
      historico: [],
      nome_cliente: 'Cliente',
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'telefone' })
    .select().single();

  if (error) {
    console.error('[SESSÃO] Erro ao criar sessão:', error.message);
    return;
  }

  console.log(`[SESSÃO] Criada para ${numero} — serviço: ${servicoNome}`);

  // Boas-vindas
  const boasVindas =
    `Olá! 😊 Sou a assistente do *Serviço Seguro*.\n\n` +
    `Vi que você tem interesse em: *${servicoNome}*\n\n` +
    `Vou te fazer algumas perguntas rápidas para preparar o melhor orçamento. Pode ser?`;

  await enviarMensagem(numero, boasVindas);

  // Salvar no histórico
  await atualizarHistorico(numero, [], 'assistant', boasVindas);
}

// ── CONDUZIR ANAMNESE ─────────────────────────────────────────
async function handleAnamnese(sessao, numero, texto) {
  const historico = sessao.historico || [];

  // Adicionar mensagem do cliente
  const novoHistorico = [...historico, { role: 'user', content: texto }];

  // Chamar IA
  console.log(`[ANAMNESE] Chamando IA para ${numero} — cat: ${sessao.categoria_nome}`);
  const resultado = await conduzirAnamnese(
    novoHistorico,
    sessao.categoria_nome || '',
    sessao.servico_nome || ''
  );

  console.log(`[ANAMNESE] IA resultado: ok=${resultado.ok} concluida=${resultado.concluida} erro=${resultado.error || 'nenhum'}`);

  if (!resultado.ok) {
    await enviarMensagem(numero, `Desculpe, tive um problema técnico. Pode repetir?`);
    return;
  }

  if (resultado.concluida) {
    console.log(`[ANAMNESE] ✅ Anamnese concluída!`);
    // ── ANAMNESE CONCLUÍDA — CRIAR ORC ────────────────────────
    console.log(`[ANAMNESE] Concluída! Gerando resumo e criando ORC...`);

    const { resumo } = await gerarResumo(novoHistorico, sessao.servico_nome);
    console.log(`[ANAMNESE] Resumo: ${resumo?.substring(0, 100)}`);

    // Criar ORC completo
    const codigo = 'ORC-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5);
    const { data: novoOrc, error: orcError } = await supabase
      .from('orcs')
      .insert({
        codigo,
        servico_id: sessao.servico_id || null,
        prestador_id: sessao.prestador_id || null,
        nome_cliente: sessao.nome_cliente || 'Cliente WhatsApp',
        telefone_cliente: numero,
        canal: 'whatsapp',
        status: 'ANAMNESE CONCLUÍDA',
        resumo_anamnese: resumo,
        disponibilidade_cliente: extrairDisponibilidade(novoHistorico)
      })
      .select().single();

    if (orcError) {
      console.error('[ORC] Erro ao criar ORC:', orcError.message);
      await enviarMensagem(numero, `Perfeito! Suas informações foram registradas. Em breve entraremos em contato! 😊`);
    } else {
      console.log(`[ORC] Criado com sucesso: ${novoOrc.codigo}`);

      // Salvar mensagens no histórico do ORC
      for (const msg of novoHistorico) {
        await supabase.from('mensagens').insert({
          orc_id: novoOrc.id,
          remetente: msg.role === 'user' ? 'cliente' : 'ia',
          conteudo: msg.content
        });
      }

      // Confirmar ao cliente
      await enviarMensagem(numero, templates.orcamentoRecebido(
        sessao.nome_cliente || 'Cliente',
        novoOrc.codigo,
        sessao.servico_nome || 'serviço solicitado'
      ));

      // Notificar admin
      const adminNum = process.env.ADMIN_WHATSAPP;
      if (adminNum) {
        await enviarMensagem(adminNum,
          `✅ *Nova anamnese concluída!*\n\n` +
          `📋 ORC: ${novoOrc.codigo}\n` +
          `👤 Cliente: ${sessao.nome_cliente}\n` +
          `📱 Telefone: ${numero}\n` +
          `🔧 Serviço: ${sessao.servico_nome}\n\n` +
          `*Resumo:*\n${resumo}\n\n` +
          `Acesse o painel para vincular um prestador.`
        );
      }
    }

    // Deletar sessão temporária
    await supabase.from('sessoes_whatsapp').delete().eq('telefone', numero);
    console.log(`[SESSÃO] Encerrada para ${numero}`);

  } else {
    // Continuar anamnese — enviar próxima pergunta
    const resposta = resultado.resposta;
    console.log(`[ANAMNESE] 🤖 IA respondeu: ${resposta?.substring(0, 100)}`);
    await enviarMensagem(numero, resposta);

    // Atualizar histórico na sessão
    const historicoAtualizado = [
      ...novoHistorico,
      { role: 'assistant', content: resposta }
    ];
    await atualizarHistorico(numero, historicoAtualizado);
  }
}

// ── HANDLE ORC ATIVO (pós-anamnese) ──────────────────────────
async function handleOrcAtivo(orc, numero, texto) {
  const status = orc.status;

  if (['PRESTADOR NOTIFICADO', 'AGUARDANDO PRESTADOR'].includes(status)) {
    await handleRespostaPrestador(orc, numero, texto);
    return;
  }

  if (['VISITA REALIZADA', 'AGUARDANDO DECISÃO'].includes(status)) {
    await handleFollowUp(orc, numero, texto);
    return;
  }

  if (status === 'AGUARDANDO ASSINATURA') {
    await enviarMensagem(numero,
      `Para assinar o contrato, acesse o link enviado anteriormente. ` +
      `Qualquer dúvida, nossa equipe está disponível! 😊`
    );
  }
}

// ── RESPOSTA DO PRESTADOR ─────────────────────────────────────
async function handleRespostaPrestador(orc, numero, texto) {
  const interp = await interpretarResposta(texto, `Prestador respondendo sobre disponibilidade para visita. ORC: ${orc.codigo}`);

  if (interp.intencao === 'aceitar') {
    await supabase.from('orcs').update({ status: 'VISITA AGENDADA', disponibilidade_prestador: texto }).eq('id', orc.id);

    if (orc.telefone_cliente) {
      await enviarMensagem(orc.telefone_cliente, templates.agendamentoConfirmado(
        orc.nome_cliente, orc.prestadores?.nome, texto, orc.prestadores?.telefone
      ));
    }
    await enviarMensagem(numero, templates.dadosCliente(
      orc.prestadores?.nome, orc.nome_cliente,
      orc.usuarios?.endereco || 'A confirmar',
      orc.telefone_cliente, orc.disponibilidade_cliente
    ));
    return;
  }

  if (interp.intencao === 'recusar' || interp.intencao === 'propor_horario') {
    const tentativas = (orc.ping_pong_tentativas || 0) + 1;
    await supabase.from('orcs').update({ ping_pong_tentativas: tentativas }).eq('id', orc.id);

    if (tentativas <= 2) {
      if (orc.telefone_cliente) {
        const msg = tentativas === 1
          ? templates.pingPong1(orc.nome_cliente, texto)
          : templates.pingPong2(orc.nome_cliente);
        await enviarMensagem(orc.telefone_cliente, msg);
      }
    } else {
      await supabase.from('orcs').update({ status: 'SEM RESPOSTA PRESTADOR' }).eq('id', orc.id);
      if (orc.telefone_cliente) {
        await enviarMensagem(orc.telefone_cliente, templates.enviarContatoPrestador(
          orc.nome_cliente, orc.prestadores?.nome, orc.prestadores?.telefone
        ));
      }
      await enviarMensagem(numero, templates.enviarContatoCliente(
        orc.prestadores?.nome, orc.nome_cliente, orc.telefone_cliente
      ));
    }
  }
}

// ── FOLLOW-UP PÓS-VISITA ──────────────────────────────────────
async function handleFollowUp(orc, numero, texto) {
  const interp = await interpretarResposta(texto, `Follow-up pós-visita. Perguntando se fechou.`);

  if (interp.intencao === 'aceitar') {
    await enviarMensagem(numero, `Ótimo! Qual foi o valor combinado? (só o número, ex: 850)`);
    return;
  }

  if (interp.valor) {
    await supabase.from('orcs').update({
      [numero === orc.telefone_cliente ? 'valor_cliente' : 'valor_prestador']: interp.valor
    }).eq('id', orc.id);

    const { data: orcAtual } = await supabase.from('orcs').select('*').eq('id', orc.id).single();

    if (orcAtual.valor_cliente && orcAtual.valor_prestador) {
      const divergencia = Math.abs(orcAtual.valor_cliente - orcAtual.valor_prestador) > 1;

      if (divergencia) {
        await supabase.from('orcs').update({ status: 'DIVERGÊNCIA DE VALOR' }).eq('id', orc.id);
        if (orc.telefone_cliente) await enviarMensagem(orc.telefone_cliente, templates.divergencia(orc.nome_cliente, orcAtual.valor_cliente, orcAtual.valor_prestador));
        await enviarMensagem(numero, templates.divergencia(orc.prestadores?.nome, orcAtual.valor_prestador, orcAtual.valor_cliente));
      } else {
        await supabase.from('orcs').update({ status: 'FECHADO', valor_final: interp.valor }).eq('id', orc.id);
        const link = `${process.env.FRONTEND_URL}/contrato?orc=${orc.id}&codigo=${orc.codigo}`;
        if (orc.telefone_cliente) await enviarMensagem(orc.telefone_cliente, templates.linkContrato(orc.nome_cliente, 'a confirmar', link, orc.codigo));
        await enviarMensagem(numero, templates.linkContrato(orc.prestadores?.nome, 'a confirmar', link, orc.codigo));
      }
    } else {
      await enviarMensagem(numero, `Valor registrado! Aguardando confirmação da outra parte. 👍`);
    }
    return;
  }

  if (interp.intencao === 'recusar') {
    await supabase.from('orcs').update({ status: 'NÃO FECHOU' }).eq('id', orc.id);
    await enviarMensagem(numero, `Entendemos! Se precisar de outro profissional, estamos aqui. 😊`);
  }
}

// ── HELPERS ───────────────────────────────────────────────────
async function buscarOrcAtivo(numero) {
  const numLimpo = numero.replace(/\D/g, '');
  const { data } = await supabase
    .from('orcs')
    .select('*, prestadores(nome, telefone), usuarios(nome, endereco, telefone), servicos(titulo, categorias(nome))')
    .or(`telefone_cliente.eq.${numLimpo},telefone_cliente.eq.+55${numLimpo}`)
    .not('status', 'in', '("ENCERRADO","NÃO FECHOU","CANCELADO","CONTRATO ASSINADO","ANAMNESE CONCLUÍDA")')
    .order('criado_em', { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

async function buscarSessao(numero) {
  const { data } = await supabase
    .from('sessoes_whatsapp')
    .select('*')
    .eq('telefone', numero)
    .limit(1);
  return data?.[0] || null;
}

async function atualizarHistorico(numero, historico, role, content) {
  let hist = historico;
  if (role && content) {
    hist = [...historico, { role, content }];
  }
  await supabase.from('sessoes_whatsapp')
    .update({ historico: hist, atualizado_em: new Date().toISOString() })
    .eq('telefone', numero);
}

function extrairIdentificadores(texto) {
  const servicoMatch = texto.match(/#SERVICO:([a-f0-9-]+)/i);
  const prestadorMatch = texto.match(/#PRESTADOR:([a-f0-9-]+)/i);
  const catMatch = texto.match(/#CAT:([^|\n]+)/i);

  let servico_id = servicoMatch?.[1] || null;
  let prestador_id = prestadorMatch?.[1] || null;

  // Validar UUID completo (36 chars com hifens ou 32 sem)
  const isUUID = (id) => id && (id.length === 36 || id.length === 32);
  
  // Se não for UUID válido, ignorar
  if (!isUUID(servico_id)) servico_id = null;
  if (!isUUID(prestador_id)) prestador_id = null;

  const temIdentificador = !!(servico_id || prestador_id || texto.includes('#SERVICO:'));

  return {
    servico_id,
    prestador_id,
    categoria: catMatch?.[1]?.trim() || null,
    temIdentificador
  };
}

function extrairDisponibilidade(historico) {
  const textos = historico.filter(m => m.role === 'user').map(m => m.content).join(' ');
  const patterns = [
    /\b(segunda|terça|quarta|quinta|sexta|sábado|domingo)\b/gi,
    /\b(manhã|tarde|noite)\b/gi,
    /\b(hoje|amanhã|essa semana|próxima semana)\b/gi,
  ];
  const encontrados = [];
  patterns.forEach(p => { const m = textos.match(p); if (m) encontrados.push(...m); });
  return encontrados.length > 0 ? [...new Set(encontrados)].join(', ') : textos.slice(-200);
}

// ── ROTAS AUXILIARES ──────────────────────────────────────────
router.post('/enviar', async (req, res) => {
  try {
    const { numero, mensagem, orc_id } = req.body;
    const resultado = await enviarMensagem(numero, mensagem);
    if (orc_id && resultado.ok) {
      await supabase.from('mensagens').insert({ orc_id, remetente: 'sistema', conteudo: mensagem });
    }
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/status', async (req, res) => {
  const { verificarInstancia } = require(path.join(__dirname, '../services/whatsapp'));
  const status = await verificarInstancia();
  res.json(status);
});

module.exports = router;
