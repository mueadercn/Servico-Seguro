const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Erro na requisição')
  return data
}

export const api = {
  // ORCs
  criarOrc: (dados) => request('/api/orcs', { method: 'POST', body: dados }),
  listarOrcs: (params) => request('/api/orcs?' + new URLSearchParams(params)),
  buscarOrc: (id) => request(`/api/orcs/${id}`),
  atualizarStatus: (id, status, extras) => request(`/api/orcs/${id}/status`, { method: 'PATCH', body: { status, ...extras } }),
  vincularPrestador: (id, prestador_id) => request(`/api/orcs/${id}/prestador`, { method: 'POST', body: { prestador_id } }),
  fecharOrc: (id, dados) => request(`/api/orcs/${id}/fechar`, { method: 'POST', body: dados }),

  // IA
  anamnese: (dados) => request('/api/ia/anamnese', { method: 'POST', body: dados }),
  getPrompts: () => request('/api/ia/prompts'),
  updatePrompt: (chave, valor) => request(`/api/ia/prompts/${chave}`, { method: 'PUT', body: { valor } }),

  // Contratos
  criarContrato: (dados) => request('/api/contratos', { method: 'POST', body: dados }),
  assinarContrato: (id, dados) => request(`/api/contratos/${id}/assinar`, { method: 'POST', body: dados }),
  getContrato: (id) => request(`/api/contratos/${id}`),
  pdfUrl: (id) => `${API_URL}/api/contratos/${id}/pdf`,

  // WhatsApp
  enviarMensagem: (dados) => request('/api/whatsapp/enviar', { method: 'POST', body: dados }),
  statusWhatsapp: () => request('/api/whatsapp/status'),

  // Config
  getConfig: () => request('/api/config'),
  updateConfig: (chave, valor) => request(`/api/config/${chave}`, { method: 'PUT', body: { valor } }),
  getComissoes: () => request('/api/config/comissoes'),
}
