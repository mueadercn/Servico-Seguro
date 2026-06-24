import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { Send, CheckCircle2, FileText, Image, X, Mic, MicOff, Lock, Shield } from 'lucide-react';
import { supabase, getPrestador, getContratante } from '../../lib/supabase';
import { apiCall } from '../../lib/supabase';

const TEAL = 'oklch(0.6 0.118 184.704)';
const TEAL_LIGHT = 'oklch(0.95 0.03 184)';
const TEAL_DARK = 'oklch(0.45 0.1 184)';

type Papel = 'cliente' | 'prestador' | null;
type StatusChat = 'conversando' | 'aguardando_orcamento' | 'orcamento_enviado' | 'finalizado' | 'elaborando_contrato' | 'contrato_gerado' | 'contrato_assinado';

interface Mensagem {
  id: string;
  chat_id: string;
  remetente: 'cliente' | 'prestador';
  tipo: 'texto' | 'audio' | 'imagem';
  conteudo: string;
  criado_em: string;
}

interface ChatData {
  id: string;
  orc_id: string;
  link_token: string;
  status: StatusChat;
  finalizado_cliente: boolean;
  finalizado_prestador: boolean;
  orcs: {
    id: string;
    codigo: string;
    status: string;
    resumo_anamnese: string;
    nome_cliente: string;
    servico_nome: string;
    servicos?: { titulo: string };
    prestadores: { id: string; nome: string; telefone: string };
  };
}

function getPapelFromUrl(): Papel {
  const p = new URLSearchParams(window.location.search).get('papel');
  return p === 'cliente' || p === 'prestador' ? p : null;
}

function InputLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-[0.04em] mb-1.5" style={{ color: '#64748b' }}>
      {children}
    </label>
  );
}

function StyledInput({ value, onChange, placeholder, type = 'text' }: any) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 text-sm outline-none transition-colors"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#f8fafc',
      }}
      onFocus={e => (e.target.style.borderColor = '#030213')}
      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
    />
  );
}

export function Chat() {
  const { token } = useParams<{ token: string }>();
  const [chat, setChat] = useState<ChatData | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [papel] = useState<Papel>(getPapelFromUrl);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroFinalizar, setErroFinalizar] = useState('');
  const [gravando, setGravando] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [_mostrarResumo] = useState(true);
  const [painelFinalizar, setPainelFinalizar] = useState(false);
  const [formulario, setFormulario] = useState({ valor: '', prazo: '', garantia: '', pagamento: '' });
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ultimaMsgRef = useRef<string>('');

  useEffect(() => {
    if (!token) return;
    // Auth guard: se o papel já está na URL, exigir login
    const papelUrl = getPapelFromUrl();
    if (papelUrl) {
      const p = getPrestador();
      const c = getContratante();
      if (papelUrl === 'prestador' && !p?.id) {
        window.location.href = `/auth?redirect=/chat/${token}?papel=prestador&tipo=prestador`;
        return;
      }
      if (papelUrl === 'cliente' && !c?.id) {
        window.location.href = `/auth?redirect=/chat/${token}?papel=cliente`;
        return;
      }
    }
    carregarChat();
  }, [token]);

  useEffect(() => {
    if (!chat?.id) return;
    const intMsg = setInterval(buscarMensagens, 3000);
    const intChat = setInterval(buscarEstadoChat, 5000);
    return () => { clearInterval(intMsg); clearInterval(intChat); };
  }, [chat?.id]);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [mensagens]);

  useEffect(() => {
    if (!chat?.id) return;
    const channel = supabase
      .channel(`chat-${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_mensagens',
        filter: `chat_id=eq.${chat.id}`,
      }, (payload) => {
        setMensagens(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Mensagem];
        });
        setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_negociacao',
        filter: `id=eq.${chat.id}`,
      }, (payload) => {
        setChat(prev => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chat?.id]);

  async function carregarChat() {
    try {
      const data = await apiCall(`/api/chat/${token}`);
      setChat(data);
      const msgs = await apiCall(`/api/chat/${token}/mensagens`);
      setMensagens(msgs || []);
      if (msgs?.length) ultimaMsgRef.current = msgs[msgs.length - 1].id;

      // Linkar usuario_id ao ORC se cliente logou após a anamnese
      const papelUrl = getPapelFromUrl();
      if (papelUrl === 'cliente' && data?.orc_id) {
        const contratante = getContratante();
        if (contratante?.id) {
          const { data: orc } = await supabase.from('orcs').select('usuario_id, nome_cliente').eq('id', data.orc_id).single();
          if (orc && !orc.usuario_id) {
            // Buscar perfil completo do contratante para pegar nome real
            const { data: perfil } = await supabase.from('usuarios').select('nome, cpf').eq('id', contratante.id).maybeSingle();
            await supabase.from('orcs').update({
              usuario_id: contratante.id,
              nome_cliente: perfil?.nome || contratante.nome || orc.nome_cliente,
            }).eq('id', data.orc_id);
          }
        }
      }
    } catch {
      setErro('Chat não encontrado ou link inválido.');
    }
  }

  async function buscarMensagens() {
    if (!token) return;
    try {
      const msgs = await apiCall(`/api/chat/${token}/mensagens`);
      if (!msgs?.length) return;
      const ultima = msgs[msgs.length - 1].id;
      if (ultima === ultimaMsgRef.current) return;
      ultimaMsgRef.current = ultima;
      setMensagens(msgs);
      setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
    } catch {}
  }

  async function buscarEstadoChat() {
    if (!token) return;
    try {
      const data = await apiCall(`/api/chat/${token}`);
      setChat(prev => prev ? { ...prev, status: data.status, finalizado_cliente: data.finalizado_cliente, finalizado_prestador: data.finalizado_prestador } : prev);
    } catch {}
  }

  async function enviarTexto() {
    const txt = input.trim();
    if (!txt || !papel || enviando) return;
    setInput('');
    setEnviando(true);
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Mensagem = {
      id: tempId, chat_id: chat?.id || '', remetente: papel,
      tipo: 'texto', conteudo: txt, criado_em: new Date().toISOString(),
    };
    setMensagens(prev => [...prev, tempMsg]);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50);
    try {
      const saved = await apiCall(`/api/chat/${token}/mensagens`, {
        method: 'POST', body: { remetente: papel, tipo: 'texto', conteudo: txt },
      });
      setMensagens(prev => {
        const semDup = prev.filter(m => m.id !== saved.id);
        return semDup.map(m => m.id === tempId ? { ...saved } : m);
      });
      ultimaMsgRef.current = saved.id;
    } catch {
      setInput(txt);
      setMensagens(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setEnviando(false);
    }
  }

  async function enviarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !papel) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const { url } = await apiCall(`/api/chat/${token}/upload`, {
          method: 'POST', body: { base64, mimeType: file.type, nomeArquivo: file.name },
        });
        await apiCall(`/api/chat/${token}/mensagens`, {
          method: 'POST', body: { remetente: papel, tipo: 'imagem', conteudo: url },
        });
        await buscarMensagens();
      } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function iniciarGravacao() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const { url } = await apiCall(`/api/chat/${token}/upload`, {
            method: 'POST', body: { base64, mimeType: 'audio/webm', nomeArquivo: 'audio.webm' },
          });
          await apiCall(`/api/chat/${token}/mensagens`, {
            method: 'POST', body: { remetente: papel, tipo: 'audio', conteudo: url },
          });
          await buscarMensagens();
        } catch {}
      };
      reader.readAsDataURL(blob);
    };
    mr.start();
    setMediaRecorder(mr);
    setGravando(true);
  }

  function pararGravacao() {
    mediaRecorder?.stop();
    setGravando(false);
    setMediaRecorder(null);
  }

  async function confirmarFinalizar() {
    if (!papel) return;
    setErroFinalizar('');
    try {
      const { chat: updated, ambosConfirmaram } = await apiCall(`/api/chat/${token}/finalizar`, {
        method: 'POST', body: { papel },
      });
      setChat(prev => prev ? { ...prev, ...updated } : prev);
      if (ambosConfirmaram) setPainelFinalizar(true);
    } catch (e: any) {
      setErroFinalizar(e.message || 'Erro ao finalizar. Tente novamente.');
    }
  }

  async function abrirFormContrato() {
    try {
      await apiCall(`/api/chat/${token}/status`, { method: 'PATCH', body: { status: 'elaborando_contrato' } });
      setChat(prev => prev ? { ...prev, status: 'elaborando_contrato' } : prev);
    } catch {}
    setPainelFinalizar(true);
  }

  async function gerarContrato() {
    if (!formulario.valor) { setErroFinalizar('Informe o valor combinado.'); return; }
    try {
      await apiCall(`/api/chat/${token}/contrato`, {
        method: 'POST',
        body: {
          valor: formulario.valor.replace(',', '.'),
          prazo: formulario.prazo || 'A combinar',
          garantia: formulario.garantia || '90 dias',
          pagamento: formulario.pagamento || 'A combinar',
          tipo: 'servico_seguro',
        },
      });
      setChat(prev => prev ? { ...prev, status: 'contrato_gerado' } : prev);
      setPainelFinalizar(false);
      window.location.href = `/contrato?orc=${chat?.orc_id}&papel=${papel}`;
    } catch (e: any) {
      setErroFinalizar(e.message || 'Erro ao gerar contrato.');
    }
  }

  function detectarValorNoChat() {
    const regex = /R\$\s?([\d.,]+)/i;
    for (let i = mensagens.length - 1; i >= 0; i--) {
      const match = mensagens[i].conteudo?.match(regex);
      if (match) return match[1].replace(',', '.');
    }
    return '';
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#ecebe7' }}>
        <div className="text-center bg-white rounded-[20px] p-8 shadow-[0_24px_60px_-24px_rgba(3,2,19,0.45)] max-w-sm w-full">
          <Shield className="w-10 h-10 mx-auto mb-4" style={{ color: '#030213' }} />
          <p className="font-bold text-[#030213] mb-1">Link inválido</p>
          <p className="text-sm" style={{ color: '#717182' }}>{erro}</p>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#ecebe7' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#030213', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!papel) {
    const clienteNome = chat.orcs.nome_cliente;
    const prestadorNome = chat.orcs.prestadores?.nome;
    const servico = chat.orcs.servicos?.titulo || chat.orcs.servico_nome;
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#ecebe7' }}>
        <div className="bg-white rounded-[20px] shadow-[0_24px_60px_-24px_rgba(3,2,19,0.45)] p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-[16px] bg-[#030213] flex items-center justify-center mx-auto mb-5">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-extrabold text-[#030213] mb-1">Quem é você?</h2>
          <p className="text-sm mb-1" style={{ color: '#717182' }}>{chat.orcs.codigo} — {servico}</p>
          <p className="text-xs mb-6" style={{ color: '#92400e', background: '#FEF3C7', padding: '6px 12px', borderRadius: 999, display: 'inline-block' }}>
            Use o link enviado pelo WhatsApp
          </p>
          <div className="flex flex-col gap-3 mt-2">
            <a href="?papel=cliente"
              className="w-full py-3 rounded-[12px] font-bold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: '#030213' }}>
              👤 Sou o cliente — {clienteNome}
            </a>
            <a href="?papel=prestador"
              className="w-full py-3 rounded-[12px] font-bold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: TEAL }}>
              👷 Sou o profissional — {prestadorNome}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const clienteNome = chat.orcs.nome_cliente || 'Cliente';
  const prestadorNome = chat.orcs.prestadores?.nome || 'Profissional';
  const meuNome = papel === 'cliente' ? clienteNome : prestadorNome;
  const outroNome = papel === 'cliente' ? prestadorNome : clienteNome;
  const servico = chat.orcs.servicos?.titulo || chat.orcs.servico_nome || 'Serviço';
  const jaConfirmou = papel === 'cliente' ? chat.finalizado_cliente : chat.finalizado_prestador;
  const outroConfirmou = papel === 'cliente' ? chat.finalizado_prestador : chat.finalizado_cliente;

  return (
    <div className="min-h-screen flex justify-center" style={{ background: '#ecebe7' }}>
      <div className="w-full max-w-[680px] flex flex-col min-h-screen" style={{ background: '#faf9f7' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }} className="sticky top-0 z-10">
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: '#030213' }}>
                    <Shield className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-extrabold text-sm" style={{ color: '#030213' }}>
                    {clienteNome} ↔ {prestadorNome}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#94a3b8' }}>
                  {servico} · <span className="font-mono">{chat.orcs.codigo}</span>
                </p>
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#94a3b8' }}>
                  <Lock className="w-2.5 h-2.5" /> Conversa registrada como evidência · você: <strong style={{ color: '#030213' }}>{meuNome}</strong>
                </p>
              </div>
            </div>
            {chat.orcs.resumo_anamnese && (
              <div className="mt-3 p-3 rounded-[12px] text-xs leading-relaxed" style={{ background: TEAL_LIGHT, color: '#030213' }}>
                <span className="font-bold block mb-1" style={{ color: TEAL_DARK }}>📋 Resumo da anamnese</span>
                {chat.orcs.resumo_anamnese}
              </div>
            )}
          </div>

          {/* Status pills */}
          <div className="flex gap-2 px-5 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {['conversando', 'orcamento_enviado', 'finalizado', 'contrato_gerado'].map(s => {
              const ativo = chat.status === s;
              return (
                <span
                  key={s}
                  className="rounded-full text-[11px] font-semibold px-3 py-1 flex-shrink-0"
                  style={ativo
                    ? { background: '#030213', color: '#fff' }
                    : { border: '1px solid rgba(0,0,0,0.1)', color: '#717182', background: '#fff' }}
                >
                  {s === 'conversando' ? '💬 Conversando'
                    : s === 'orcamento_enviado' ? '💰 Orçamento'
                    : s === 'finalizado' ? '✅ Finalizado'
                    : '📄 Contrato'}
                </span>
              );
            })}
          </div>
        </div>

        {/* Mensagens */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3">
          {mensagens.length === 0 && (
            <p className="text-center text-sm mt-10" style={{ color: '#94a3b8' }}>
              Nenhuma mensagem ainda. Inicie a conversa!
            </p>
          )}
          {mensagens.map(m => {
            const minha = m.remetente === papel;
            const nomeRemetente = m.remetente === 'cliente' ? clienteNome : prestadorNome;
            return (
              <div key={m.id} className={`flex flex-col ${minha ? 'items-end' : 'items-start'}`}>
                <span className="text-[11px] px-1 mb-1" style={{ color: '#94a3b8' }}>{nomeRemetente}</span>
                <div
                  className="max-w-[75%] text-[14px] leading-relaxed"
                  style={{
                    padding: '11px 15px',
                    borderRadius: 16,
                    ...(minha
                      ? { background: '#030213', color: '#fff', borderBottomRightRadius: 4 }
                      : { background: '#fff', color: '#030213', border: '1px solid rgba(0,0,0,0.08)', borderBottomLeftRadius: 4 }),
                  }}
                >
                  {m.tipo === 'texto' && <p className="whitespace-pre-wrap">{m.conteudo}</p>}
                  {m.tipo === 'imagem' && <img src={m.conteudo} alt="imagem" className="rounded-[12px] max-w-full" />}
                  {m.tipo === 'audio' && <audio controls src={m.conteudo} className="max-w-full" />}
                  <p className="text-[11px] mt-[5px]" style={{ color: minha ? 'rgba(255,255,255,0.5)' : '#94a3b8', textAlign: minha ? 'right' : 'left' }}>
                    {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        {chat.status === 'contrato_assinado' ? (
          <div style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)' }} className="px-5 py-6 text-center">
            <CheckCircle2 className="mx-auto mb-2" size={32} style={{ color: TEAL }} />
            <p className="font-bold text-[#030213]">Contrato assinado por ambas as partes!</p>
            <p className="text-sm mt-1 mb-4" style={{ color: '#717182' }}>O serviço está formalizado. Bom trabalho!</p>
            <a href={`/contrato?orc=${chat.orc_id}&papel=${papel}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[12px] font-bold text-sm text-white"
              style={{ background: '#030213' }}>
              <FileText size={16} /> Ver contrato
            </a>
          </div>
        ) : chat.status === 'contrato_gerado' ? (
          <div style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)' }} className="px-5 py-6 text-center">
            <CheckCircle2 className="mx-auto mb-2" size={32} style={{ color: TEAL }} />
            <p className="font-bold text-[#030213]">Contrato gerado!</p>
            <p className="text-sm mt-1 mb-4" style={{ color: '#717182' }}>Clique para assinar e formalizar o serviço.</p>
            <a href={`/contrato?orc=${chat.orc_id}&papel=${papel}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[12px] font-bold text-sm text-white"
              style={{ background: '#030213' }}>
              <FileText size={16} /> Assinar contrato
            </a>
          </div>
        ) : chat.status === 'elaborando_contrato' ? (
          <div style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)' }} className="px-5 py-6 text-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: TEAL, borderTopColor: 'transparent' }} />
            <p className="font-bold text-[#030213]">Aguardando {outroNome}...</p>
            <p className="text-sm mt-1 mb-4" style={{ color: '#717182' }}>{outroNome} está redigindo o contrato.</p>
            <a href={`/contrato?orc=${chat.orc_id}&papel=${papel}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] font-semibold text-sm text-white"
              style={{ background: '#030213' }}>
              <FileText size={14} /> Ir para o contrato
            </a>
          </div>
        ) : chat.status === 'finalizado' ? (
          <div style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)' }} className="px-5 py-6 text-center">
            <CheckCircle2 className="mx-auto mb-2" size={32} style={{ color: TEAL }} />
            <p className="font-bold text-[#030213]">Negociação finalizada!</p>
            <p className="text-sm mt-1 mb-4" style={{ color: '#717182' }}>Clique para redigir e assinar o contrato.</p>
            <button onClick={abrirFormContrato}
              className="px-6 py-3 rounded-[12px] font-bold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: '#030213' }}>
              <FileText className="inline mr-2" size={16} />Redigir e Assinar Contrato
            </button>
          </div>
        ) : (
          <div style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)' }} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <button
                onClick={confirmarFinalizar}
                disabled={jaConfirmou}
                className="text-xs px-4 py-1.5 rounded-full font-semibold transition-all"
                style={jaConfirmou
                  ? { background: TEAL_LIGHT, color: TEAL_DARK, border: `1px solid ${TEAL}` }
                  : { background: '#fff', color: '#64748b', border: '1px solid #e2e8f0' }
                }
              >
                {jaConfirmou ? '✅ Você confirmou finalizar' : '✅ Finalizar negociação'}
              </button>
              {outroConfirmou && !jaConfirmou && (
                <span className="text-xs font-medium" style={{ color: '#92400e' }}>
                  ⏳ {outroNome} já confirmou — aguarda você!
                </span>
              )}
            </div>
            {erroFinalizar && <p className="text-xs text-red-500 mb-2">{erroFinalizar}</p>}
            <div className="flex gap-2 items-end">
              <input type="file" accept="image/*" ref={fileRef} onChange={enviarImagem} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-shrink-0 flex items-center justify-center transition-colors"
                style={{ width: 40, height: 40, borderRadius: 11, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#717182' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.985 0.001 0)')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <Image size={18} />
              </button>
              <button
                onMouseDown={iniciarGravacao}
                onMouseUp={pararGravacao}
                onTouchStart={iniciarGravacao}
                onTouchEnd={pararGravacao}
                className="flex-shrink-0 flex items-center justify-center transition-colors"
                style={{
                  width: 40, height: 40, borderRadius: 11,
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: gravando ? '#FEF2F2' : '#fff',
                  color: gravando ? '#dc2626' : '#717182',
                }}
              >
                {gravando ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTexto(); } }}
                placeholder={`Mensagem para ${outroNome}...`}
                rows={1}
                className="flex-1 resize-none text-sm outline-none"
                style={{
                  background: 'oklch(0.985 0.001 0)',
                  borderRadius: 13,
                  padding: '10px 14px',
                  border: 'none',
                }}
              />
              <button
                onClick={enviarTexto}
                disabled={!input.trim() || enviando}
                className="flex-shrink-0 flex items-center justify-center transition-opacity disabled:opacity-40"
                style={{ width: 44, height: 44, borderRadius: 13, background: '#030213', color: '#fff' }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Modal contrato */}
        {painelFinalizar && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-[680px]" style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24 }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-extrabold text-[#030213] text-lg">Detalhes do contrato</h3>
                <button onClick={() => setPainelFinalizar(false)} className="text-[#94a3b8] hover:text-[#030213]">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <InputLabel>Valor combinado *</InputLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#94a3b8' }}>R$</span>
                    <input
                      type="text"
                      value={formulario.valor}
                      onChange={e => setFormulario(p => ({ ...p, valor: e.target.value }))}
                      placeholder={detectarValorNoChat() || '0,00'}
                      className="w-full pl-9 pr-3 py-2.5 text-sm outline-none"
                      style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}
                      onFocus={e => (e.target.style.borderColor = '#030213')}
                      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                    />
                  </div>
                </div>
                <div>
                  <InputLabel>Prazo de conclusão</InputLabel>
                  <StyledInput value={formulario.prazo} onChange={(e: any) => setFormulario(p => ({ ...p, prazo: e.target.value }))} placeholder="Ex: 2 dias úteis" />
                </div>
                <div>
                  <InputLabel>Garantia</InputLabel>
                  <StyledInput value={formulario.garantia} onChange={(e: any) => setFormulario(p => ({ ...p, garantia: e.target.value }))} placeholder="Ex: 90 dias" />
                </div>
                <div>
                  <InputLabel>Forma de pagamento</InputLabel>
                  <StyledInput value={formulario.pagamento} onChange={(e: any) => setFormulario(p => ({ ...p, pagamento: e.target.value }))} placeholder="Ex: 50% entrada, 50% na conclusão" />
                </div>
              </div>
              {erroFinalizar && <p className="text-xs text-red-500 mt-3">{erroFinalizar}</p>}
              <button
                onClick={gerarContrato}
                className="mt-5 w-full py-3.5 rounded-[12px] font-bold text-[15px] text-white transition-opacity hover:opacity-90"
                style={{ background: '#030213' }}
              >
                Gerar e Assinar Contrato
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
