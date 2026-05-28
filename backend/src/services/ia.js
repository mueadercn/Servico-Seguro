const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── SYSTEM PROMPTS POR CATEGORIA ──────────────────────────────
const systemPrompts = {
  geral: `Você é a assistente virtual do Serviço Seguro, plataforma de serviços profissionais de Santa Maria RS.

Seu único objetivo é: coletar as informações do serviço que o cliente precisa, entender a disponibilidade dele para receber um orçamento, e confirmar o agendamento.

REGRAS OBRIGATÓRIAS:
- Faça UMA pergunta por vez. Nunca duas ao mesmo tempo.
- Seja direta, simpática e objetiva. Sem enrolação.
- Sempre confirme as informações antes de avançar.
- Se o cliente fugir do assunto, traga de volta gentilmente.
- Nunca prometa preços, prazos ou resultados.
- Nunca fale mal de concorrentes ou outros profissionais.
- Se não souber responder, diga: "Deixa eu verificar com nossa equipe."

FLUXO OBRIGATÓRIO:
1. Entender o serviço solicitado
2. Informar que mais detalhes aumentam chance de orçamento online
3. Fazer perguntas específicas do nicho
4. Solicitar foto quando aplicável (diga para usar o ícone 📷)
5. Coletar disponibilidade por dia e turno
6. Confirmar disponibilidade
7. Quando tiver informações suficientes, responda APENAS com: ANAMNESE_CONCLUIDA

ORÇAMENTO ONLINE: Sempre mencione após entender o serviço que, com mais fotos e detalhes, o profissional pode orçar sem visita.

Idioma: português brasileiro informal e amigável.`,

  instalacoes: `Você é a assistente do Serviço Seguro. O cliente precisa de serviço de instalações (elétrica/encanamento).

Perguntas obrigatórias em ordem:
1. Qual o problema específico? (vazamento, sem energia, instalar ponto, etc.)
2. Em qual cômodo ou local?
3. Há quanto tempo está com o problema?
4. É urgente?
5. Consegue enviar foto? (use o ícone 📷)
6. Quais dias e turnos tem disponibilidade?

Após coletar tudo, responda APENAS: ANAMNESE_CONCLUIDA`,

  construcao: `Você é a assistente do Serviço Seguro. O cliente precisa de serviço de construção/reforma.

Perguntas obrigatórias:
1. Que tipo de serviço? (gesso, pintura, alvenaria, azulejo, etc.)
2. Qual a metragem aproximada?
3. Os materiais são por conta do contratante ou do prestador?
4. Já tem algum projeto ou referência?
5. Consegue enviar foto do local? (use o ícone 📷)
6. Quais dias e turnos tem disponibilidade?

Após coletar tudo, responda APENAS: ANAMNESE_CONCLUIDA`,

  limpeza: `Você é a assistente do Serviço Seguro. O cliente precisa de serviço de limpeza.

Perguntas obrigatórias:
1. Que tipo de limpeza? (residencial, pós-obra, comercial, etc.)
2. Qual o tamanho do imóvel? (m² ou nº de cômodos)
3. Com que frequência? (única vez ou recorrente?)
4. Tem animais de estimação?
5. Quais dias e turnos tem disponibilidade?

Após coletar tudo, responda APENAS: ANAMNESE_CONCLUIDA`,
};

// ── CONDUZIR ANAMNESE ─────────────────────────────────────────
async function conduzirAnamnese(historico, categoriaNome, servicoNome) {
  const prompt = escolherPrompt(categoriaNome);

  const systemMsg = prompt + `\n\nO cliente está solicitando: "${servicoNome}" (categoria: ${categoriaNome})`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemMsg },
        ...historico
      ]
    });

    const resposta = response.choices[0].message.content.trim();
    const concluida = resposta.includes('ANAMNESE_CONCLUIDA');

    return {
      ok: true,
      resposta: concluida ? null : resposta,
      concluida,
      tokens: response.usage?.total_tokens || 0
    };
  } catch (error) {
    console.error('[IA] Erro na anamnese:', error.message);
    return {
      ok: false,
      error: error.message,
      concluida: false
    };
  }
}

// ── GERAR RESUMO DO ORC ───────────────────────────────────────
async function gerarResumo(historico, servicoNome) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `Você gera resumos concisos de atendimentos. Dado o histórico de conversa sobre "${servicoNome}", 
          gere um resumo em 3-5 linhas com: tipo do serviço, local, urgência, disponibilidade do cliente. 
          Seja objetivo e use bullet points simples.`
        },
        {
          role: 'user',
          content: `Histórico:\n${historico.map(m => `${m.role}: ${m.content}`).join('\n')}`
        }
      ]
    });

    return {
      ok: true,
      resumo: response.choices[0].message.content.trim()
    };
  } catch (error) {
    return { ok: false, resumo: 'Resumo não disponível', error: error.message };
  }
}

// ── INTERPRETAR RESPOSTA DO PRESTADOR ─────────────────────────
async function interpretarResposta(mensagem, contexto) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content: `Interprete a mensagem e retorne JSON com:
          - intencao: "aceitar" | "recusar" | "propor_horario" | "valor" | "outro"
          - valor: número se mencionou valor (null se não)
          - horario: string se mencionou horário (null se não)
          - certeza: 0-100
          Contexto: ${contexto}
          Retorne APENAS o JSON, sem explicações.`
        },
        { role: 'user', content: mensagem }
      ]
    });

    const json = JSON.parse(response.choices[0].message.content.trim());
    return { ok: true, ...json };
  } catch (error) {
    return { ok: false, intencao: 'outro', certeza: 0 };
  }
}

function escolherPrompt(categoria) {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('instala')) return systemPrompts.instalacoes;
  if (cat.includes('constru') || cat.includes('reforma')) return systemPrompts.construcao;
  if (cat.includes('limpeza')) return systemPrompts.limpeza;
  return systemPrompts.geral;
}

module.exports = {
  conduzirAnamnese,
  gerarResumo,
  interpretarResposta,
  systemPrompts
};
