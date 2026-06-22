import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { MessageSquare, X, ArrowUpRight, ChevronDown } from 'lucide-react';
import { getPrestador, getContratante, apiCall } from '../../lib/supabase';

const TEAL = 'oklch(0.6 0.118 184.704)';
const TEAL_LIGHT = 'oklch(0.95 0.03 184)';
const TEAL_DARK = 'oklch(0.45 0.1 184)';

const STATUS_LABEL: Record<string, string> = {
  conversando: 'Conversando',
  aguardando_orcamento: 'Aguardando orçamento',
  orcamento_enviado: 'Orçamento enviado',
  finalizado: 'Finalizado',
  elaborando_contrato: 'Elaborando contrato',
  contrato_gerado: 'Contrato gerado',
};

function statusStyle(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    conversando: { background: '#E6F1FB', color: '#0C447C' },
    aguardando_orcamento: { background: '#FEF3C7', color: '#92400e' },
    orcamento_enviado: { background: '#EEEDFE', color: '#3C3489' },
    finalizado: { background: TEAL_LIGHT, color: TEAL_DARK },
    elaborando_contrato: { background: '#EEEDFE', color: '#26215C' },
    contrato_gerado: { background: TEAL_LIGHT, color: TEAL_DARK },
  };
  return map[status] || { background: '#f1f5f9', color: '#64748b' };
}

const CATEGORY_BG = [
  'oklch(0.91 0.05 85)',
  'oklch(0.91 0.05 220)',
  'oklch(0.92 0.05 25)',
  'oklch(0.91 0.05 264)',
  'oklch(0.92 0.05 184)',
  'oklch(0.91 0.05 40)',
];

function avatarBg(index: number) {
  return CATEGORY_BG[index % CATEGORY_BG.length];
}

export function FloatingChat() {
  const location = useLocation();
  const [aberto, setAberto] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const prestador = getPrestador();
  const contratante = getContratante();
  const papel = prestador ? 'prestador' : contratante ? 'cliente' : null;
  const userId = prestador?.id || contratante?.id;

  const rotasIgnoradas = ['/chat/', '/avaliar/', '/biometria', '/contrato'];
  const esconder = rotasIgnoradas.some(r => location.pathname.startsWith(r));

  useEffect(() => {
    if (!papel || !userId || esconder) return;
    buscarChats();
    const interval = setInterval(buscarChats, 30000);
    return () => clearInterval(interval);
  }, [userId, papel, esconder]);

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

  const chatsAtivos = chats.filter(c => !['contrato_gerado'].includes(c.status));
  const count = chatsAtivos.length;

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={panelRef}>
      {/* Painel */}
      {aberto && (
        <div
          className="mb-3 overflow-hidden flex flex-col"
          style={{
            width: 'min(384px, calc(100vw - 3rem))',
            maxHeight: 'min(580px, calc(100vh - 120px))',
            borderRadius: 20,
            background: '#fff',
            boxShadow: '0 24px 64px -20px rgba(3,2,19,0.45)',
          }}
        >
          {/* Header */}
          <div style={{ background: '#030213', padding: '18px' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">Negociações</span>
                {count > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: TEAL, color: '#fff' }}>
                    {count}
                  </span>
                )}
              </div>
              <button onClick={() => setAberto(false)} className="text-white/60 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {chats.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm" style={{ color: '#717182' }}>Nenhuma conversa ainda.</p>
              </div>
            ) : (
              chats.map((c: any, idx: number) => {
                const titulo = c.orcs?.servicos?.titulo || c.orcs?.servico_nome || 'Serviço';
                const outroNome = papel === 'prestador'
                  ? (c.orcs?.nome_cliente || 'Cliente')
                  : (c.orcs?.prestadores?.nome || 'Profissional');
                const chatUrl = `/chat/${c.link_token}?papel=${papel}`;
                const iniciais = outroNome.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                return (
                  <a
                    key={c.id}
                    href={chatUrl}
                    className="flex items-center gap-3 transition-colors"
                    style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.985 0.001 0)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      className="flex-shrink-0 flex items-center justify-center font-bold text-sm"
                      style={{ width: 44, height: 44, borderRadius: 13, background: avatarBg(idx), color: '#030213' }}
                    >
                      {iniciais}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-sm truncate" style={{ color: '#030213' }}>{outroNome}</span>
                        {count > 0 && chatsAtivos.some(a => a.id === c.id) && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: '#030213' }}>
                            1
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate" style={{ color: '#717182' }}>{titulo}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[11px]" style={{ color: '#94a3b8' }}>{c.orcs?.codigo}</span>
                        <span
                          className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                          style={statusStyle(c.status)}
                        >
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#94a3b8' }} />
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
        aria-label="Negociações"
        className="relative flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{
          width: 60, height: 60, borderRadius: '50%',
          background: '#030213', color: '#fff',
          boxShadow: '0 8px 32px -8px rgba(3,2,19,0.5)',
        }}
      >
        {aberto ? <ChevronDown className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!aberto && count > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center text-white text-[10px] font-bold"
            style={{ width: 20, height: 20, borderRadius: '50%', background: '#dc2626', border: '2px solid #fff' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
    </div>
  );
}
