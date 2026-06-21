const cron = require('node-cron');
const path = require('path');
const supabase = require(path.join(__dirname, '../services/supabase'));
const { enviarMensagem, templates } = require(path.join(__dirname, '../services/whatsapp'));

// ── INICIAR TODOS OS JOBS ─────────────────────────────────────
function iniciarJobs() {
  console.log('[Jobs] Iniciando jobs automáticos...');

  // Follow-up pós-visita — todo dia às 09:00
  cron.schedule('0 9 * * *', followUpPosVisita, { timezone: 'America/Sao_Paulo' });

  // Verificar sem resposta — a cada 6 horas
  cron.schedule('0 */6 * * *', verificarSemResposta);

  // Lembrete de assinatura — todo dia às 14:00
  cron.schedule('0 14 * * *', lembreteAssinatura, { timezone: 'America/Sao_Paulo' });

  // Limpeza — toda segunda às 02:00
  cron.schedule('0 2 * * 1', limpezaSessoes);

  // Lembrete diário aos prestadores — 8h da manhã
  cron.schedule('0 8 * * *', lembretesDiariosPrestadores, { timezone: 'America/Sao_Paulo' });

  console.log('[Jobs] ✅ 5 jobs registrados');
}

// ── JOB 1: FOLLOW-UP PÓS-VISITA ──────────────────────────────
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

// ── JOB 2: SEM RESPOSTA ───────────────────────────────────────
async function verificarSemResposta() {
  console.log('[Job] Verificando sem resposta...');
  try {
    const agora = new Date();

    // ── PRESTADOR NÃO RESPONDEU EM 2H → LEMBRETE ─────────────
    const limite2h = new Date(agora.getTime() - 2 * 60 * 60 * 1000);
    const { data: semResposta2h } = await supabase
      .from('orcs')
      .select('*, prestadores(nome, telefone)')
      .eq('status', 'PRESTADOR NOTIFICADO')
      .eq('lembrete_enviado', false)
      .lt('atualizado_em', limite2h.toISOString());

    for (const orc of (semResposta2h || [])) {
      if (!orc.prestadores?.telefone) continue;

      console.log(`[Job] Enviando lembrete ao prestador: ${orc.codigo}`);

      await enviarMensagem(orc.prestadores.telefone,
        `⏰ *Lembrete — Serviço Seguro*\n\n` +
        `${orc.prestadores.nome}, você recebeu um lead que ainda não foi respondido.\n\n` +
        `📋 ORC: *${orc.codigo}*\n` +
        `🔧 Serviço: ${orc.servico_nome || 'Ver detalhes no sistema'}\n\n` +
        `Por favor, responda se tem disponibilidade para atender este cliente.\n\n` +
        `_Serviço Seguro_ 🛡️`
      );

      // Marcar lembrete como enviado
      await supabase.from('orcs').update({
        lembrete_enviado: true,
        atualizado_em: new Date().toISOString()
      }).eq('id', orc.id);

      console.log(`[Job] ✅ Lembrete enviado para ${orc.prestadores.nome}`);
    }

    // ── PRESTADOR NÃO RESPONDEU EM 4H → SEM RESPOSTA ─────────
    const limite4h = new Date(agora.getTime() - 4 * 60 * 60 * 1000);
    const { data: semResposta4h } = await supabase
      .from('orcs')
      .select('*, prestadores(nome, telefone)')
      .eq('status', 'PRESTADOR NOTIFICADO')
      .eq('lembrete_enviado', true)
      .lt('atualizado_em', limite4h.toISOString());

    for (const orc of (semResposta4h || [])) {
      await supabase.from('orcs').update({
        status: 'SEM RESPOSTA PRESTADOR'
      }).eq('id', orc.id);

      console.log(`[Job] ${orc.codigo} → SEM RESPOSTA PRESTADOR`);

      // Avisar admin
      const adminNum = process.env.ADMIN_WHATSAPP;
      if (adminNum) {
        await enviarMensagem(adminNum,
          `⚠️ *Prestador sem resposta*\n\n` +
          `ORC: ${orc.codigo}\n` +
          `Prestador: ${orc.prestadores?.nome}\n` +
          `Telefone: ${orc.prestadores?.telefone}\n\n` +
          `O lembrete foi enviado mas não houve resposta.\n` +
          `Por favor, verifique no painel.`
        );
      }
    }

    // ── CLIENTE NÃO CONCLUIU ANAMNESE EM 48H ─────────────────
    const limite48h = new Date(agora.getTime() - 48 * 60 * 60 * 1000);
    const { data: sessoesSemResposta } = await supabase
      .from('sessoes_whatsapp')
      .select('*')
      .lt('atualizado_em', limite48h.toISOString());

    for (const sessao of (sessoesSemResposta || [])) {
      // Limpar sessão abandonada
      await supabase.from('sessoes_whatsapp').delete().eq('id', sessao.id);
      console.log(`[Job] Sessão abandonada removida: ${sessao.telefone}`);
    }

  } catch (err) {
    console.error('[Job] Erro sem resposta:', err.message);
  }
}

// ── JOB 3: LEMBRETE ASSINATURA ────────────────────────────────
async function lembreteAssinatura() {
  console.log('[Job] Lembretes de assinatura...');
  try {
    const limite = new Date();
    limite.setHours(limite.getHours() - 24);

    const { data } = await supabase
      .from('contratos')
      .select('*, orcs(codigo, nome_cliente, telefone_cliente, prestadores(nome, telefone))')
      .eq('assinado_cliente', false)
      .lt('criado_em', limite.toISOString());

    for (const c of (data || [])) {
      const orc = c.orcs;
      if (!orc) continue;
      const link = `${process.env.FRONTEND_URL}/contrato.html?orc=${orc.id}&codigo=${orc.codigo}`;
      if (orc.telefone_cliente) {
        await enviarMensagem(orc.telefone_cliente,
          `${orc.nome_cliente}, seu contrato aguarda assinatura:\n🔗 ${link}`
        );
      }
    }
  } catch (err) {
    console.error('[Job] Erro lembrete:', err.message);
  }
}

// ── JOB 4: LIMPEZA ───────────────────────────────────────────
async function limpezaSessoes() {
  console.log('[Job] Limpeza executada');
}

// ── JOB 5: LEMBRETE DIÁRIO AOS PRESTADORES ──────────────────
async function lembretesDiariosPrestadores() {
  console.log('[Job] Enviando lembretes diários aos prestadores...');
  try {
    const { data: orcs } = await supabase
      .from('orcs')
      .select('id, codigo, prestador_id, nome_cliente, disponibilidade_cliente, prestadores(nome, telefone), servicos(titulo)')
      .in('status', ['PRESTADOR NOTIFICADO', 'AGUARDANDO PRESTADOR', 'ANAMNESE CONCLUÍDA'])
      .not('prestador_id', 'is', null);

    if (!orcs?.length) return;

    // Agrupar por prestador
    const porPrestador = {};
    for (const orc of orcs) {
      if (!orc.prestador_id || !orc.prestadores?.telefone) continue;
      if (!porPrestador[orc.prestador_id]) {
        porPrestador[orc.prestador_id] = {
          nome: orc.prestadores.nome,
          telefone: orc.prestadores.telefone,
          orcs: []
        };
      }
      porPrestador[orc.prestador_id].orcs.push(orc);
    }

    for (const [prestadorId, info] of Object.entries(porPrestador)) {
      const lista = info.orcs.map((o, i) =>
        `${i + 1}️⃣ *${o.codigo}* — ${o.servicos?.titulo || 'Serviço'}
` +
        `   👤 ${o.nome_cliente}
` +
        `   📅 Disponível: ${o.disponibilidade_cliente || 'A combinar'}`
      ).join('\n\n');

      await enviarMensagem(info.telefone,
        `👷 Bom dia, *${info.nome}*!

` +
        `Você tem *${info.orcs.length}* pedido${info.orcs.length > 1 ? 's' : ''} aguardando:

` +
        `${lista}

` +
        `Responda com o número e horário.
` +
        `Ex: *"1 - terça às 14h"*

` +
        `Sem disponibilidade? Responda *"Cancelar 1"* ou *"Cancelar ${info.orcs[0]?.codigo}"*

` +
        `_Serviço Seguro_ 🛡️`
      );

      console.log(`[Job] Lembrete enviado para ${info.nome} (${info.orcs.length} ORCs)`);
    }
  } catch (err) {
    console.error('[Job] Erro lembrete diário:', err.message);
  }
}

module.exports = { iniciarJobs, followUpPosVisita };
