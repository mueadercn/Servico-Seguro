const express = require('express');
const router = express.Router();
const path = require('path');
const supabase = require(path.join(__dirname, '../services/supabase'));
const { enviarMensagem, templates } = require(path.join(__dirname, '../services/whatsapp'));
const { conduzirAnamnese, gerarResumo, interpretarResposta } = require(path.join(__dirname, '../services/ia'));
const { criarChatParaOrc } = require(path.join(__dirname, './chat'));

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

    // ── FILTROS IMPORTANTES ───────────────────────────────────
    // Ignorar mensagens de grupos
    if (remoteJid.includes('@g.us')) {
      console.log(`[WhatsApp] Ignorado — grupo: ${remoteJid}`);
      return;
    }

    // Ignorar mensagens de broadcast/status
    if (remoteJid.includes('broadcast') || remoteJid.includes('status')) {
      return;
    }

    const texto = data.message?.conversation ||
                  data.message?.extendedTextMessage?.text ||
                  data.message?.imageMessage?.caption || '';

    const temImagem = !!(data.message?.imageMessage || data.message?.documentMessage);
    const textoFinal = texto || (temImagem ? '[IMAGEM_ENVIADA]' : '');

    if (!numero || !textoFinal) return;
    
    // Se só tem imagem sem texto, processar como imagem
    const textoProcessar = textoFinal;

    console.log(`[WhatsApp] <- ${numero}: ${textoProcessar.substring(0, 80)}${temImagem ? ' [+imagem]' : ''}`);
    await processarMensagem(numero, textoProcessar, temImagem, data.message?.imageMessage?.url);

  } catch (err) {
    console.error('[WhatsApp] Erro webhook:', err.message);
  }
});

// ── PROCESSADOR CENTRAL ───────────────────────────────────────
async function processarMensagem(numero, texto, temImagem = false, imagemUrl = null) {

  // 1. Sessão de anamnese ativa? (cliente em anamnese)
  const sessao = await buscarSessao(numero);
  if (sessao) {
    console.log(`[PROC] Sessão ativa para ${numero}`);
    await handleAnamnese(sessao, numero, texto, temImagem);
    return;
  }

  // 2. Cliente tem algum ORC? (qualquer status ativo)
  const numLimpoCliente = numero.replace(/\D/g, '');
  const { data: orcsCliente } = await supabase
    .from('orcs')
    .select('id, status')
    .or(`telefone_cliente.eq.${numLimpoCliente},telefone_cliente.eq.+55${numLimpoCliente}`)
    .not('status', 'in', '("ENCERRADO","NÃO FECHOU","CANCELADO","CONTRATO ASSINADO","SERVIÇO CONCLUÍDO")')
    .limit(1);

  if (orcsCliente?.length) {
    console.log(`[PROC] Cliente tem ORCs ativos`);
    // Verificar se quer iniciar novo ORC
    const ids = extrairIdentificadores(texto);
    if (ids.temIdentificador) {
      await iniciarSessao(numero, texto, ids);
      return;
    }
    // Mostrar todos os ORCs do cliente
    await mostrarOrcsCliente(numero, numero);
    return;
  }

  // 3. É prestador? Busca pelo telefone na tabela prestadores
  const numLimpo = numero.replace(/\D/g, '');
  const { data: prestadorEncontrado } = await supabase
    .from('prestadores')
    .select('id, nome, telefone')
    .or(`telefone.eq.${numLimpo},telefone.eq.+55${numLimpo},telefone.eq.55${numLimpo}`)
    .limit(1);

  if (prestadorEncontrado?.length) {
    const prestador = prestadorEncontrado[0];
    console.log(`[PROC] Prestador identificado: ${prestador.nome}`);

    // Verificar se quer ver lista (palavras-chave)
    const querLista = /lista|meus pedidos|pedidos|orçamentos|status|quantos/i.test(texto);

    // Buscar ORC específico que está respondendo
    const orcPrestador = await buscarOrcPorPrestador(numero);

    if (orcPrestador && !querLista) {
      console.log(`[PROC] Prestador respondendo ORC específico: ${orcPrestador.codigo}`);
      await handleOrcAtivo(orcPrestador, numero, texto);
    } else {
      // Mostrar lista de todos os ORCs abertos
      console.log(`[PROC] Enviando lista de ORCs para prestador: ${prestador.nome}`);
      await enviarListaOrcsPrestador(numero, prestador.id, prestador.nome);
    }
    return;
  }

  // 4. Nova mensagem — verificar identificador de serviço
  const ids = extrairIdentificadores(texto);

  if (ids.temIdentificador) {
    console.log(`[PROC] Novo lead com serviço identificado: ${ids.servico_id}`);
    await iniciarSessao(numero, texto, ids);
    return;
  }

  // 4. Mensagem sem contexto — só responde se for primeira mensagem (não spam)
  // Verifica se já respondemos recentemente para esse número
  const { data: respostaRecente } = await supabase
    .from('mensagens_orientacao')
    .select('id, criado_em')
    .eq('telefone', numero)
    .gte('criado_em', new Date(Date.now() - 24*60*60*1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (!respostaRecente) {
    await enviarMensagem(numero,
      `Olá! 😊 Sou a assistente do *Serviço Seguro*.\n\n` +
      `Para solicitar um orçamento, acesse nosso site, encontre o serviço que precisa e clique em *"Via WhatsApp"*.\n\n` +
      `🌐 classy-cucurucho-4e3455.netlify.app\n\n` +
      `_Serviço Seguro — Serviços com Segurança_ 🛡️`
    );
    // Registrar que já orientamos esse número
    await supabase.from('mensagens_orientacao').upsert({
      telefone: numero,
      criado_em: new Date().toISOString()
    }, { onConflict: 'telefone' });
  } else {
    console.log(`[WhatsApp] Ignorado — já orientamos ${numero} nas últimas 24h`);
  }
}

// ── INICIAR SESSÃO DE ANAMNESE ────────────────────────────────
async function iniciarSessao(numero, texto, ids) {
  let servicoNome = 'Serviço solicitado';
  let prestadorId = ids.prestador_id;
  let categoriaNome = ids.categoria || '';

  // Buscar dados do serviço — validar se existe
  if (ids.servico_id) {
    const { data: svc } = await supabase
      .from('servicos')
      .select('titulo, prestador_id, ativo, categorias(nome)')
      .eq('id', ids.servico_id).limit(1);

    if (!svc?.[0] || !svc[0].ativo) {
      // Serviço não encontrado ou inativo — redirecionar para o site
      console.log(`[SESSÃO] Serviço não encontrado: ${ids.servico_id}`);
      await enviarMensagem(numero,
        `Hmm, não encontrei esse serviço. 🔍\n\n` +
        `Acesse nosso site para encontrar o serviço correto e solicitar o orçamento:\n\n` +
        `🌐 classy-cucurucho-4e3455.netlify.app`
      );
      return;
    }

    servicoNome = svc[0].titulo;
    prestadorId = prestadorId || svc[0].prestador_id;
    categoriaNome = svc[0].categorias?.nome || categoriaNome;
  } else if (!ids.prestador_id) {
    // Sem serviço e sem prestador — redirecionar
    await enviarMensagem(numero,
      `Para solicitar um orçamento, acesse nosso site e clique em *"Via WhatsApp"* no serviço desejado:\n\n` +
      `🌐 classy-cucurucho-4e3455.netlify.app`
    );
    return;
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
async function handleAnamnese(sessao, numero, texto, temImagem = false) {
  const historico = sessao.historico || [];

  // Tratar imagem — adiciona ao histórico e confirma recebimento
  if (temImagem) {
    console.log(`[ANAMNESE] Imagem recebida de ${numero}`);
    
    // Salvar referência da imagem no histórico
    const msgImagem = texto && texto !== '[IMAGEM_ENVIADA]'
      ? `[Foto enviada] Legenda: ${texto}`
      : '[Foto enviada pelo cliente]';
    
    const novoHistoricoImg = [...historico, { role: 'user', content: msgImagem }];
    
    // Confirmar recebimento e continuar anamnese
    const confirmacao = 'Foto recebida! 📷 Obrigada, isso vai ajudar no orçamento.';
    
    // Continuar com a próxima pergunta da IA
    const resultado = await conduzirAnamnese(
      [...novoHistoricoImg, { role: 'user', content: 'usuário enviou uma foto' }],
      sessao.categoria_nome || '',
      sessao.servico_nome || ''
    );
    
    await enviarMensagem(numero, confirmacao);
    
    if (resultado.ok && resultado.resposta) {
      setTimeout(async () => {
        await enviarMensagem(numero, resultado.resposta);
      }, 1500);
    }
    
    await atualizarHistorico(numero, [
      ...novoHistoricoImg,
      { role: 'assistant', content: confirmacao }
    ]);
    return;
  }

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
    console.log(`[ANAMNESE] ✅ CONCLUÍDA para ${numero}. Histórico tinha ${novoHistorico.length} mensagens.`);
    // ── ANAMNESE CONCLUÍDA — CRIAR ORC ────────────────────────
    console.log(`[ANAMNESE] Gerando resumo e criando ORC...`);

    // Filtrar mensagem inicial com #SERVICO do histórico antes do resumo
    const historicoLimpo = novoHistorico.filter(m =>
      !m.content.includes('#SERVICO:') && !m.content.includes('Vim pelo site')
    );
    const { resumo } = await gerarResumo(historicoLimpo, sessao.servico_nome);
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

      // ── GERAR LINK DO CHAT ───────────────────────────────────
      let linkChatCliente = null;
      let linkChatPrestador = null;
      try {
        const chatCriado = await criarChatParaOrc(novoOrc.id);
        const frontendUrl = process.env.FRONTEND_URL || 'https://classy-cucurucho-4e3455.netlify.app';
        const base = `${frontendUrl}/chat/${chatCriado.link_token}`;
        linkChatCliente = `${base}?papel=cliente`;
        linkChatPrestador = `${base}?papel=prestador`;
        console.log(`[ORC] Links do chat gerados`);
      } catch (chatErr) {
        console.error('[ORC] Erro ao criar chat:', chatErr.message);
      }

      // ── ENVIAR LINK AO CLIENTE ───────────────────────────────
      if (linkChatCliente) {
        await enviarMensagem(numero,
          `🔗 *Acesse o chat para negociar diretamente com o profissional:*\n\n${linkChatCliente}\n\n` +
          `_Pelo chat você pode combinar horário, enviar fotos e fechar o contrato com segurança._`
        );
      }

      // ── NOTIFICAR PRESTADOR AUTOMATICAMENTE ─────────────────
      if (sessao.prestador_id) {
        const { data: prestador } = await supabase
          .from('prestadores')
          .select('nome, telefone')
          .eq('id', sessao.prestador_id)
          .single();

        if (prestador?.telefone) {
          console.log(`[ORC] Notificando prestador ${prestador.nome} (${prestador.telefone})`);

          const dispCliente = extrairDisponibilidade(novoHistorico.filter(m => !m.content.includes('#SERVICO:') && !m.content.includes('Vim pelo site'))) || 'A combinar';
          let msgPrestador =
            `🆕 *Novo pedido de orçamento!*\n\n` +
            `📋 ${novoOrc.codigo}\n` +
            `👤 Cliente: ${sessao.nome_cliente || 'Cliente'}\n` +
            `🔧 Serviço: ${sessao.servico_nome}\n` +
            `📅 Disponibilidade: ${dispCliente}\n\n` +
            `*Resumo:*\n${resumo || 'Detalhes a confirmar'}\n\n`;

          if (linkChatPrestador) {
            msgPrestador += `💬 *Acesse o chat para responder ao cliente:*\n${linkChatPrestador}`;
          }

          const envioPrestador = await enviarMensagem(prestador.telefone, msgPrestador);

          if (envioPrestador.ok) {
            console.log(`[ORC] ✅ Prestador notificado com sucesso`);
            await supabase.from('orcs').update({ status: 'PRESTADOR NOTIFICADO' }).eq('id', novoOrc.id);
          } else {
            console.error(`[ORC] ❌ Falha ao notificar prestador: ${envioPrestador.error}`);
            const adminNum = process.env.ADMIN_WHATSAPP;
            if (adminNum) {
              await enviarMensagem(adminNum,
                `⚠️ *Falha ao notificar prestador*\n\n` +
                `ORC: ${novoOrc.codigo}\n` +
                `Prestador: ${prestador.nome}\n` +
                `Telefone: ${prestador.telefone}\n\n` +
                `Por favor, contate manualmente.`
              );
            }
          }
        } else {
          console.warn(`[ORC] Prestador sem telefone cadastrado: ${sessao.prestador_id}`);
        }
      }

      // ── NOTIFICAR ADMIN ───────────────────────────────────────
      const adminNum = process.env.ADMIN_WHATSAPP;
      if (adminNum) {
        await enviarMensagem(adminNum,
          `✅ *Nova anamnese concluída!*\n\n` +
          `📋 ORC: ${novoOrc.codigo}\n` +
          `👤 Cliente: ${sessao.nome_cliente}\n` +
          `📱 Telefone: ${numero}\n` +
          `🔧 Serviço: ${sessao.servico_nome}\n\n` +
          `*Resumo:*\n${resumo}`
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
    try {
      await atualizarHistorico(numero, historicoAtualizado);
    } catch (err) {
      console.error(`[ANAMNESE] ERRO ao salvar histórico para ${numero}:`, err.message);
      await enviarMensagem(numero, `Desculpe, tive um problema técnico. Pode repetir sua resposta?`);
    }
  }
}

// ── MOSTRAR ORCs DO CLIENTE ──────────────────────────────────
async function mostrarOrcsCliente(numero, telefone) {
  const tel = telefone || numero;
  const numLimpo = tel.replace(/\D/g, '');

  const { data: orcs } = await supabase
    .from('orcs')
    .select('codigo, status, servicos(titulo)')
    .or(`telefone_cliente.eq.${numLimpo},telefone_cliente.eq.+55${numLimpo}`)
    .not('status', 'in', '("ENCERRADO","NÃO FECHOU","CANCELADO","CONTRATO ASSINADO")')
    .order('criado_em', { ascending: false })
    .limit(5);

  if (!orcs?.length) {
    await enviarMensagem(numero,
      `Você não tem pedidos em andamento.\n\n` +
      `Para solicitar um orçamento, acesse nosso site! 😊\n` +
      `🌐 classy-cucurucho-4e3455.netlify.app`
    );
    return;
  }

  const statusLabel = {
    'NOVO': '🆕 Novo',
    'EM ANAMNESE': '💬 Em atendimento',
    'ANAMNESE CONCLUÍDA': '✅ Aguardando profissional',
    'PRESTADOR NOTIFICADO': '📨 Aguardando profissional',
    'AGUARDANDO PRESTADOR': '📨 Aguardando profissional',
    'VISITA AGENDADA': '📅 Visita agendada',
    'VISITA REALIZADA': '🔄 Pós-visita',
    'FECHADO': '🤝 Fechado',
    'CONTRATO GERADO': '📄 Contrato gerado',
    'AGUARDANDO ASSINATURA': '✍️ Aguardando assinatura',
    'SEM RESPOSTA PRESTADOR': '📨 Aguardando profissional',
    'DIVERGÊNCIA DE VALOR': '⚠️ Verificando valores',
  };

  // ORCs que o cliente pode cancelar (prestador ainda não respondeu)
  const cancelaveis = ['ANAMNESE CONCLUÍDA', 'PRESTADOR NOTIFICADO', 'AGUARDANDO PRESTADOR', 'SEM RESPOSTA PRESTADOR'];

  const lista = orcs.map((o, i) => {
    const podeCancelar = cancelaveis.includes(o.status);
    return `${i + 1}️⃣ *${o.codigo}*\n` +
    `🔧 ${o.servicos?.titulo || 'Serviço'}\n` +
    `${statusLabel[o.status] || o.status}` +
    (podeCancelar ? `\n   _Para cancelar: responda "Cancelar ${i + 1}"_` : '');
  }).join('\n\n');

  const temCancelavel = orcs.some(o => cancelaveis.includes(o.status));

  await enviarMensagem(numero,
    `Você tem *${orcs.length}* pedido${orcs.length > 1 ? 's' : ''} em andamento:\n\n` +
    `${lista}\n\n` +
    (temCancelavel ? `⚠️ _Cancelamentos só são possíveis enquanto o profissional não tiver respondido._\n\n` : '') +
    `_Qualquer dúvida, estamos aqui!_ 😊`
  );
}

// ── HANDLE ORC ATIVO (pós-anamnese) ──────────────────────────
async function handleOrcAtivo(orc, numero, texto) {
  const status = orc.status;
  const ehCliente = numero === orc.telefone_cliente?.replace(/\D/g, '') ||
                    numero === ('55' + orc.telefone_cliente)?.replace(/\D/g, '');

  // ── CLIENTE QUER CANCELAR ────────────────────────────────
  const cancelaveis = ['ANAMNESE CONCLUÍDA', 'PRESTADOR NOTIFICADO', 'AGUARDANDO PRESTADOR', 'SEM RESPOSTA PRESTADOR'];
  const cancelMatch = texto.match(/cancelar\s+(\d+|ORC-\d+-\d+)/i);

  if (ehCliente && cancelMatch) {
    if (!cancelaveis.includes(status)) {
      await enviarMensagem(numero,
        `⚠️ O ORC *${orc.codigo}* não pode ser cancelado pois o profissional já respondeu.
` +
        `Ele ficará no seu histórico. Qualquer dúvida, estamos aqui! 😊`
      );
      return;
    }
    // Cancelar o ORC
    await supabase.from('orcs').update({ status: 'CANCELADO' }).eq('id', orc.id);
    await enviarMensagem(numero,
      `✅ *${orc.codigo}* cancelado com sucesso.

` +
      `Se precisar de um novo orçamento, acesse nosso site! 😊`
    );
    console.log(`[PROC] ORC cancelado pelo cliente: ${orc.codigo}`);
    return;
  }

  // ── CLIENTE manda msg enquanto aguarda prestador ───────────
  if (ehCliente && ['ANAMNESE CONCLUÍDA', 'PRESTADOR NOTIFICADO', 'AGUARDANDO PRESTADOR', 'SEM RESPOSTA PRESTADOR'].includes(status)) {
    await mostrarOrcsCliente(numero, orc.telefone_cliente);
    return;
  }

  // ── PRESTADOR respondendo ──────────────────────────────────
  if (!ehCliente && status === 'AGUARDANDO PRESTADOR' && orc.disponibilidade_prestador) {
    await handleConfirmacaoPrestador(orc, numero, texto);
    return;
  }

  if (!ehCliente && status === 'PRESTADOR NOTIFICADO') {
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

// ── CONFIRMAÇÃO DO HORÁRIO PELO PRESTADOR ────────────────────
async function handleConfirmacaoPrestador(orc, numero, texto) {
  const interp = await interpretarResposta(texto, 'Prestador confirmando ou recusando o horário proposto');

  if (interp.intencao === 'aceitar') {
    const horario = orc.disponibilidade_prestador;
    
    await supabase.from('orcs').update({ status: 'VISITA AGENDADA' }).eq('id', orc.id);

    await enviarMensagem(numero,
      `✅ Confirmado! *${horario}*\n` +
      `📱 Cliente: ${orc.telefone_cliente}`
    );

    if (orc.telefone_cliente) {
      await enviarMensagem(orc.telefone_cliente,
        `✅ Visita confirmada!\n\n` +
        `👷 *${orc.prestadores?.nome}*\n` +
        `📅 *${horario}*\n\n` +
        `_Serviço Seguro_ 🛡️`
      );
    }
    return;
  }

  // Recusou — volta para negociar
  await enviarMensagem(numero,
    `Qual seria o melhor horário então?\n` +
    `📅 Ex: *Terça às 10h*`
  );
  await supabase.from('orcs').update({
    status: 'PRESTADOR NOTIFICADO',
    disponibilidade_prestador: null
  }).eq('id', orc.id);
}

// ── LISTAR ORCs ABERTOS PARA O PRESTADOR ────────────────────
async function listarOrcsPrestador(prestadorId) {
  const { data } = await supabase
    .from('orcs')
    .select('codigo, status, nome_cliente, disponibilidade_cliente, servicos(titulo)')
    .eq('prestador_id', prestadorId)
    .in('status', ['PRESTADOR NOTIFICADO', 'AGUARDANDO PRESTADOR', 'ANAMNESE CONCLUÍDA'])
    .order('criado_em', { ascending: false });
  return data || [];
}

async function enviarListaOrcsPrestador(numero, prestadorId, nomePrestador) {
  const orcs = await listarOrcsPrestador(prestadorId);

  if (!orcs.length) {
    await enviarMensagem(numero,
      `👷 ${nomePrestador}, você não tem pedidos pendentes no momento. ✅`
    );
    return;
  }

  const lista = orcs.map((o, i) =>
    `${i + 1}️⃣ *${o.codigo}* — ${o.servicos?.titulo || 'Serviço'}
` +
    `   👤 ${o.nome_cliente}
` +
    `   📅 Disponível: ${o.disponibilidade_cliente || 'A combinar'}`
  ).join('\n\n');

  const cancelarOpcoes = orcs.map((o, i) => `"Cancelar ${i + 1}" ou "Cancelar ${o.codigo}"`).join(', ');

  await enviarMensagem(numero,
    `👷 Olá, *${nomePrestador}*! Você tem *${orcs.length}* pedido${orcs.length > 1 ? 's' : ''} aguardando:

` +
    `${lista}

` +
    `Responda com o número do pedido e seu horário.
` +
    `Ex: *"1 - terça às 14h"* ou *"${orcs[0]?.codigo} - quarta às 10h"*

` +
    `Sem disponibilidade? Responda *"Cancelar 1"* ou *"Cancelar ${orcs[0]?.codigo}"*`
  );
}

// ── RESPOSTA DO PRESTADOR ─────────────────────────────────────
async function handleRespostaPrestador(orc, numero, texto) {
  console.log(`[PRESTADOR] Resposta: ${texto.substring(0, 80)}`);

  // ── VERIFICAR SE HÁ MÚLTIPLOS ORCs ───────────────────────
  const todosOrcs = await listarOrcsPrestador(orc.prestador_id);
  const temMultiplos = todosOrcs.length > 1;

  // ── VERIFICAR CANCELAMENTO ────────────────────────────────
  const cancelMatch = texto.match(/cancelar\s+(\d+|ORC-\d+-\d+)/i);
  if (cancelMatch) {
    const ref = cancelMatch[1];
    let orcAlvo = orc;

    // Identificar qual ORC cancelar
    if (ref.match(/^\d+$/)) {
      const idx = parseInt(ref) - 1;
      if (todosOrcs[idx]) {
        const { data } = await supabase.from('orcs').select('*').eq('id', todosOrcs[idx].id || '').single();
        if (data) orcAlvo = data;
      }
    } else {
      const { data } = await supabase.from('orcs').select('*').eq('codigo', ref.toUpperCase()).single();
      if (data) orcAlvo = data;
    }

    await supabase.from('orcs').update({ status: 'SEM RESPOSTA PRESTADOR' }).eq('id', orcAlvo.id);
    console.log(`[PRESTADOR] ORC cancelado: ${orcAlvo.codigo}`);

    await enviarMensagem(numero, `✅ *${orcAlvo.codigo}* cancelado. O cliente será notificado.`);

    // Notificar cliente
    if (orcAlvo.telefone_cliente) {
      await enviarMensagem(orcAlvo.telefone_cliente,
        `${orcAlvo.nome_cliente}, o profissional não tem disponibilidade no momento.
` +
        `Nossa equipe está buscando outro profissional. Em breve retornamos! 😊`
      );
    }

    // Se tem mais ORCs, mostrar lista atualizada
    const orcRestantes = await listarOrcsPrestador(orc.prestador_id);
    if (orcRestantes.length > 0) {
      setTimeout(async () => {
        await enviarListaOrcsPrestador(numero, orc.prestador_id, orc.prestadores?.nome);
      }, 1500);
    }
    return;
  }

  // ── SE TEM MÚLTIPLOS ORCs, identificar qual ───────────────
  let orcAlvo = orc;
  if (temMultiplos) {
    // Tentar identificar por número (1, 2, 3) ou código ORC
    const numMatch = texto.match(/^(\d+)\s*[-–—]/);
    const codMatch = texto.match(/ORC-\d+-\d+/i);

    if (numMatch) {
      const idx = parseInt(numMatch[1]) - 1;
      if (todosOrcs[idx]) {
        const { data } = await supabase.from('orcs')
          .select('*, prestadores(nome, telefone)')
          .eq('codigo', todosOrcs[idx].codigo).single();
        if (data) orcAlvo = data;
      }
    } else if (codMatch) {
      const { data } = await supabase.from('orcs')
        .select('*, prestadores(nome, telefone)')
        .eq('codigo', codMatch[0].toUpperCase()).single();
      if (data) orcAlvo = data;
    } else {
      // Não identificou qual ORC — mostrar lista
      await enviarListaOrcsPrestador(numero, orc.prestador_id, orc.prestadores?.nome);
      return;
    }
  }

  const interp = await interpretarResposta(texto.replace(/^\d+\s*[-–—]\s*/, ''),
    `Prestador informando horário disponível para visita/orçamento. ` +
    `Extraia DIA + HORÁRIO EXATO. Retorne intencao: "outro" se não houver horário.`
  );

  console.log(`[PRESTADOR] ORC: ${orcAlvo.codigo} | Intenção: ${interp.intencao} | Horário: ${interp.horario}`);

  // MENSAGEM ALEATÓRIA — mostrar lista de ORCs
  if (interp.intencao === 'outro' || (interp.certeza || 0) < 30) {
    console.log('[PRESTADOR] Sem horário identificado — mostrando lista');
    await enviarListaOrcsPrestador(numero, orc.prestador_id, orc.prestadores?.nome);
    return;
  }

  // Usar orcAlvo daqui pra frente
  orc = orcAlvo;

  // RECUSOU
  if (interp.intencao === 'recusar') {
    const tentativas = (orc.ping_pong_tentativas || 0) + 1;
    await supabase.from('orcs').update({ ping_pong_tentativas: tentativas }).eq('id', orc.id);

    if (tentativas >= 3) {
      await supabase.from('orcs').update({ status: 'SEM RESPOSTA PRESTADOR' }).eq('id', orc.id);
      if (orc.telefone_cliente) {
        await enviarMensagem(orc.telefone_cliente,
          `${orc.nome_cliente}, o profissional não tem disponibilidade no momento.\n` +
          `Nossa equipe está buscando outro. Em breve retornamos! 😊`
        );
      }
      const adminNum = process.env.ADMIN_WHATSAPP;
      if (adminNum) {
        await enviarMensagem(adminNum,
          `⚠️ Prestador sem disponibilidade\nORC: ${orc.codigo}\nPrestador: ${orc.prestadores?.nome}`
        );
      }
    } else {
      await enviarMensagem(numero,
        `Entendido! Tem outro horário?\n` +
        `📅 Cliente disponível: *${orc.disponibilidade_cliente || 'A combinar'}*`
      );
    }
    return;
  }

  // INFORMOU HORÁRIO (aceitar ou propor)
  const horario = interp.horario;
  if (horario && (interp.intencao === 'aceitar' || interp.intencao === 'propor_horario')) {
    await enviarMensagem(numero,
      `Você confirma o agendamento para orçamento:\n\n` +
      `📅 *${horario}*\n` +
      `👤 Cliente: ${orc.nome_cliente}\n\n` +
      `1. ✅ Confirmar\n` +
      `2. ❌ Outro horário`
    );
    await supabase.from('orcs').update({
      disponibilidade_prestador: horario,
      status: 'AGUARDANDO PRESTADOR'
    }).eq('id', orc.id);
    return;
  }

  // ACEITOU SEM HORÁRIO
  if (interp.intencao === 'aceitar') {
    await enviarMensagem(numero, `Qual dia e horário você tem disponível?`);
    return;
  }

  // AMBÍGUO — ignorar
  console.log('[PRESTADOR] Ambíguo — ignorado');
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
async function buscarOrcPorPrestador(numero) {
  const numLimpo = numero.replace(/\D/g, '');
  
  // Buscar prestador pelo telefone
  const { data: prestadores } = await supabase
    .from('prestadores')
    .select('id')
    .or(`telefone.eq.${numLimpo},telefone.eq.+55${numLimpo},telefone.eq.55${numLimpo}`)
    .limit(1);

  if (!prestadores?.length) return null;

  const prestadorId = prestadores[0].id;

  // Buscar ORC ativo para esse prestador
  const { data } = await supabase
    .from('orcs')
    .select('*, prestadores(nome, telefone), usuarios(nome, endereco, telefone), servicos(titulo, categorias(nome))')
    .eq('prestador_id', prestadorId)
    .in('status', ['PRESTADOR NOTIFICADO', 'AGUARDANDO PRESTADOR', 'VISITA AGENDADA', 'VISITA REALIZADA', 'AGUARDANDO DECISÃO'])
    .order('criado_em', { ascending: false })
    .limit(1);

  return data?.[0] || null;
}

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
  const { data, error } = await supabase
    .from('sessoes_whatsapp')
    .select('*')
    .eq('telefone', numero)
    .limit(1);
  if (error) console.error('[SESSAO] Erro ao buscar sessão:', error.message);
  console.log(`[SESSAO] buscarSessao(${numero}): ${data?.[0] ? 'ENCONTRADA' : 'NÃO ENCONTRADA'}`);
  return data?.[0] || null;
}

async function atualizarHistorico(numero, historico, role, content) {
  let hist = historico;
  if (role && content) {
    hist = [...historico, { role, content }];
  }
  const { error } = await supabase.from('sessoes_whatsapp')
    .update({ historico: hist, atualizado_em: new Date().toISOString() })
    .eq('telefone', numero);
  if (error) throw new Error(`Supabase atualizarHistorico: ${error.message}`);
  console.log(`[SESSAO] Histórico atualizado (${hist.length} msgs)`);
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
  // Filtrar mensagens do cliente, ignorando a primeira (com #SERVICO)
  const mensagensCliente = historico
    .filter(m => m.role === 'user')
    .filter(m => !m.content.includes('#SERVICO:') && !m.content.includes('Vim pelo site'))
    .map(m => m.content)
    .join(' ');

  if (!mensagensCliente.trim()) return 'A combinar';

  const turnos = [];
  const dias = [];

  // Extrair dias da semana
  const diasMatch = mensagensCliente.match(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)\b/gi);
  if (diasMatch) dias.push(...[...new Set(diasMatch.map(d => d.toLowerCase()))]);

  // Extrair turnos
  const turnosMatch = mensagensCliente.match(/\b(manhã|manha|tarde|noite)\b/gi);
  if (turnosMatch) turnos.push(...[...new Set(turnosMatch.map(t => t.toLowerCase()))]);

  // Extrair referências de tempo
  const tempoMatch = mensagensCliente.match(/\b(hoje|amanhã|amanha|essa semana|próxima semana|proxima semana|qualquer dia|qualquer hora)\b/gi);
  if (tempoMatch) dias.push(...[...new Set(tempoMatch.map(t => t.toLowerCase()))]);

  // Montar resultado legível
  if (dias.length > 0 && turnos.length > 0) {
    // Combinar dias com turnos
    const combinacoes = [];
    dias.forEach(d => turnos.forEach(t => combinacoes.push(`${d} — ${t}`)));
    return combinacoes.join(', ');
  }
  if (dias.length > 0) return dias.join(', ');
  if (turnos.length > 0) return turnos.join(', ');

  // Fallback — pegar só as últimas mensagens relevantes (sem lixo)
  const ultimas = historico
    .filter(m => m.role === 'user')
    .filter(m => !m.content.includes('#SERVICO:') && !m.content.includes('Vim pelo site'))
    .slice(-3)
    .map(m => m.content.substring(0, 100))
    .join(', ');

  return ultimas || 'A combinar';
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
