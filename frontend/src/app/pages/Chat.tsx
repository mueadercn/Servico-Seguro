import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { Send, CheckCircle2, Clock, FileText, DollarSign, Mic, MicOff, Image, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiCall } from '../../lib/supabase';
import { Logo } from '../components/Logo';

type Papel = 'cliente' | 'prestador' | null;
type StatusChat = 'conversando' | 'aguardando_orcamento' | 'orcamento_enviado' | 'finalizado';

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
    prestadores: { id: string; nome: string; telefone: string };
  };
}

const STATUS_LABELS: Record<StatusChat, string> = {
  conversando: '💬 Conversando',
  aguardando_orcamento: '📋 Aguardando orçamento',
  orcamento_enviado: '💰 Orçamento enviado',
  finalizado: '✅ Finalizado',
};

export function Chat() {
  const { token } = useParams<{ token: string }>();
  const [chat, setChat] = useState<ChatData | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [papel, setPapel] = useState<Papel>(null);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [mostrarResumo, setMostrarResumo] = useState(false);
  const [painelFinalizar, setPainelFinalizar] = useState(false);
  const [formulario, setFormulario] = useState({ valor: '', prazo: '', garantia: '', pagamento: '' });
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!token) return;
    carregarChat();
  }, [token]);

  useEffect(() => {
    if (!chat) return;

    // Supabase Realtime — escuta novas mensagens
    const channel = supabase
      .channel(`chat-${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_mensagens',
        filter: `chat_id=eq.${chat.id}`,
      }, (payload) => {
        setMensagens(prev => {
          const existe = prev.some(m => m.id === payload.new.id);
          return existe ? prev : [...prev, payload.new as Mensagem];
        });
        setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_negociacao',
        filter: `id=eq.${chat.id}`,
      }, (payload) => {
        setChat(prev => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chat?.id]);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [mensagens]);

  async function carregarChat() {
    try {
      const data = await apiCall(`/api/chat/${token}`);
      setChat(data);

      const msgs = await apiCall(`/api/chat/${token}/mensagens`);
      setMensagens(msgs);

      // Detectar papel pela URL ou localStorage
      const papelSalvo = localStorage.getItem(`chat_papel_${token}`) as Papel;
      if (papelSalvo) setPapel(papelSalvo);
    } catch {
      setErro('Chat não encontrado ou link inválido.');
    }
  }

  function escolherPapel(p: Papel) {
    setPapel(p);
    localStorage.setItem(`chat_papel_${token}`, p!);
  }

  async function enviarTexto() {
    const txt = input.trim();
    if (!txt || !papel || enviando) return;
    setInput('');
    setEnviando(true);
    try {
      await apiCall(`/api/chat/${token}/mensagens`, {
        method: 'POST',
        body: { remetente: papel, tipo: 'texto', conteudo: txt },
      });
    } catch {
      setInput(txt);
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
          method: 'POST',
          body: { base64, mimeType: file.type, nomeArquivo: file.name },
        });
        await apiCall(`/api/chat/${token}/mensagens`, {
          method: 'POST',
          body: { remetente: papel, tipo: 'imagem', conteudo: url },
        });
      } catch { /* silencia */ }
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
            method: 'POST',
            body: { base64, mimeType: 'audio/webm', nomeArquivo: 'audio.webm' },
          });
          await apiCall(`/api/chat/${token}/mensagens`, {
            method: 'POST',
            body: { remetente: papel, tipo: 'audio', conteudo: url },
          });
        } catch { /* silencia */ }
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

  async function mudarStatus(novoStatus: StatusChat) {
    try {
      const updated = await apiCall(`/api/chat/${token}/status`, {
        method: 'PATCH',
        body: { status: novoStatus },
      });
      setChat(prev => prev ? { ...prev, ...updated } : prev);
    } catch { /* silencia */ }
  }

  async function confirmarFinalizar() {
    if (!papel) return;
    try {
      const { chat: updated, ambosConfirmaram } = await apiCall(`/api/chat/${token}/finalizar`, {
        method: 'POST',
        body: { papel },
      });
      setChat(prev => prev ? { ...prev, ...updated } : prev);
      if (ambosConfirmaram) setPainelFinalizar(true);
    } catch { /* silencia */ }
  }

  function detectarValorNoChat() {
    const regex = /R\$\s?([\d.,]+)/i;
    for (let i = mensagens.length - 1; i >= 0; i--) {
      const match = mensagens[i].conteudo.match(regex);
      if (match) return match[1].replace(',', '.');
    }
    return '';
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Logo />
          <p className="mt-6 text-red-500">{erro}</p>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Carregando chat...</p>
      </div>
    );
  }

  if (!papel) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <Logo />
          <h2 className="mt-6 text-xl font-bold text-gray-800">Quem é você nessa conversa?</h2>
          <p className="mt-2 text-sm text-gray-500">{chat.orcs.codigo} — {chat.orcs.servico_nome}</p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => escolherPapel('cliente')}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              👤 Sou o cliente — {chat.orcs.nome_cliente}
            </button>
            <button
              onClick={() => escolherPapel('prestador')}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition"
            >
              👷 Sou o profissional — {chat.orcs.prestadores?.nome}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const jaConfirmou = papel === 'cliente' ? chat.finalizado_cliente : chat.finalizado_prestador;
  const outroConfirmou = papel === 'cliente' ? chat.finalizado_prestador : chat.finalizado_cliente;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Logo />
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-800 truncate">
              {chat.orcs.nome_cliente} ↔ {chat.orcs.prestadores?.nome}
            </p>
            <p className="text-xs text-gray-500">{chat.orcs.servico_nome} · {chat.orcs.codigo}</p>
            <p className="text-xs text-gray-400 mt-0.5">🔒 Esta conversa fica registrada e pode ser usada no contrato</p>
          </div>
          <button
            onClick={() => setMostrarResumo(!mostrarResumo)}
            className="shrink-0 text-xs text-blue-600 underline mt-1"
          >
            Ver resumo
          </button>
        </div>

        {/* Resumo da anamnese */}
        {mostrarResumo && (
          <div className="max-w-2xl mx-auto mt-3 p-3 bg-blue-50 rounded-xl text-xs text-gray-700 whitespace-pre-wrap">
            {chat.orcs.resumo_anamnese || 'Sem resumo disponível.'}
          </div>
        )}

        {/* Botões de status */}
        {chat.status !== 'finalizado' && (
          <div className="max-w-2xl mx-auto mt-3 flex gap-2 flex-wrap">
            {(['conversando', 'aguardando_orcamento', 'orcamento_enviado'] as StatusChat[]).map(s => (
              <button
                key={s}
                onClick={() => mudarStatus(s)}
                className={`text-xs px-3 py-1 rounded-full border transition ${
                  chat.status === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl w-full mx-auto space-y-3">
        {mensagens.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">
            Nenhuma mensagem ainda. Comece a conversa!
          </p>
        )}
        {mensagens.map(m => {
          const minha = m.remetente === papel;
          return (
            <div key={m.id} className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  minha ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'
                }`}
              >
                {m.tipo === 'texto' && <p className="whitespace-pre-wrap">{m.conteudo}</p>}
                {m.tipo === 'imagem' && (
                  <img src={m.conteudo} alt="imagem" className="rounded-xl max-w-full" />
                )}
                {m.tipo === 'audio' && (
                  <audio controls src={m.conteudo} className="max-w-full" />
                )}
                <p className={`text-xs mt-1 ${minha ? 'text-blue-200' : 'text-gray-400'}`}>
                  {m.remetente === 'cliente' ? '👤' : '👷'}{' '}
                  {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé — input ou status finalizado */}
      {chat.status === 'finalizado' ? (
        <div className="bg-white border-t px-4 py-6 text-center">
          <CheckCircle2 className="mx-auto text-green-500 mb-2" size={32} />
          <p className="font-semibold text-gray-800">Negociação finalizada!</p>
          <p className="text-sm text-gray-500 mt-1">Acesse o contrato para formalizar o serviço.</p>
          <a
            href={`/contrato?orc=${chat.orc_id}`}
            className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            Gerar contrato
          </a>
        </div>
      ) : (
        <div className="bg-white border-t px-4 py-3 max-w-2xl w-full mx-auto">
          {/* Botão finalizar */}
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={confirmarFinalizar}
              disabled={jaConfirmou}
              className={`text-xs px-4 py-1.5 rounded-full border font-semibold transition ${
                jaConfirmou
                  ? 'bg-green-100 text-green-700 border-green-300 cursor-default'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-500 hover:text-green-600'
              }`}
            >
              {jaConfirmou ? '✅ Você confirmou finalizar' : '✅ Finalizar negociação'}
            </button>
            {outroConfirmou && !jaConfirmou && (
              <span className="text-xs text-amber-600">⏳ O outro lado já confirmou — aguarda você!</span>
            )}
          </div>

          {/* Input de mensagem */}
          <div className="flex gap-2 items-end">
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={enviarImagem}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2 text-gray-400 hover:text-blue-500 transition"
            >
              <Image size={20} />
            </button>
            <button
              onMouseDown={iniciarGravacao}
              onMouseUp={pararGravacao}
              onTouchStart={iniciarGravacao}
              onTouchEnd={pararGravacao}
              className={`p-2 transition ${gravando ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-blue-500'}`}
            >
              {gravando ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTexto(); }
              }}
              placeholder="Digite uma mensagem..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={enviarTexto}
              disabled={!input.trim() || enviando}
              className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Painel lateral — formulário de fechamento */}
      {painelFinalizar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Detalhes do serviço</h3>
              <button onClick={() => setPainelFinalizar(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Valor combinado</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">R$</span>
                  <input
                    type="text"
                    value={formulario.valor}
                    onChange={e => setFormulario(p => ({ ...p, valor: e.target.value }))}
                    placeholder={detectarValorNoChat() || '0,00'}
                    className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Prazo de conclusão</label>
                <input
                  type="text"
                  value={formulario.prazo}
                  onChange={e => setFormulario(p => ({ ...p, prazo: e.target.value }))}
                  placeholder="Ex: 2 dias úteis"
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Garantia</label>
                <input
                  type="text"
                  value={formulario.garantia}
                  onChange={e => setFormulario(p => ({ ...p, garantia: e.target.value }))}
                  placeholder="Ex: 90 dias"
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Forma de pagamento</label>
                <input
                  type="text"
                  value={formulario.pagamento}
                  onChange={e => setFormulario(p => ({ ...p, pagamento: e.target.value }))}
                  placeholder="Ex: 50% entrada, 50% na conclusão"
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <a
              href={`/contrato?orc=${chat.orc_id}&valor=${encodeURIComponent(formulario.valor)}&prazo=${encodeURIComponent(formulario.prazo)}&garantia=${encodeURIComponent(formulario.garantia)}&pagamento=${encodeURIComponent(formulario.pagamento)}`}
              className="mt-5 block w-full text-center py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
            >
              Gerar contrato
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
