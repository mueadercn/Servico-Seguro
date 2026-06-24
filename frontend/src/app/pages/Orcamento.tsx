import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ArrowLeft, Send } from 'lucide-react';
import { apiCall } from '../../lib/supabase';

export function Orcamento() {
  const [params] = useSearchParams();
  const servicoId = params.get('servico');
  const servicoNome = params.get('nome') || 'Serviço';
  const catNome = params.get('cat') || '';
  const prestadorId = params.get('prestador') || '';

  const [msgs, setMsgs] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [etapa, setEtapa] = useState('inicio');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [orcId, setOrcId] = useState('');
  const [chatToken, setChatToken] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const contratante = JSON.parse(localStorage.getItem('ss_contratante') || 'null');

  useEffect(() => { setTimeout(() => iniciar(), 400); }, []);
  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [msgs]);

  function addMsg(role: string, content: string, extra?: any) {
    setMsgs(prev => [...prev, { role, content, ...extra }]);
  }

  async function iniciar() {
    if (contratante) {
      const nome = contratante.nome;
      const tel = contratante.telefone;
      setNomeCliente(nome);
      setTelefone(tel);
      const orc = await criarOrc(nome, tel);
      if (orc) {
        const h = [{ role: 'assistant', content: `Olá, ${nome}! Me conta o que você precisa para ${servicoNome}.` }];
        setHistorico(h);
        addMsg('ia', `Olá, **${nome}**! 😊\n\nVi que tem interesse em: **${servicoNome}**\n\nMe conta o que exatamente você precisa?`);
        setEtapa('anamnese');
      }
    } else {
      setEtapa('nome');
      addMsg('ia', `Olá! Sou a assistente do **Serviço Seguro**. 😊\n\nVi que tem interesse em: **${servicoNome}**\n\nPara começar, qual é o seu nome?`);
    }
  }

  async function criarOrc(nome: string, tel: string) {
    try {
      const result = await apiCall('/api/orcs', {
        method: 'POST',
        body: {
          servico_id: servicoId || null,
          nome_cliente: nome,
          telefone_cliente: tel,
          canal: 'site',
          servico_nome: servicoNome,
          prestador_id: prestadorId || null,
          status: 'EM ANAMNESE',
        },
      });
      if (result.ok) {
        setOrcId(result.orc.id);
        return result.orc;
      }
    } catch (e) { console.warn(e); }
    return null;
  }

  async function enviar() {
    const txt = input.trim();
    if (!txt || loading) return;
    setInput('');
    addMsg('user', txt);

    if (etapa === 'nome') {
      setNomeCliente(txt);
      setEtapa('telefone');
      addMsg('ia', `Prazer, **${txt}**! Qual o seu WhatsApp (com DDD)?`);
      return;
    }

    if (etapa === 'telefone') {
      setTelefone(txt);
      const orc = await criarOrc(nomeCliente, txt);
      if (orc) {
        const h = [{ role: 'assistant', content: `Ótimo! Me conta o que você precisa para ${servicoNome}.` }];
        setHistorico(h);
        addMsg('ia', `Ótimo! Agora me conta o que você precisa para **${servicoNome}**?`);
        setEtapa('anamnese');
      } else {
        addMsg('ia', 'Houve um problema ao registrar. Tente novamente ou entre em contato via WhatsApp.');
      }
      return;
    }

    if (etapa === 'anamnese') {
      setLoading(true);
      addMsg('typing', '');
      try {
        const result = await apiCall('/api/ia/anamnese', {
          method: 'POST',
          body: { mensagem: txt, historico, cat_nome: catNome, servico_nome: servicoNome, orc_id: orcId },
        });
        setMsgs(prev => prev.filter(m => m.role !== 'typing'));
        if (result.concluida) {
          await concluirAnamnese(result.resumo);
        } else {
          setHistorico(result.historico);
          addMsg('ia', result.resposta);
        }
      } catch (e) {
        setMsgs(prev => prev.filter(m => m.role !== 'typing'));
        const fallbacks = ['Em qual cômodo é o serviço?', 'Qual a urgência?', 'Tem disponibilidade esta semana?'];
        const idx = historico.filter(h => h.role === 'user').length;
        const resp = fallbacks[Math.min(idx, fallbacks.length - 1)];
        setHistorico(prev => [...prev, { role: 'user', content: txt }, { role: 'assistant', content: resp }]);
        addMsg('ia', resp);
        if (idx >= fallbacks.length - 1) setTimeout(() => concluirAnamnese('Serviço solicitado pelo cliente'), 1500);
      }
      setLoading(false);
    }
  }

  async function concluirAnamnese(resumo: string) {
    if (!orcId) return;
    setEtapa('concluindo');
    addMsg('sistema', '⏳ Finalizando seu pedido…');
    try {
      const result = await apiCall(`/api/orcs/${orcId}/iniciar-chat`, {
        method: 'POST',
        body: { resumo },
      });
      setMsgs(prev => prev.filter(m => m.role !== 'sistema'));
      if (result.ok) {
        setChatToken(result.link_token);
        addMsg('concluido', resumo, { token: result.link_token });
        setEtapa('concluido');
      } else {
        addMsg('ia', 'Pedido registrado! Em breve um profissional entrará em contato.');
        setEtapa('concluido');
      }
    } catch (e) {
      setMsgs(prev => prev.filter(m => m.role !== 'sistema'));
      addMsg('ia', 'Pedido registrado! Em breve um profissional entrará em contato.');
      setEtapa('concluido');
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="bg-primary px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-white/70 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="w-9 h-9 rounded-full bg-success/20 flex items-center justify-center">
          <img src="/logo-escudo.png" alt="" style={{ height: 26, width: 'auto' }} />
        </div>
        <div className="flex-1">
          <div className="font-bold text-white text-sm">Serviço Seguro</div>
          <div className="text-white/60 text-xs">● Atendimento online</div>
        </div>
        <div className="text-white/80 text-xs bg-white/15 px-3 py-1 rounded-full max-w-[160px] truncate">{servicoNome}</div>
      </div>

      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {msgs.map((m, i) => {
          if (m.role === 'typing') return (
            <div key={i} className="flex gap-1 items-center bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-3 self-start shadow-sm">
              {[0,200,400].map(d => <div key={d} className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }} />)}
            </div>
          );
          if (m.role === 'sistema') return (
            <div key={i} className="self-center bg-primary/10 text-primary text-xs font-semibold px-4 py-2 rounded-full">{m.content}</div>
          );
          if (m.role === 'concluido') return (
            <div key={i} className="bg-gradient-to-br from-primary to-[#0d2847] rounded-2xl p-6 text-center text-white">
              <div className="text-3xl mb-3">🎉</div>
              <div className="font-bold text-base mb-2">Pedido registrado!</div>
              <div className="text-white/60 text-xs mt-2 leading-relaxed mb-4">{m.content}</div>
              {m.token && (
                <a
                  href={`/chat/${m.token}?papel=cliente`}
                  className="inline-block bg-success text-white px-6 py-2.5 rounded-xl text-sm font-bold mb-3">
                  💬 Abrir chat com o profissional →
                </a>
              )}
              <br />
              <Link to="/" className="text-white/50 text-xs hover:text-white/80">← Voltar ao site</Link>
            </div>
          );
          const isUser = m.role === 'user';
          return (
            <div key={i} className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-primary text-white rounded-tr-sm self-end' : 'bg-white border border-border text-foreground rounded-tl-sm self-start shadow-sm'}`}>
              <div dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') }} />
            </div>
          );
        })}
      </div>

      {!['concluido', 'concluindo'].includes(etapa) && (
        <div className="bg-white border-t border-border p-3 flex items-end gap-2">
          <label className="text-muted-foreground text-2xl cursor-pointer hover:text-primary transition-colors">
            📷<input type="file" accept="image/*" className="hidden" onChange={e => { if(e.target.files?.[0]) { addMsg('user', '📷 Foto enviada'); if(etapa==='anamnese') { setHistorico(prev=>[...prev,{role:'user',content:'[Foto enviada]'}]); } } }} />
          </label>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviar();}}}
            placeholder="Digite sua mensagem..." rows={1}
            className="flex-1 border border-border rounded-xl px-4 py-2 text-sm outline-none focus:border-primary resize-none max-h-28" />
          <button onClick={enviar} disabled={loading||!input.trim()}
            className="w-10 h-10 bg-primary hover:bg-success disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors">
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
