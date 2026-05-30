const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { enviarMensagem, templates } = require('../services/whatsapp');
const { conduzirAnamnese, gerarResumo, interpretarResposta } = require('../services/ia');

// ── WEBHOOK — recebe mensagens da Evolution API ───────────────
// POST /api/whatsapp/webhook
router.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true }); // Responde rápido para a Evolution não reenviar

  try {
    const payload = req.body;

    // Filtrar: só mensagens recebidas (não enviadas por nós)
    if (payload.event !== 'messages.upsert') return;
    const msg = payload.data?.message;
    if (!msg || msg.key?.fromMe) return;

    const numero = msg.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const texto = msg.message?.conversation ||
                  msg.message?.extendedTextMessage?.text || '';

    if (!numero || !texto) return;

    console.log(`[WhatsApp] ← ${numero}: ${texto.substring(0, 80)}`);

    // Processar a mensagem
    await processarMensagem(numero, texto, msg);

  } catch (err) {
    console.error('[WhatsApp] Erro no webhook:', err.message);
  }
});

// ── EXTRAIR IDENTIFICADORES DA MENSAGEM ──────────────────────
function extrairIdentificadores(texto) {
  // Formato: #SERVICO:uuid|#PRESTADOR:uuid|#CAT:categoria
  const servicoMatch = texto.match(/#SERVICO:([a-f0-9-]+)/i);
  const prestadorMatch = texto.match(/#PRESTADOR:([a-f0-9-]+)/i);
  const catMatch = texto.match(/#CAT:([^|\n]+)/i);
  return {
    servico_id: servicoMatch?.[1] || null,
    prestador_id: prestadorMatch?.[1] || null,
    categoria: catMatch?.[1]?.trim() || null,
    temIdentificador: !!(servicoMatch || prestadorMatch)
  };
}

// ── PROCESSADOR CENTRAL ───────────────────────────────────────
async function processarMensagem(numero, texto, msgRaw) {
  // 1. Identificar ORC ativo para esse número
  const orc = await buscarOrcAtivo(numero);

  if (!orc) {
    // Verificar se a mensagem tem identificadores de serviço
    const ids = extrairIdentificadores(texto);

    if (ids.temIdentificador) {
      // Criar ORC automaticamente a partir do WhatsApp
      const codigo = 'ORC-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5);

      // Buscar dados do serviço e prestador
      let servicoNome = 'Serviço solicitado';
      let prestadorId = ids.prestador_id;
      let categoriaId = null;

      if (ids.servico_id) {
        const { data: svc } = await supabase
          .from('servicos')
          .select('titulo, categoria_id, prestador_id, categorias(nome)')
          .eq('id', ids.servico_id).limit(1);
        if (svc?.[0]) {
          servicoNome = svc[0].titulo;
          prestadorId = prestadorId || svc[0].prestador_id;
          categoriaId = svc[0].categoria_id;
        }
      }

      const { data: novoOrc } = await supabase.from('orcs').insert({
        codigo,
        servico_id: ids.servico_id || null,
        prestador_id: prestadorId || null,
        nome_cliente: 'Cliente WhatsApp',
        telefone_cliente: numero,
        canal: 'whatsapp',
        status: 'EM ANAMNESE'
      }).select().single();

      if (novoOrc) {
        // Iniciar anamnese imediatamente
        const orc_novo = {
          ...novoOrc,
          servicos: { titulo: servicoNome, categorias: { nome: ids.categoria || '' } }
        };

        // Mensagem de boas-vindas
        await enviarMensagem(numero,
          `Olá! 😊 Sou a assistente do *Serviço Seguro*.\n\n` +
          `Vi que você tem interesse em: *${servicoNome}*\n\n` +
          `Vou te fazer algumas perguntas rápidas para preparar o melhor orçamento. Pode ser?`
        );

        // Log
        await supabase.from('mensagens').insert({
          orc_id: novoOrc.id, remetente: 'cliente',
          conteudo: texto
        });
        return;
      }
    }

    // Mensagem sem identificador — orientar o usuário
    await enviarMensagem(numero,
      `Olá! 😊 Sou a assistente do *Serviço Seguro*.\n\n` +
      `Para solicitar um orçamento, acesse nosso site, encontre o serviço que precisa e clique em *"Orçamento via WhatsApp"*.\n\n` +
      `🌐 Acesse: classy-cucurucho-4e3455.netlify.app\n\n` +
      `_Serviço Seguro — Serviços Profissionais com Segurança_ 🛡️`
    );
    return;
  }

  // 2. Log da mensagem
  await supabase.from('mensagens').insert({
    orc_id: orc.id,
    remetente: numero === orc.prestadores?.telefone?.replace(/\D/g,'') ? 'prestador' : 'cliente',
    conteudo: texto
  });

  // 3. Roteamento por status
  const status = orc.status;

  if (['NOVO', 'EM ANAMNESE'].includes(status)) {
    await handleAnamnese(orc, numero, texto);
    return;
  }

  if (status === 'PRESTADOR NOTIFICADO' || status === 'AGUARDANDO PRESTADOR') {
    await handleRespostaPrestador(orc, numero, texto);
    return;
  }

  if (status === 'VISITA REALIZADA' || status === 'AGUARDANDO DECISÃO') {
    await handleFollowUp(orc, numero, texto);
    return;
  }

  if (status === 'AGUARDANDO ASSINATURA') {
    await enviarMensagem(numero,
      `Para assinar o contrato, acesse o link enviado anteriormente. ` +
      `Se precisar de ajuda, nossa equipe está disponível.`
    );
    return;
  }
}

// ── ANAMNESE ──────────────────────────────────────────────────
async function handleAnamnese(orc, numero, texto) {
  // Buscar histórico de mensagens
  const { data: msgs } = await supabase
    .from('mensagens')
    .select('remetente, conteudo')
    .eq('orc_id', orc.id)
    .order('criado_em', { ascending: true });

  const historico = (msgs || []).map(m => ({
    role: m.remetente === 'cliente' ? 'user' : 'assistant',
    content: m.conteudo
  }));

  // Atualizar status
  await supabase.from('orcs').update({ status: 'EM ANAMNESE' }).eq('id', orc.id);

  // Chamar IA
  const resultado = await conduzirAnamnese(
    historico,
    orc.servicos?.categorias?.nome || '',
    orc.servicos?.titulo || ''
  );

  if (resultado.concluida) {
    // Gerar resumo
    const { resumo } = await gerarResumo(historico, orc.servicos?.titulo);

    // Salvar e atualizar
    await supabase.from('orcs').update({
      status: 'ANAMNESE CONCLUÍDA',
      resumo_anamnese: resumo,
      disponibilidade_cliente: extrairDisponibilidade(historico)
    }).eq('id', orc.id);

    // Confirmar ao cliente
    await enviarMensagem(numero, templates.orcamentoRecebido(
      orc.nome_cliente,
      orc.codigo,
      orc.servicos?.titulo || 'serviço solicitado'
    ));

    // Notificar admin no WhatsApp
    const adminNum = process.env.ADMIN_WHATSAPP;
    if (adminNum) {
      await enviarMensagem(adminNum,
        `✅ Anamnese concluída!\n\n` +
        `ORC: ${orc.codigo}\n` +
        `Cliente: ${orc.nome_cliente}\n` +
        `Serviço: ${orc.servicos?.titulo}\n\n` +
        `Resumo: ${resumo}\n\n` +
        `Acesse o painel para vincular um prestador.`
      );
    }
    return;
  }

  // Enviar próxima pergunta
  if (resultado.resposta) {
    await supabase.from('mensagens').insert({
      orc_id: orc.id, remetente: 'ia', conteudo: resultado.resposta
    });
    await enviarMensagem(numero, resultado.resposta);
  }
}

// ── RESPOSTA DO PRESTADOR ─────────────────────────────────────
async function handleRespostaPrestador(orc, numero, texto) {
  const interp = await interpretarResposta(texto,
    `Prestador respondendo sobre disponibilidade para visita. ORC: ${orc.codigo}`
  );

  if (interp.intencao === 'aceitar') {
    // Prestador aceitou — confirmar com cliente
    await supabase.from('orcs').update({
      status: 'VISITA AGENDADA',
      disponibilidade_prestador: texto
    }).eq('id', orc.id);

    // Mensagem para o cliente
    if (orc.telefone_cliente) {
      await enviarMensagem(orc.telefone_cliente, templates.agendamentoConfirmado(
        orc.nome_cliente,
        orc.prestadores?.nome,
        texto,
        orc.prestadores?.telefone
      ));
    }

    // Confirmar ao prestador com dados do cliente
    await enviarMensagem(numero, templates.dadosCliente(
      orc.prestadores?.nome,
      orc.nome_cliente,
      orc.usuarios?.endereco || 'A confirmar',
      orc.telefone_cliente,
      orc.disponibilidade_cliente
    ));

    return;
  }

  if (interp.intencao === 'recusar' || interp.intencao === 'propor_horario') {
    // Ping-pong — verificar tentativas
    const tentativas = (orc.ping_pong_tentativas || 0) + 1;

    await supabase.from('orcs').update({
      ping_pong_tentativas: tentativas
    }).eq('id', orc.id);

    if (tentativas <= 2) {
      // Voltar ao cliente pedindo novos horários
      if (orc.telefone_cliente) {
        const msg = tentativas === 1
          ? templates.pingPong1(orc.nome_cliente, texto)
          : templates.pingPong2(orc.nome_cliente);
        await enviarMensagem(orc.telefone_cliente, msg);
      }
    } else {
      // 3ª tentativa — enviar contatos diretos
      await supabase.from('orcs').update({ status: 'SEM RESPOSTA PRESTADOR' }).eq('id', orc.id);

      if (orc.telefone_cliente) {
        await enviarMensagem(orc.telefone_cliente, templates.enviarContatoPrestador(
          orc.nome_cliente,
          orc.prestadores?.nome,
          orc.prestadores?.telefone
        ));
      }
      await enviarMensagem(numero, templates.enviarContatoCliente(
        orc.prestadores?.nome,
        orc.nome_cliente,
        orc.telefone_cliente
      ));
    }
  }
}

// ── FOLLOW-UP PÓS-VISITA ──────────────────────────────────────
async function handleFollowUp(orc, numero, texto) {
  const ehPrestador = numero.replace(/\D/g,'').endsWith(
    orc.prestadores?.telefone?.replace(/\D/g,'')?.slice(-8) || 'XXXXX'
  );

  const interp = await interpretarResposta(texto,
    `Follow-up pós-visita. Perguntando se o serviço foi fechado.`
  );

  if (interp.intencao === 'aceitar') {
    // Pergunta o valor
    await enviarMensagem(numero,
      ehPrestador
        ? `Ótimo! Qual foi o valor combinado com o cliente? (apenas o número, ex: 850)`
        : `Ótimo! Qual foi o valor combinado com o profissional? (apenas o número, ex: 850)`
    );
    await supabase.from('orcs').update({
      [ehPrestador ? 'valor_prestador_confirmado' : 'valor_cliente_confirmado']: true
    }).eq('id', orc.id);
    return;
  }

  if (interp.valor) {
    // Recebeu valor
    await supabase.from('orcs').update({
      [ehPrestador ? 'valor_prestador' : 'valor_cliente']: interp.valor
    }).eq('id', orc.id);

    // Buscar dados atualizados
    const { data: orcAtual } = await supabase
      .from('orcs').select('*').eq('id', orc.id).single();

    // Verificar se ambos informaram valor
    if (orcAtual.valor_cliente && orcAtual.valor_prestador) {
      const divergencia = Math.abs(orcAtual.valor_cliente - orcAtual.valor_prestador) > 1;

      if (divergencia) {
        // Alertar ambos
        await supabase.from('orcs').update({ status: 'DIVERGÊNCIA DE VALOR' }).eq('id', orc.id);
        if (orc.telefone_cliente) {
          await enviarMensagem(orc.telefone_cliente, templates.divergencia(
            orc.nome_cliente, orcAtual.valor_cliente, orcAtual.valor_prestador
          ));
        }
        await enviarMensagem(numero, templates.divergencia(
          orc.prestadores?.nome, orcAtual.valor_prestador, orcAtual.valor_cliente
        ));
      } else {
        // Valores batem — gerar contrato
        await supabase.from('orcs').update({
          status: 'FECHADO',
          valor_final: interp.valor
        }).eq('id', orc.id);

        const linkContrato = `${process.env.FRONTEND_URL}/contrato.html?orc=${orc.id}&codigo=${orc.codigo}`;

        if (orc.telefone_cliente) {
          await enviarMensagem(orc.telefone_cliente, templates.linkContrato(
            orc.nome_cliente, 'a confirmar', linkContrato, orc.codigo
          ));
        }
        await enviarMensagem(numero, templates.linkContrato(
          orc.prestadores?.nome, 'a confirmar', linkContrato, orc.codigo
        ));
      }
    } else {
      await enviarMensagem(numero, `Valor registrado! Aguardando confirmação da outra parte. 👍`);
    }
    return;
  }

  if (interp.intencao === 'recusar') {
    await supabase.from('orcs').update({ status: 'NÃO FECHOU' }).eq('id', orc.id);
    await enviarMensagem(numero,
      `Entendemos! Se precisar de outro profissional ou tiver outra necessidade, estamos aqui. 😊\n\n_Serviço Seguro_ 🛡️`
    );
  }
}

// ── BUSCAR ORC ATIVO ──────────────────────────────────────────
async function buscarOrcAtivo(numero) {
  const numLimpo = numero.replace(/\D/g, '');

  const { data } = await supabase
    .from('orcs')
    .select('*, prestadores(nome, telefone), usuarios(nome, endereco, telefone), servicos(titulo, categorias(nome))')
    .or(`telefone_cliente.eq.${numLimpo},telefone_cliente.eq.+55${numLimpo}`)
    .not('status', 'in', '("ENCERRADO","NÃO FECHOU","CANCELADO","CONTRATO ASSINADO")')
    .order('criado_em', { ascending: false })
    .limit(1);

  return data?.[0] || null;
}

// ── EXTRAIR DISPONIBILIDADE DO HISTÓRICO ──────────────────────
function extrairDisponibilidade(historico) {
  const textos = historico
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');

  const patterns = [
    /\b(segunda|terça|quarta|quinta|sexta|sábado|domingo)\b/gi,
    /\b(manhã|tarde|noite|madrugada)\b/gi,
    /\b(hoje|amanhã|essa semana|próxima semana)\b/gi,
  ];

  const encontrados = [];
  patterns.forEach(p => {
    const matches = textos.match(p);
    if (matches) encontrados.push(...matches);
  });

  return encontrados.length > 0
    ? [...new Set(encontrados)].join(', ')
    : textos.slice(-200);
}

// ── ENVIAR MENSAGEM MANUAL ────────────────────────────────────
// POST /api/whatsapp/enviar
router.post('/enviar', async (req, res) => {
  try {
    const { numero, mensagem, orc_id } = req.body;
    const resultado = await enviarMensagem(numero, mensagem);

    if (orc_id && resultado.ok) {
      await supabase.from('mensagens').insert({
        orc_id, remetente: 'sistema', conteudo: mensagem
      });
    }

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── STATUS DA INSTÂNCIA ───────────────────────────────────────
// GET /api/whatsapp/status
router.get('/status', async (req, res) => {
  const { verificarInstancia } = require('../services/whatsapp');
  const status = await verificarInstancia();
  res.json(status);
});

module.exports = router;
