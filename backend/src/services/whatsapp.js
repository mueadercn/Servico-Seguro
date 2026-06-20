const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'apikey': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// ── ENVIAR TEXTO ──────────────────────────────────────────────
async function enviarMensagem(numero, texto) {
  try {
    const numeroFormatado = formatarNumero(numero);
    const url = `/message/sendText/${INSTANCE}`;
    console.log(`[WhatsApp] Enviando para ${numeroFormatado}`);
    const response = await api.post(url, {
      number: numeroFormatado,
      text: texto,
      delay: 1000
    });
    console.log(`[WhatsApp] ✅ Mensagem enviada para ${numeroFormatado}`);
    return { ok: true, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const resposta = error.response?.data;
    
    // Diagnóstico detalhado por tipo de erro
    let diagnostico = error.message;
    if (status === 404) diagnostico = `Número não encontrado no WhatsApp: ${numero}`;
    if (status === 400) diagnostico = `Número inválido: ${numero}`;
    if (status === 401) diagnostico = `API Key inválida`;
    if (status === 500) diagnostico = `Erro interno da Evolution API`;
    
    console.error(`[WhatsApp] ❌ Falha ao enviar para ${numero}: ${diagnostico}`);
    if (resposta) console.error(`[WhatsApp] Detalhe:`, JSON.stringify(resposta).substring(0, 200));
    
    return { ok: false, error: diagnostico, status, numero };
  }
}

// ── ENVIAR COM BOTÕES (para respostas rápidas) ────────────────
async function enviarComBotoes(numero, texto, botoes) {
  try {
    const numeroFormatado = formatarNumero(numero);
    // Evolution API suporta botões de texto simples
    const textoBotoes = botoes.map((b, i) => `${i+1}. ${b}`).join('\n');
    const textoCompleto = `${texto}\n\n${textoBotoes}`;
    return await enviarMensagem(numero, textoCompleto);
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// ── VERIFICAR STATUS DA INSTÂNCIA ─────────────────────────────
async function verificarInstancia() {
  try {
    const response = await api.get(`/instance/connectionState/${INSTANCE}`);
    return {
      ok: true,
      connected: response.data?.instance?.state === 'open',
      state: response.data?.instance?.state
    };
  } catch (error) {
    return { ok: false, connected: false, error: error.message };
  }
}

// ── FORMATAR NÚMERO ───────────────────────────────────────────
function formatarNumero(numero) {
  // Remove tudo que não é dígito
  const digits = numero.replace(/\D/g, '');
  // Remove prefixos problemáticos
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.startsWith('0')) return '55' + digits.slice(1);
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits;
}

// ── TEMPLATES DE MENSAGEM ─────────────────────────────────────
const templates = {

  // Para o contratante: solicitação recebida
  orcamentoRecebido: (nomeCliente, codigo, servico) =>
    `Olá, ${nomeCliente}! 😊\n\n` +
    `✅ Seu pedido de orçamento foi registrado com sucesso!\n\n` +
    `📋 Código: *${codigo}*\n` +
    `🔧 Serviço: ${servico}\n\n` +
    `Nossa equipe está buscando o profissional ideal para você. ` +
    `Em breve entraremos em contato para confirmar o agendamento.\n\n` +
    `_Serviço Seguro — Serviços Profissionais com Segurança_ 🛡️`,

  // Para o prestador: novo lead
  novoLead: (nomePrestador, codigo, resumo, disponibilidade) => {
    // Formatar disponibilidade destacando dias e turnos
    const dispFormatada = disponibilidade
      ? disponibilidade
          .split(',')
          .map(d => `   • ${d.trim()}`)
          .join('\n')
      : '   • A combinar';

    // Separar resumo em linhas e remover linha de disponibilidade (vem separado)
    const resumoLimpo = resumo
      ? resumo.split('\n')
          .filter(l => !l.toLowerCase().includes('disponib'))
          .join('\n')
          .trim()
      : 'Detalhes a confirmar';

    return `👷 *${nomePrestador}*, novo lead!\n\n` +
    `📋 *${codigo}*\n\n` +
    `🔧 *Serviço:*\n${resumoLimpo}\n\n` +
    `📅 *Cliente disponível para orçamento:*\n${dispFormatada}\n\n` +
    `Você tem disponibilidade para marcar um orçamento?\n\n` +
    `1️⃣ *Sim* — informe o dia e horário de acordo com a disponibilidade do cliente\n` +
    `2️⃣ *Não tenho disponibilidade*`;
  },

  // Para o prestador: confirmar horário
  confirmarHorario: (nomePrestador, horarioCliente) =>
    `${nomePrestador}, o cliente tem disponibilidade:\n\n` +
    `📅 ${horarioCliente}\n\n` +
    `Você tem disponibilidade nesse(s) horário(s)?\n\n` +
    `1. Sim, confirmo\n` +
    `2. Não tenho, proponha outro horário`,

  // Para o contratante: agendamento confirmado
  agendamentoConfirmado: (nomeCliente, nomePrestador, horario, telefone) =>
    `Ótima notícia, ${nomeCliente}! 🎉\n\n` +
    `✅ *Visita confirmada!*\n\n` +
    `👷 Profissional: *${nomePrestador}*\n` +
    `📅 Data/Horário: *${horario}*\n` +
    `📱 Contato: ${telefone}\n\n` +
    `O profissional irá até você para fazer o orçamento.\n\n` +
    `_Serviço Seguro_ 🛡️`,

  // Para o prestador: dados do cliente para visita
  dadosCliente: (nomePrestador, nomeCliente, endereco, telefone, horario) =>
    `${nomePrestador}, visita confirmada! ✅\n\n` +
    `👤 Cliente: *${nomeCliente}*\n` +
    `📍 Endereço: ${endereco}\n` +
    `📱 Telefone: ${telefone}\n` +
    `📅 Horário: *${horario}*\n\n` +
    `_Serviço Seguro_ 🛡️`,

  // Follow-up para contratante (dia seguinte)
  followUpCliente: (nomeCliente, servico) =>
    `Olá, ${nomeCliente}! 😊\n\n` +
    `Como foi a visita do profissional para o serviço de *${servico}*?\n\n` +
    `Vocês chegaram a fechar o serviço?\n\n` +
    `1. ✅ Sim, fechamos!\n` +
    `2. ❌ Não fechamos\n` +
    `3. ⏳ Ainda estamos negociando`,

  // Follow-up para prestador (dia seguinte)
  followUpPrestador: (nomePrestador, nomeCliente) =>
    `${nomePrestador}, como foi o orçamento na casa de *${nomeCliente}*?\n\n` +
    `Fecharam o serviço?\n\n` +
    `1. ✅ Sim! Qual foi o valor combinado?\n` +
    `2. ❌ Não fechamos\n` +
    `3. ⏳ Ainda em negociação`,

  // Ping-pong de agenda (1ª tentativa)
  pingPong1: (nomeCliente, horarioPrestador) =>
    `${nomeCliente}, o profissional não tem disponibilidade nos horários que você informou.\n\n` +
    `Ele pode no(s) seguinte(s) horário(s):\n` +
    `📅 ${horarioPrestador}\n\n` +
    `Algum desses funciona para você?\n\n` +
    `1. Sim, funciona\n` +
    `2. Não tenho nesses horários`,

  // Ping-pong (2ª tentativa)
  pingPong2: (nomeCliente) =>
    `${nomeCliente}, vamos tentar uma última vez encontrar um horário que funcione para ambos.\n\n` +
    `Quais outros dias e turnos você teria disponibilidade?\n` +
    `_(Ex: segunda à tarde, sexta de manhã)_`,

  // Envio de contatos (3ª tentativa)
  enviarContatoPrestador: (nomeCliente, nomePrestador, telefonePrestador) =>
    `${nomeCliente}, não conseguimos encaixar um horário pela plataforma. 😕\n\n` +
    `Segue o contato do profissional para combinar diretamente:\n\n` +
    `👷 *${nomePrestador}*\n` +
    `📱 WhatsApp: ${telefonePrestador}\n\n` +
    `⚠️ *Lembrete importante:* Fechando pela plataforma Serviço Seguro você tem:\n` +
    `✅ Contrato digital com validade jurídica\n` +
    `✅ Proteção para ambas as partes\n` +
    `✅ Histórico completo do serviço\n\n` +
    `Quando combinarem, volte e finalize pela plataforma!`,

  enviarContatoCliente: (nomePrestador, nomeCliente, telefoneCliente) =>
    `${nomePrestador}, seu contato foi enviado ao cliente *${nomeCliente}* para combinar diretamente.\n\n` +
    `⚠️ *Lembrete:* Fechar pela plataforma é melhor para você:\n` +
    `✅ Contrato que te protege juridicamente\n` +
    `✅ Avaliações que aumentam sua reputação\n` +
    `✅ Mais clientes pela plataforma\n\n` +
    `Após combinar, oriente o cliente a finalizar pela plataforma!`,

  // Link do contrato
  linkContrato: (nome, tipo, linkContrato, codigo) =>
    `${nome}, o orçamento foi confirmado! 🎉\n\n` +
    `Agora é só assinar o contrato:\n\n` +
    `📄 Tipo: *${tipo === 'carta_aceite' ? 'Carta Aceite' : 'Contrato Seguro'}*\n` +
    `🔗 Link: ${linkContrato}\n\n` +
    `_Código: ${codigo}_\n\n` +
    `_Serviço Seguro_ 🛡️`,

  // Divergência de valores
  divergencia: (nome, valorInformado, valorOutro) =>
    `${nome}, identificamos uma diferença nos valores informados:\n\n` +
    `• Você informou: *R$ ${valorInformado}*\n` +
    `• A outra parte informou: *R$ ${valorOutro}*\n\n` +
    `Nossa equipe entrará em contato para resolver. Por favor, aguarde.`,
};

module.exports = {
  enviarMensagem,
  enviarComBotoes,
  verificarInstancia,
  formatarNumero,
  templates
};
