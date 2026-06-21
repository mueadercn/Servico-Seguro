import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { Send, CheckCircle2, FileText, Image, X, Mic, MicOff } from 'lucide-react';
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
    servicos?: { titulo: string };
    prestadores: { id: string; nome: string; telefone: string };
  };
}

// Lê ?papel= da URL de forma síncrona para evitar flash da tela de seleção
function getPapelFromUrl(): Papel {
  const p = new URLSearchParams(window.location.search).get('papel');
  return p === 'cliente' || p === 'prestador' ? p : null;
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
  const [mostrarResumo, setMostrarResumo] = useState(false);
  const [painelFinalizar, setPainelFinalizar] = useState(false);
  const [formulario, setFormulario] = useState({ valor: '', prazo: '', garantia: '', pagamento: '' });
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ultimaMsgRef = useRef<string>('');

  useEffect(() => {
    if (!token) return;
    carregarChat();
  }, [token]);

  // Polling mensagens a cada 3s + estado do chat a cada 5s
  useEffect(() => {
    if (!chat?.id) return;
    const intMsg = setInterval(buscarMensagens, 3000);
    const intChat = setInterval(buscarEstadoChat, 5000);
    return () => { clearInterval(intMsg); clearInterval(intChat); };
  }, [chat?.id]);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [mensagens]);

  // Supabase Realtime como complemento (funciona após RLS desabilitado)
  useEffect(() => {
    if (!chat?.id) return;
    const channel = supabase
      .channel(`chat-${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_mensagens',
        filter: `chat_id=eq.${chat.id}`,
      }, (payload) => {
        setMensagens(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Mensagem];
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

  async function carregarChat() {
    try {
      const data = await apiCall(`/api/chat/${token}`);
      setChat(data);
      const msgs = await apiCall(`/api/chat/${token}/mensagens`);
      setMensagens(msgs || []);
      if (msgs?.length) ultimaMsgRef.current = msgs[msgs.length - 1].id;
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
    } catch { /* silencia */ }
  }

  async function buscarEstadoChat() {
    if (!token) return;
    try {
      const data = await apiCall(`/api/chat/${token}`);
      setChat(prev => prev ? { ...prev, status: data.status, finalizado_cliente: data.finalizado_cliente, finalizado_prestador: data.finalizado_prestador } : prev);
    } catch { /* silencia */ }
  }

  async function enviarTexto() {
    const txt = input.trim();
    if (!txt || !papel || enviando) return;
    setInput('');
    setEnviando(true);
    // Atualização otimista — aparece imediatamente
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Mensagem = {
      id: tempId, chat_id: chat?.id || '', remetente: papel,
      tipo: 'texto', conteudo: txt, criado_em: new Date().toISOString(),
    };
    setMensagens(prev => [...prev, tempMsg]);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50);
    try {
      const saved = await apiCall(`/api/chat/${token}/mensagens`, {
        method: 'POST',
        body: { remetente: papel, tipo: 'texto', conteudo: txt },
      });
      // Substitui a mensagem temporária pelo ID real
      setMensagens(prev => prev.map(m => m.id === tempId ? { ...saved } : m));
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
            method: 'POST', body: { base64, mimeType: 'audio/webm', nomeArquivo: 'audio.webm' },
          });
          await apiCall(`/api/chat/${token}/mensagens`, {
            method: 'POST', body: { remetente: papel, tipo: 'audio', conteudo: url },
          });
          await buscarMensagens();
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

  async function confirmarFinalizar() {
    if (!papel) return;
    setErroFinalizar('');
    try {
      const { chat: updated, ambosConfirmaram } = await apiCall(`/api/chat/${token}/finalizar`, {
        method: 'POST',
        body: { papel },
      });
      setChat(prev => prev ? { ...prev, ...updated } : prev);
      if (ambosConfirmaram) setPainelFinalizar(true);
    } catch (e: any) {
      setErroFinalizar(e.message || 'Erro ao finalizar. Tente novamente.');
    }
  }

  async function abrirFormContrato() {
    // Avisa o outro lado que o contrato está sendo elaborado
    try {
      await apiCall(`/api/chat/${token}/status`, { method: 'PATCH', body: { status: 'elaborando_contrato' } });
      setChat(prev => prev ? { ...prev, status: 'elaborando_contrato' } : prev);
    } catch { /* continua mesmo se falhar */ }
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
          tipo: 'carta_aceite',
        },
      });
      setChat(prev => prev ? { ...prev, status: 'contrato_gerado' } : prev);
      setPainelFinalizar(false);
      // Redireciona imediatamente para assinar
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Logo />
          <p className="mt-6 text-red-500 font-medium">{erro}</p>
          <p className="mt-2 text-sm text-gray-400">Verifique se o link está correto.</p>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Se não há papel na URL e não conseguiu detectar, pede para escolher
  if (!papel) {
    const clienteNome = chat.orcs.nome_cliente;
    const prestadorNome = chat.orcs.prestadores?.nome;
    const servico = chat.orcs.servicos?.titulo || chat.orcs.servico_nome;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <Logo />
          <h2 className="mt-6 text-xl font-bold text-gray-800">Quem é você nessa conversa?</h2>
          <p className="mt-2 text-sm text-gray-500">{chat.orcs.codigo} — {servico}</p>
          <p className="text-xs text-amber-600 mt-1">Use o link enviado pelo WhatsApp para entrar com o papel correto.</p>
          <div className="mt-8 flex flex-col gap-3">
            <a href={`?papel=cliente`}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
              👤 Sou o cliente — {clienteNome}
            </a>
            <a href={`?papel=prestador`}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition">
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Logo />
              <p className="mt-1 text-sm font-bold text-gray-800">
                {clienteNome} ↔ {prestadorNome}
              </p>
              <p className="text-xs text-gray-500">{servico} · {chat.orcs.codigo}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Você está como: <span className="font-semibold text-blue-600">{meuNome}</span>
              </p>
              <p className="text-xs text-gray-300">🔒 Conversa registrada e válida como evidência</p>
            </div>
            <button onClick={() => setMostrarResumo(!mostrarResumo)}
              className="shrink-0 text-xs text-blue-600 underline mt-1 whitespace-nowrap">
              {mostrarResumo ? 'Fechar' : 'Ver resumo'}
            </button>
          </div>
          {mostrarResumo && (
            <div className="mt-3 p-3 bg-blue-50 rounded-xl text-xs text-gray-700 whitespace-pre-wrap">
              {chat.orcs.resumo_anamnese || 'Sem resumo disponível.'}
            </div>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl w-full mx-auto space-y-2">
        {mensagens.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-10">
            Nenhuma mensagem ainda. Inicie a conversa!
          </p>
        )}
        {mensagens.map(m => {
          const minha = m.remetente === papel;
          const nomeRemetente = m.remetente === 'cliente' ? clienteNome : prestadorNome;
          return (
            <div key={m.id} className={`flex flex-col ${minha ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-gray-400 px-1 mb-0.5">{nomeRemetente}</span>
              <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2 text-sm shadow-sm ${
                minha ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border'
              }`}>
                {m.tipo === 'texto' && <p className="whitespace-pre-wrap">{m.conteudo}</p>}
                {m.tipo === 'imagem' && <img src={m.conteudo} alt="imagem" className="rounded-xl max-w-full" />}
                {m.tipo === 'audio' && <audio controls src={m.conteudo} className="max-w-full" />}
                <p className={`text-xs mt-1 ${minha ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé */}
      {chat.status === 'contrato_gerado' ? (
        <div className="bg-white border-t px-4 py-6 text-center max-w-2xl w-full mx-auto">
          <CheckCircle2 className="mx-auto text-green-500 mb-2" size={32} />
          <p className="font-semibold text-gray-800">Contrato gerado!</p>
          <p className="text-sm text-gray-500 mt-1">Ambas as partes precisam assinar para formalizar.</p>
          <a href={`/contrato?orc=${chat.orc_id}&papel=${papel}`}
            className="mt-4 inline-block px-6 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition">
            <FileText className="inline mr-2" size={16} />Assinar contrato
          </a>
        </div>
      ) : chat.status === 'elaborando_contrato' && !painelFinalizar ? (
        <div className="bg-white border-t px-4 py-6 text-center max-w-2xl w-full mx-auto">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Aguardando {outroNome}...</p>
          <p className="text-sm text-gray-400 mt-1">{outroNome} está redigindo e assinando o contrato. Você poderá assinar em seguida.</p>
        </div>
      ) : chat.status === 'finalizado' || chat.status === 'elaborando_contrato' ? (
        <div className="bg-white border-t px-4 py-6 text-center max-w-2xl w-full mx-auto">
          <CheckCircle2 className="mx-auto text-green-500 mb-2" size={32} />
          <p className="font-semibold text-gray-800">Negociação finalizada!</p>
          <p className="text-sm text-gray-500 mt-1">Clique para redigir e assinar o contrato.</p>
          <button onClick={abrirFormContrato}
            className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">
            <FileText className="inline mr-2" size={16} />Redigir e Assinar Contrato
          </button>
        </div>
      ) : (
        <div className="bg-white border-t px-4 py-3 max-w-2xl w-full mx-auto">
          <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
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
              <span className="text-xs text-amber-600 font-medium">
                ⏳ {outroNome} já confirmou — aguarda você!
              </span>
            )}
          </div>
          {erroFinalizar && (
            <p className="text-xs text-red-500 mb-2">{erroFinalizar}</p>
          )}
          <div className="flex gap-2 items-end">
            <input type="file" accept="image/*" ref={fileRef} onChange={enviarImagem} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="p-2 text-gray-400 hover:text-blue-500 transition">
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
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTexto(); } }}
              placeholder={`Mensagem para ${outroNome}...`}
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

      {/* Modal — contrato */}
      {painelFinalizar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Detalhes do contrato</h3>
              <button onClick={() => setPainelFinalizar(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Valor combinado *</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">R$</span>
                  <input type="text" value={formulario.valor}
                    onChange={e => setFormulario(p => ({ ...p, valor: e.target.value }))}
                    placeholder={detectarValorNoChat() || '0,00'}
                    className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Prazo de conclusão</label>
                <input type="text" value={formulario.prazo}
                  onChange={e => setFormulario(p => ({ ...p, prazo: e.target.value }))}
                  placeholder="Ex: 2 dias úteis"
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Garantia</label>
                <input type="text" value={formulario.garantia}
                  onChange={e => setFormulario(p => ({ ...p, garantia: e.target.value }))}
                  placeholder="Ex: 90 dias"
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Forma de pagamento</label>
                <input type="text" value={formulario.pagamento}
                  onChange={e => setFormulario(p => ({ ...p, pagamento: e.target.value }))}
                  placeholder="Ex: 50% entrada, 50% na conclusão"
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            {erroFinalizar && <p className="text-xs text-red-500 mt-2">{erroFinalizar}</p>}
            <button onClick={gerarContrato}
              className="mt-5 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">
              Gerar contrato
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
