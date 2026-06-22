const cron = require('node-cron');
const path = require('path');
const supabase = require(path.join(__dirname, '../services/supabase'));
const { enviarMensagem, templates } = require(path.join(__dirname, '../services/whatsapp'));

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://venerable-kitten-a7b2cd.netlify.app';

// ── CONFIGURAÇÕES DO FOLLOW-UP (editáveis via /api/config, tabela `configuracoes`) ──
// Cada uma tem um valor padrão caso ainda não exista na tabela (primeira vez rodando).
const CONFIG_DEFAULTS = {
  followup_chat_nunca_iniciado_horas: 6,    // chat criado e ninguém mandou 1ª mensagem
  followup_chat_sem_resposta_horas: 6,      // alguém respondeu, outro lado não respondeu de volta
  followup_chat_intervalo_lembrete_horas: 24, // intervalo mínimo entre lembretes do mesmo chat
  followup_contrato_finalizado_tolerancia_horas: 2,  // tolerância antes de alertar "finalizado sem contrato"
  followup_assinatura_horas: 24,            // tempo até lembrar de assinatura pendente
};

async function getConfig(chave) {
  try {
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .maybeSingle();
    if (data?.valor !== undefined && data?.valor !== null && data?.valor !== '') {
      const num = Number(data.valor);
      return Number.isFinite(num) ? num : CONFIG_DEFAULTS[chave];
    }
  } catch (err) {
    console.error(`[Config] Erro lendo ${chave}:`, err.message);
  }
  return CONFIG_DEFAULTS[chave];
}

// ── INICIAR TODOS OS JOBS ─────────────────────────────────────
function iniciarJobs() {
  console.log('[Jobs] Iniciando jobs automáticos...');

  // Follow-up pós-visita — todo dia às 09:00
  cron.schedule('0 9 * * *', followUpPosVisita, { timezone: 'America/Sao_Paulo' });

  // Follow-up de chats (mensagem sem resposta / chat nunca iniciado) — a cada 4h
  cron.schedule('0 */4 * * *', followUpChats);

  // Follow-up de contratos (finalizado sem contrato / contrato sem assinatura) — todo dia às 14:00
  cron.schedule('0 14 * * *', followUpContratos, { timezone: 'America/Sao_Paulo' });

  // Limpeza de sessões de anamnese abandonadas — a cada 6h
  cron.schedule('0 */6 * * *', limpezaSessoes);

  // Follow-up de comissões pendentes — todo dia às 10:00
  cron.schedule('0 10 * * *', followUpComissoes, { timezone: 'America/Sao_Paulo' });

  console.log('[Jobs] ✅ 5 jobs registrados');
}

// ── JOB 1: FOLLOW-UP PÓS-VISITA (sem alteração) ──────────────
async function followUpPosVisita() {
  console.log('[Job] Rodando follow-up pós-visita...');
  try {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().split('T')[0];

    const { data: orcs } = await supabase
      .from('orcs')
      .select('*, prestadores(nome, telefone)')
      .eq('status', 'VISITA AGENDADA')
      .gte('data_visita', ontemStr + 'T00:00:00')
      .lt('data_visita', ontemStr + 'T23:59:59');

    for (const orc of (orcs || [])) {
      await supabase.from('orcs').update({ status: 'VISITA REALIZADA' }).eq('id', orc.id);

      if (orc.telefone_cliente) {
        await enviarMensagem(orc.telefone_cliente,
          templates.followUpCliente(orc.nome_cliente, 'serviço solicitado')
        );
      }
      if (orc.prestadores?.telefone) {
        await enviarMensagem(orc.prestadores.telefone,
          templates.followUpPrestador(orc.prestadores.nome, orc.nome_cliente)
        );
      }
    }
    console.log(`[Job] Follow-up: ${(orcs||[]).length} ORCs processados`);
  } catch (err) {
    console.error('[Job] Erro follow-up:', err.message);
  }
}

// ── JOB 2: FOLLOW-UP DE CHATS ─────────────────────────────────
// Cobre 2 situações, por chat ainda não finalizado:
//  a) Chat criado, mas ninguém nunca mandou mensagem (link parado)
//  b) Alguém mandou mensagem e a outra parte não respondeu
// Máximo 1 lembrete por chat a cada `followup_chat_intervalo_lembrete_horas`.
async function followUpChats() {
  console.log('[Job] Follow-up de chats...');
  try {
    const agora = new Date();
    const nuncaIniciadoHoras = await getConfig('followup_chat_nunca_iniciado_horas');
    const semRespostaHoras = await getConfig('followup_chat_sem_resposta_horas');
    const intervaloLembreteHoras = await getConfig('followup_chat_intervalo_lembrete_horas');

    const { data: chats } = await supabase
      .from('chat_negociacao')
      .select(`
        id, link_token, criado_em, ultimo_lembrete_em,
        orcs ( codigo, nome_cliente, telefone_cliente, prestadores ( nome, telefone ) )
      `)
      .neq('status', 'finalizado');

    for (const chat of (chats || [])) {
      const orc = chat.orcs;
      if (!orc) continue;

      // Já mandamos lembrete recentemente? Pula esse chat por enquanto.
      if (chat.ultimo_lembrete_em) {
        const horasDesdeLembrete = (agora - new Date(chat.ultimo_lembrete_em)) / 3600000;
        if (horasDesdeLembrete < intervaloLembreteHoras) continue;
      }

      const { data: mensagens } = await supabase
        .from('chat_mensagens')
        .select('remetente, criado_em')
        .eq('chat_id', chat.id)
        .order('criado_em', { ascending: false })
        .limit(1);

      const linkBase = `${FRONTEND_URL}/chat/${chat.link_token}`;

      // (a) Chat nunca iniciado
      if (!mensagens?.length) {
        const horasDesdeCriacao = (agora - new Date(chat.criado_em)) / 3600000;
        if (horasDesdeCriacao < nuncaIniciadoHoras) continue;

        if (orc.telefone_cliente) {
          await enviarMensagem(orc.telefone_cliente,
            `💬 ${orc.nome_cliente || 'Olá'}! Seu chat com o profissional do *${orc.codigo}* ainda está aberto.\n\n` +
            `🔗 ${linkBase}?papel=cliente`
          );
        }
        if (orc.prestadores?.telefone) {
          await enviarMensagem(orc.prestadores.telefone,
            `💬 ${orc.prestadores.nome}, você tem um chat aguardando no *${orc.codigo}*.\n\n` +
            `🔗 ${linkBase}?papel=prestador`
          );
        }

        await supabase.from('chat_negociacao')
          .update({ ultimo_lembrete_em: agora.toISOString() })
          .eq('id', chat.id);
        console.log(`[Job] Chat nunca iniciado, lembrete enviado: ${orc.codigo}`);
        continue;
      }

      // (b) Mensagem sem resposta
      const ultima = mensagens[0];
      const horasSemResposta = (agora - new Date(ultima.criado_em)) / 3600000;
      if (horasSemResposta < semRespostaHoras) continue;

      const devedor = ultima.remetente === 'cliente'
        ? { telefone: orc.prestadores?.telefone, nome: orc.prestadores?.nome, papel: 'prestador' }
        : { telefone: orc.telefone_cliente, nome: orc.nome_cliente, papel: 'cliente' };

      if (!devedor.telefone) continue;

      await enviarMensagem(devedor.telefone,
        `💬 ${devedor.nome || ''}, você tem uma mensagem esperando resposta no chat do *${orc.codigo}*.\n\n` +
        `🔗 ${linkBase}?papel=${devedor.papel}`
      );

      await supabase.from('chat_negociacao')
        .update({ ultimo_lembrete_em: agora.toISOString() })
        .eq('id', chat.id);
      console.log(`[Job] Lembrete de mensagem sem resposta (${devedor.papel}): ${orc.codigo}`);
    }
  } catch (err) {
    console.error('[Job] Erro follow-up chats:', err.message);
  }
}

// ── JOB 3: FOLLOW-UP DE CONTRATOS ────────────────────────────
// Cobre 2 situações:
//  a) Negociação finalizada no chat, mas contrato ainda não gerado → alerta o admin
//  b) Contrato gerado, falta assinatura de cliente e/ou prestador → lembra quem falta
async function followUpContratos() {
  console.log('[Job] Follow-up de contratos...');
  try {
    const agora = new Date();
    const toleranciaHoras = await getConfig('followup_contrato_finalizado_tolerancia_horas');
    const assinaturaHoras = await getConfig('followup_assinatura_horas');

    // (a) Finalizado sem contrato gerado
    const limiteFinalizado = new Date(agora.getTime() - toleranciaHoras * 3600000);
    const { data: chatsFinalizados } = await supabase
      .from('chat_negociacao')
      .select(`id, orc_id, finalizado_em, lembrete_contrato_enviado, orcs ( codigo, nome_cliente, prestadores ( nome ) )`)
      .eq('status', 'finalizado')
      .eq('lembrete_contrato_enviado', false)
      .not('finalizado_em', 'is', null)
      .lt('finalizado_em', limiteFinalizado.toISOString());

    for (const chat of (chatsFinalizados || [])) {
      const { data: contratoExistente } = await supabase
        .from('contratos')
        .select('id')
        .eq('orc_id', chat.orc_id)
        .maybeSingle();

      if (!contratoExistente) {
        const orc = chat.orcs;
        const adminNum = process.env.ADMIN_WHATSAPP;
        if (adminNum) {
          await enviarMensagem(adminNum,
            `⚠️ *Negociação finalizada sem contrato gerado*\n\n` +
            `ORC: ${orc?.codigo}\n` +
            `Cliente: ${orc?.nome_cliente}\n` +
            `Prestador: ${orc?.prestadores?.nome}\n\n` +
            `Verifique no painel — ninguém gerou o contrato após a finalização.`
          );
        }
        console.log(`[Job] Alerta de contrato pendente enviado: ${orc?.codigo}`);
      }

      // marca como tratado de qualquer forma (gerado ou alertado), pra não repetir
      await supabase.from('chat_negociacao')
        .update({ lembrete_contrato_enviado: true })
        .eq('id', chat.id);
    }

    // (b) Contrato gerado, falta assinatura (cliente e/ou prestador)
    const limiteAssinatura = new Date(agora.getTime() - assinaturaHoras * 3600000);
    const { data: contratosPendentes } = await supabase
      .from('contratos')
      .select('*, orcs(codigo, nome_cliente, telefone_cliente, prestadores(nome, telefone))')
      .or('assinado_cliente.eq.false,assinado_prestador.eq.false')
      .lt('criado_em', limiteAssinatura.toISOString());

    for (const c of (contratosPendentes || [])) {
      const orc = c.orcs;
      if (!orc) continue;
      const link = `${FRONTEND_URL}/contrato.html?orc=${orc.id}&codigo=${orc.codigo}`;

      if (!c.assinado_cliente && orc.telefone_cliente) {
        await enviarMensagem(orc.telefone_cliente,
          `${orc.nome_cliente}, seu contrato (${orc.codigo}) aguarda assinatura:\n🔗 ${link}`
        );
      }
      if (!c.assinado_prestador && orc.prestadores?.telefone) {
        await enviarMensagem(orc.prestadores.telefone,
          `${orc.prestadores.nome}, seu contrato (${orc.codigo}) aguarda assinatura:\n🔗 ${link}`
        );
      }
    }
  } catch (err) {
    console.error('[Job] Erro follow-up contratos:', err.message);
  }
}

// ── JOB 5: FOLLOW-UP DE COMISSÕES PENDENTES ──────────────────
// Envia WhatsApp ao prestador lembrando de pagar a comissão
// T+0 (na assinatura, via contratos.js), T+2 dias, T+3 dias, T+7 dias
// Para quando status_comissao = 'pago' ou 'isento'
async function followUpComissoes() {
  console.log('[Job] Follow-up de comissões...');
  try {
    const agora = new Date();

    // Buscar template configurável (ou usar padrão)
    let templateComissao = null;
    const { data: cfgTemplate } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'comissao_mensagem_template')
      .maybeSingle();
    templateComissao = cfgTemplate?.valor || null;

    // Contratos assinados com comissão pendente
    const { data: contratos } = await supabase
      .from('contratos')
      .select('*, orcs(codigo, nome_cliente, prestadores(nome, telefone))')
      .eq('assinado_cliente', true)
      .eq('assinado_prestador', true)
      .eq('status_comissao', 'pendente');

    const DIAS_LEMBRETE = [2, 3, 7]; // dias após assinatura para lembrar

    for (const c of (contratos || [])) {
      const orc = c.orcs;
      const prestador = orc?.prestadores;
      if (!prestador?.telefone) continue;

      const dataAssinatura = new Date(c.assinado_em || c.criado_em);
      const diasDesdeAssinatura = (agora - dataAssinatura) / 86400000;

      // Verifica se hoje é um dos dias-alvo de lembrete
      const ehDiaLembrete = DIAS_LEMBRETE.some(d => {
        return diasDesdeAssinatura >= d && diasDesdeAssinatura < d + 1;
      });

      if (!ehDiaLembrete) continue;

      const comissaoValor = c.comissao ? `R$ ${Number(c.comissao).toFixed(2)}` : 'o valor combinado';
      const msg = templateComissao
        ? templateComissao
            .replace('{NOME}', prestador.nome || 'Prestador')
            .replace('{VALOR}', comissaoValor)
            .replace('{ORC}', orc?.codigo || '')
        : `💰 *Comissão Serviço Seguro*\n\n` +
          `Olá, ${prestador.nome}! Lembrando que o contrato *${orc?.codigo}* foi assinado.\n\n` +
          `A comissão da plataforma é de ${comissaoValor}.\n\n` +
          `Por favor, realize o pagamento via PIX para confirmar sua parceria conosco. ` +
          `Em caso de dúvidas, entre em contato com o suporte.`;

      await enviarMensagem(prestador.telefone, msg);
      console.log(`[Job] Lembrete de comissão enviado para ${prestador.nome} (${orc?.codigo})`);
    }
  } catch (err) {
    console.error('[Job] Erro follow-up comissões:', err.message);
  }
}

// ── JOB 4: LIMPEZA DE SESSÕES DE ANAMNESE ABANDONADAS ────────
// (antes vivia dentro do antigo job "verificarSemResposta"; o job de
// limpeza semanal estava sem nenhuma lógica — agora faz isso de fato)
async function limpezaSessoes() {
  console.log('[Job] Limpeza de sessões abandonadas...');
  try {
    const limite48h = new Date(Date.now() - 48 * 3600000);
    const { data: sessoesAbandonadas } = await supabase
      .from('sessoes_whatsapp')
      .select('id, telefone')
      .lt('atualizado_em', limite48h.toISOString());

    for (const sessao of (sessoesAbandonadas || [])) {
      await supabase.from('sessoes_whatsapp').delete().eq('id', sessao.id);
      console.log(`[Job] Sessão abandonada removida: ${sessao.telefone}`);
    }
    console.log(`[Job] Limpeza: ${(sessoesAbandonadas||[]).length} sessões removidas`);
  } catch (err) {
    console.error('[Job] Erro limpeza:', err.message);
  }
}

module.exports = { iniciarJobs, followUpPosVisita, followUpChats, followUpContratos, limpezaSessoes, followUpComissoes };
