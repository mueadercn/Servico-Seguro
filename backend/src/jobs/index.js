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

  console.log('[Jobs] ✅ 4 jobs registrados');
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
    const limite = new Date();
    limite.setHours(limite.getHours() - 48);

    const { data } = await supabase
      .from('orcs')
      .select('*')
      .in('status', ['EM ANAMNESE', 'PRESTADOR NOTIFICADO'])
      .lt('atualizado_em', limite.toISOString());

    for (const orc of (data || [])) {
      const novoStatus = orc.status === 'EM ANAMNESE' ? 'SEM RESPOSTA CLIENTE' : 'SEM RESPOSTA PRESTADOR';
      await supabase.from('orcs').update({ status: novoStatus }).eq('id', orc.id);
      console.log(`[Job] ${orc.codigo} → ${novoStatus}`);
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

module.exports = { iniciarJobs, followUpPosVisita };
