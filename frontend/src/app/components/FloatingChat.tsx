import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { MessageSquare, X, ExternalLink, ChevronDown } from 'lucide-react';
import { getPrestador, getContratante, apiCall } from '../../lib/supabase';

const STATUS_LABEL: Record<string, string> = {
  conversando: 'Conversando',
  aguardando_orcamento: 'Aguardando orçamento',
  orcamento_enviado: 'Orçamento enviado',
  finalizado: 'Finalizado',
  elaborando_contrato: 'Elaborando contrato',
  contrato_gerado: 'Contrato gerado',
};

const STATUS_COLOR: Record<string, string> = {
  conversando: 'bg-blue-100 text-blue-700',
  aguardando_orcamento: 'bg-amber-100 text-amber-700',
  orcamento_enviado: 'bg-purple-100 text-purple-700',
  finalizado: 'bg-green-100 text-green-700',
  elaborando_contrato: 'bg-orange-100 text-orange-700',
  contrato_gerado: 'bg-green-100 text-green-700',
};

export function FloatingChat() {
  const location = useLocation();
  const [aberto, setAberto] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const prestador = getPrestador();
  const contratante = getContratante();
  const papel = prestador ? 'prestador' : contratante ? 'cliente' : null;
  const userId = prestador?.id || contratante?.id;

  // Não mostrar na página de chat, avaliação ou biometria
  const rotasIgnoradas = ['/chat/', '/avaliar/', '/biometria', '/contrato'];
  const esconder = rotasIgnoradas.some(r => location.pathname.startsWith(r));

  useEffect(() => {
    if (!papel || !userId || esconder) return;
    buscarChats();
    const interval = setInterval(buscarChats, 30000);
    return () => clearInterval(interval);
  }, [userId, papel, esconder]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [aberto]);

  async function buscarChats() {
    try {
      const endpoint = papel === 'prestador'
        ? `/api/chat/prestador/${userId}`
        : `/api/chat/cliente/${userId}`;
      const data = await apiCall(endpoint);
      setChats(data || []);
    } catch {}
  }

  if (!papel || esconder) return null;

  const chatsAtivos = chats.filter(c =>
    !['contrato_gerado'].includes(c.status)
  );
  const count = chatsAtivos.length;

  return (
    <div className="fixed bottom-5 right-5 z-50" ref={panelRef}>
      {/* Painel de chats */}
      {aberto && (
        <div className="mb-3 w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col"
          style={{ maxHeight: 'min(480px, calc(100vh - 120px))' }}>
          {/* Header */}
          <div className="px-4 py-3 bg-primary flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-white" />
              <span className="text-white font-bold text-sm">Negociações</span>
              {count > 0 && (
                <span className="bg-white text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </div>
            <button onClick={() => setAberto(false)} className="text-white/70 hover:text-white transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {chats.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>Nenhuma conversa ainda.</p>
              </div>
            ) : (
              chats.map((c: any) => {
                const titulo = c.orcs?.servicos?.titulo || c.orcs?.servico_nome || 'Serviço';
                const outroNome = papel === 'prestador'
                  ? (c.orcs?.nome_cliente || 'Cliente')
                  : (c.orcs?.prestadores?.nome || 'Profissional');
                const chatUrl = `/chat/${c.link_token}?papel=${papel}`;
                const isAtivo = !['contrato_gerado'].includes(c.status);

                return (
                  <a
                    key={c.id}
                    href={chatUrl}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition border-b border-border/50 last:border-b-0"
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isAtivo ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-gray-800 truncate">{outroNome}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-1">{titulo}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{c.orcs?.codigo}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setAberto(!aberto)}
        className="w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center relative"
        aria-label="Negociações"
      >
        {aberto ? (
          <ChevronDown className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
        {!aberto && count > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
    </div>
  );
}
