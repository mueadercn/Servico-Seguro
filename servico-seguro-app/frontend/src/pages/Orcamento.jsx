import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

export default function Orcamento() {
  const [params] = useSearchParams()
  const servicoId = params.get('servico')
  const servicoNome = params.get('nome') || 'Serviço'
  const catNome = params.get('cat') || ''

  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historico, setHistorico] = useState([])
  const [etapa, setEtapa] = useState('inicio') // inicio | nome | telefone | anamnese | concluido
  const [orcCodigo, setOrcCodigo] = useState(null)
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [orcId, setOrcId] = useState(null)

  const chatRef = useRef(null)
  const contratante = JSON.parse(localStorage.getItem('ss_contratante') || 'null')

  useEffect(() => {
    setTimeout(() => iniciar(), 500)
  }, [])

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight)
  }, [msgs])

  function addMsg(role, content, opts = {}) {
    setMsgs(prev => [...prev, { role, content, ...opts }])
  }

  async function iniciar() {
    if (contratante) {
      setNomeCliente(contratante.nome)
      setTelefone(contratante.telefone)
      setEtapa('anamnese')
      addMsg('ia', `Olá, **${contratante.nome}**! 😊\n\nVi que tem interesse em: **${servicoNome}**\n\nMe conta: o que exatamente você precisa?`)
      const h = [{ role: 'assistant', content: `Olá, ${contratante.nome}! Me conta o que você precisa para ${servicoNome}.` }]
      setHistorico(h)
    } else {
      setEtapa('nome')
      addMsg('ia', `Olá! Sou a assistente do **Serviço Seguro** 😊\n\nVi que tem interesse em: **${servicoNome}**\n\nPara começar, qual é o seu nome?`)
    }
  }

  async function enviar() {
    const txt = input.trim()
    if (!txt || loading) return
    setInput('')
    addMsg('user', txt)

    if (etapa === 'nome') {
      setNomeCliente(txt)
      setEtapa('telefone')
      addMsg('ia', `Prazer, **${txt}**! Qual o seu WhatsApp para o profissional entrar em contato?`)
      return
    }

    if (etapa === 'telefone') {
      setTelefone(txt)
      setEtapa('anamnese')
      const h = [{ role: 'assistant', content: `Ótimo! Me conta o que você precisa para ${servicoNome}.` }]
      setHistorico(h)
      addMsg('ia', `Ótimo! Agora me conta: o que exatamente você precisa para **${servicoNome}**?`)
      return
    }

    if (etapa === 'anamnese') {
      setLoading(true)
      addMsg('typing', '')

      try {
        const result = await api.anamnese({
          mensagem: txt,
          historico,
          cat_nome: catNome,
          servico_nome: servicoNome,
          orc_id: orcId
        })

        setMsgs(prev => prev.filter(m => m.role !== 'typing'))

        if (result.concluida) {
          await gerarOrc(result.resumo, result.historico)
        } else {
          setHistorico(result.historico)
          addMsg('ia', result.resposta)
        }
      } catch (e) {
        // Fallback offline
        setMsgs(prev => prev.filter(m => m.role !== 'typing'))
        addMsg('ia', 'Em qual cômodo ou local é o serviço?')
        setHistorico(prev => [...prev, { role: 'user', content: txt }, { role: 'assistant', content: 'Em qual cômodo?' }])
      }

      setLoading(false)
    }
  }

  async function gerarOrc(resumo, hist) {
    const codigo = 'ORC-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5)
    setOrcCodigo(codigo)

    try {
      const result = await api.criarOrc({
        servico_id: servicoId,
        nome_cliente: nomeCliente || contratante?.nome,
        telefone_cliente: telefone || contratante?.telefone,
        canal: 'site',
        servico_nome: servicoNome
      })
      if (result.ok) setOrcId(result.orc.id)
    } catch (e) {
      console.warn('ORC save error:', e)
    }

    setEtapa('concluido')
    addMsg('sistema', `✅ Código gerado: ${codigo}`)
    addMsg('concluido', resumo, { codigo })
  }

  async function enviarFoto(e) {
    const file = e.target.files[0]
    if (!file) return
    addMsg('user', '📷 Foto enviada', { isImg: true, file })
    if (etapa === 'anamnese') {
      setHistorico(prev => [...prev, { role: 'user', content: '[Foto enviada pelo cliente]' }])
      setLoading(true)
      try {
        const result = await api.anamnese({
          mensagem: '[O cliente enviou uma foto do problema]',
          historico: [...historico, { role: 'user', content: '[Foto enviada pelo cliente]' }],
          cat_nome: catNome,
          servico_nome: servicoNome
        })
        setMsgs(prev => prev.filter(m => m.role !== 'typing'))
        if (result.concluida) {
          await gerarOrc(result.resumo, result.historico)
        } else {
          setHistorico(result.historico)
          addMsg('ia', result.resposta)
        }
      } catch (err) {
        addMsg('ia', 'Foto recebida! Quais dias e turnos você tem disponibilidade?')
      }
      setLoading(false)
    }
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1B2F6E] px-4 py-3 flex items-center gap-3">
        <button onClick={() => history.back()} className="text-white/70 text-xl">←</button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A7A4A] to-[#22a362] flex items-center justify-center text-white text-lg">🛡️</div>
        <div className="flex-1">
          <div className="font-bold text-white text-sm font-['Syne']">Serviço Seguro</div>
          <div className="text-white/60 text-xs">● Atendimento online</div>
        </div>
        <div className="text-white/80 text-xs bg-white/15 px-3 py-1 rounded-full max-w-[160px] truncate">
          {servicoNome}
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {msgs.map((m, i) => (
          <Message key={i} msg={m} />
        ))}
      </div>

      {/* Input */}
      {etapa !== 'concluido' && (
        <div className="bg-white border-t border-gray-200 p-3 flex items-end gap-2">
          <label className="text-gray-400 text-2xl cursor-pointer hover:text-[#1B2F6E] transition-colors">
            📷
            <input type="file" accept="image/*" className="hidden" onChange={enviarFoto} />
          </label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#1B2F6E] resize-none max-h-28"
            style={{ fontFamily: 'DM Sans' }}
          />
          <button
            onClick={enviar}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-[#1B2F6E] hover:bg-[#1A7A4A] disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
          >
            ➤
          </button>
        </div>
      )}
    </div>
  )
}

function Message({ msg }) {
  if (msg.role === 'typing') {
    return (
      <div className="flex gap-1 items-center bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 self-start shadow-sm">
        {[0, 200, 400].map(d => (
          <div key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }} />
        ))}
      </div>
    )
  }

  if (msg.role === 'sistema') {
    return (
      <div className="self-center bg-[#1B2F6E]/10 text-[#1B2F6E] text-xs font-semibold px-4 py-2 rounded-full">
        {msg.content}
      </div>
    )
  }

  if (msg.role === 'concluido') {
    return (
      <div className="bg-gradient-to-br from-[#0f1d45] to-[#1B2F6E] rounded-2xl p-6 text-center text-white">
        <div className="text-3xl mb-3">🎉</div>
        <div className="font-['Syne'] font-bold text-base mb-2">Pedido registrado!</div>
        <div className="text-white/70 text-sm mb-1">Código: <strong className="text-[#2ECC71]">{msg.codigo}</strong></div>
        <div className="text-white/60 text-xs mt-2 leading-relaxed">{msg.content}</div>
        <div className="text-white/50 text-xs mt-3">Nossa equipe entrará em contato em breve para confirmar o agendamento.</div>
        <button
          onClick={() => window.location.href = '/'}
          className="mt-4 bg-[#1A7A4A] hover:bg-[#22a362] text-white px-6 py-2 rounded-xl text-sm font-['Syne'] font-bold transition-colors"
        >
          ← Voltar ao site
        </button>
      </div>
    )
  }

  const isUser = msg.role === 'user'
  const text = msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')

  return (
    <div className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
      isUser
        ? 'bg-[#1B2F6E] text-white rounded-tr-sm self-end'
        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm self-start shadow-sm'
    }`}>
      <div dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  )
}
