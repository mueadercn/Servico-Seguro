const cron = require('node-cron');
const supabase = require('./services/supabase');
const { enviarMensagem, templates } = require('./services/whatsapp');

// ── INICIAR TODOS OS JOBS ─────────────────────────────────────
function iniciarJobs() {
  console.log('[Jobs] Iniciando jobs automáticos...');

  // Follow-up pós-visita — roda todo dia às 09:00
  cron.schedule('0 9 * * *', followUpPosVisita, { timezone: 'America/Sao_Paulo' });

  // Verificar ORCs sem resposta — roda a cada 6 horas
  cron.schedule('0 */6 * * *', verificarSemResposta);

  // Lembrete de assinatura pendente — roda todo dia às 14:00
  cron.schedule('0 14 * * *', lembreteAssinatura, { timezone: 'America/Sao_Paulo' });

  // Limpeza de sessões antigas — roda toda segunda às 02:00
  cron.schedule('0 2 * * 1', limpezaSessoes);

  console.log('[Jobs] ✅ Jobs registrados:');
  console.log('  - Follow-up pós-visita: 09:00 diário');
  console.log('  - Verificar sem resposta: a cada 6h');
  console.log('  - Lembrete assinatura: 14:00 diário');
  console.log('  - Limpeza sessões: segunda 02:00');
}

// ── JOB 1: FOLLOW-UP PÓS-VISITA ──────────────────────────────
async function followUpPosVisita() {
  console.log('[Job] Rodando follow-up pós-visita...');

  try {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().split('T')[0];

    // Buscar ORCs com visita agendada para ontem
    const { data: orcs } = await supabase
      .from('orcs')
      .select('*, prestadores(nome, telefone), usuarios(nome)')
      .eq('status', 'VISITA AGENDADA')
      .gte('data_visita', ontemStr + 'T00:00:00')
      .lt('data_visita', ontemStr + 'T23:59:59');

    if (!orcs?.length) {
      console.log('[Job] Nenhum ORC para follow-up hoje.');
      return;
    }

    for (const orc of orcs) {
      console.log(`[Job] Follow-up: ${orc.codigo}`);

      // Atualizar status
      await supabase.from('orcs').update({
        status: 'VISITA REALIZADA'
      }).eq('id', orc.id);

      // Mensagem para o cliente
      if (orc.telefone_cliente) {
        await enviarMensagem(
          orc.telefone_cliente,
          templates.followUpCliente(orc.nome_cliente, orc.servicos?.titulo || 'serviço')
        );
        await delay(1000);
      }

      // Mensagem para o prestador
      if (orc.prestadores?.telefone) {
        await enviarMensagem(
          orc.prestadores.telefone,
          templates.followUpPrestador(orc.prestadores.nome, orc.nome_cliente)
        );
        await delay(1000);
      }

      // Log
      await supabase.from('custodia_log').insert({
        orc_id: orc.id,
        acao: 'FOLLOWUP_ENVIADO',
        agente: 'sistema',
        dados: { tipo: 'pos_visita', timestamp: new Date().toISOString() }
      });
    }

    console.log(`[Job] Follow-up concluído: ${orcs.length} ORCs processados`);
  } catch (err) {
    console.error('[Job] Erro no follow-up:', err.message);
  }
}

// ── JOB 2: VERIFICAR SEM RESPOSTA ────────────────────────────
async function verificarSemResposta() {
  console.log('[Job] Verificando ORCs sem resposta...');

  try {
    const limite = new Date();
    limite.setHours(limite.getHours() - 48); // 48 horas sem resposta

    // ORCs em anamnese há mais de 48h
    const { data: orcsSemResposta } = await supabase
      .from('orcs')
      .select('*')
      .in('status', ['EM ANAMNESE', 'PRESTADOR NOTIFICADO'])
      .lt('atualizado_em', limite.toISOString());

    for (const orc of (orcsSemResposta || [])) {
      const novoStatus = orc.status === 'EM ANAMNESE'
        ? 'SEM RESPOSTA CLIENTE'
        : 'SEM RESPOSTA PRESTADOR';

      await supabase.from('orcs').update({ status: novoStatus }).eq('id', orc.id);

      // Reenviar mensagem (1 tentativa)
      if (orc.status === 'EM ANAMNESE' && orc.telefone_cliente) {
        await enviarMensagem(orc.telefone_cliente,
          `Olá! Percebemos que você iniciou uma solicitação mas não concluiu. ` +
          `Ainda precisa do serviço? Responda aqui para continuarmos! 😊`
        );
      }

      console.log(`[Job] ORC ${orc.codigo} marcado como ${novoStatus}`);
    }

    // Follow-up de ORCs em AGUARDANDO DECISÃO há mais de 24h
    const limite24h = new Date();
    limite24h.setHours(limite24h.getHours() - 24);

    const { data: orcsAguardando } = await supabase
      .from('orcs')
      .select('*, prestadores(nome, telefone)')
      .eq('status', 'AGUARDANDO DECISÃO')
      .lt('atualizado_em', limite24h.toISOString());

    for (const orc of (orcsAguardando || [])) {
      if (orc.telefone_cliente) {
        await enviarMensagem(orc.telefone_cliente,
          `${orc.nome_cliente}, ainda está pensando na proposta do profissional? ` +
          `Se precisar de mais informações, estamos aqui! 😊`
        );
        await delay(1500);
      }
    }

  } catch (err) {
    console.error('[Job] Erro na verificação sem resposta:', err.message);
  }
}

// ── JOB 3: LEMBRETE DE ASSINATURA ────────────────────────────
async function lembreteAssinatura() {
  console.log('[Job] Verificando assinaturas pendentes...');

  try {
    const limite = new Date();
    limite.setHours(limite.getHours() - 24);

    const { data: contratos } = await supabase
      .from('contratos')
      .select('*, orcs(codigo, nome_cliente, telefone_cliente, prestadores(nome, telefone))')
      .eq('assinado_cliente', false)
      .lt('criado_em', limite.toISOString());

    for (const contrato of (contratos || [])) {
      const orc = contrato.orcs;
      if (!orc) continue;

      const link = `${process.env.FRONTEND_URL}/contrato.html?orc=${orc.id}&codigo=${orc.codigo}`;

      if (!contrato.assinado_cliente && orc.telefone_cliente) {
        await enviarMensagem(orc.telefone_cliente,
          `${orc.nome_cliente}, seu contrato ainda está aguardando sua assinatura! ` +
          `Acesse o link para assinar:\n\n🔗 ${link}\n\n` +
          `_Serviço Seguro_ 🛡️`
        );
        await delay(1500);
      }

      if (!contrato.assinado_prestador && orc.prestadores?.telefone) {
        await enviarMensagem(orc.prestadores.telefone,
          `${orc.prestadores.nome}, o contrato do ORC ${orc.codigo} ` +
          `ainda aguarda sua assinatura:\n\n🔗 ${link}\n\n` +
          `_Serviço Seguro_ 🛡️`
        );
        await delay(1500);
      }

      console.log(`[Job] Lembrete enviado: ${orc.codigo}`);
    }

  } catch (err) {
    console.error('[Job] Erro no lembrete de assinatura:', err.message);
  }
}

// ── JOB 4: LIMPEZA ───────────────────────────────────────────
async function limpezaSessoes() {
  console.log('[Job] Limpeza de dados antigos...');
  try {
    const limite = new Date();
    limite.setDate(limite.getDate() - 90); // 90 dias

    // Arquivar ORCs antigos encerrados
    const { count } = await supabase
      .from('orcs')
      .select('id', { count: 'exact' })
      .in('status', ['ENCERRADO', 'NÃO FECHOU', 'CANCELADO'])
      .lt('criado_em', limite.toISOString());

    console.log(`[Job] ${count || 0} ORCs antigos encontrados (não deletados, apenas log)`);
  } catch (err) {
    console.error('[Job] Erro na limpeza:', err.message);
  }
}

// ── EXECUTAR MANUALMENTE ──────────────────────────────────────
async function executarFollowUp(orcId) {
  const { data: orc } = await supabase
    .from('orcs')
    .select('*, prestadores(nome, telefone)')
    .eq('id', orcId)
    .single();

  if (!orc) return { ok: false, error: 'ORC não encontrado' };

  await supabase.from('orcs').update({ status: 'VISITA REALIZADA' }).eq('id', orcId);

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

  return { ok: true };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { iniciarJobs, executarFollowUp, followUpPosVisita };
