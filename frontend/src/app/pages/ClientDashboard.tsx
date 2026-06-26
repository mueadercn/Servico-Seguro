import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { LayoutDashboard, ClipboardList, FileText, Star, User, LogOut, Plus, Clock, CheckCircle2, Menu } from 'lucide-react';
import { supabase, getContratante, logout } from '../../lib/supabase';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orcamentos', label: 'Meus Serviços', icon: ClipboardList },
  { id: 'contratos', label: 'Contratos', icon: FileText },
  { id: 'avaliacoes', label: 'Avaliações', icon: Star },
  { id: 'perfil', label: 'Meu Perfil', icon: User },
];

function StatusBadge({ s }: { s: string }) {
  const lower = s?.toUpperCase() || '';

  if (['NOVO', 'EM ANAMNESE'].includes(lower))
    return <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 bg-[#E6F1FB] text-[#0C447C]">{s}</span>;
  if (['ANAMNESE CONCLUÍDA', 'PRESTADOR NOTIFICADO'].includes(lower))
    return <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 bg-[#ececf0] text-[#030213]">{s}</span>;
  if (['FECHADO', 'CONTRATO GERADO'].includes(lower))
    return <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 bg-[#EEEDFE] text-[#26215C]">{s}</span>;
  if (lower === 'CONTRATO ASSINADO')
    return <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5" style={{ background: 'oklch(0.95 0.03 184)', color: 'oklch(0.45 0.1 184)' }}>{s}</span>;
  if (lower === 'SERVIÇO CONCLUÍDO' || lower === 'ENCERRADO')
    return <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 bg-[#EAF3DE] text-[#173404]">{s}</span>;
  if (['CANCELADO', 'ENCERRADO'].includes(lower))
    return <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 bg-[#f1f5f9] text-[#64748b]">{s}</span>;
  if (['DIVERGÊNCIA', 'SEM RESPOSTA'].includes(lower))
    return <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 bg-[#FCEBEB] text-[#501313]">{s}</span>;

  return <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 bg-[#f1f5f9] text-[#64748b]">{s}</span>;
}

function getInitials(name: string) {
  return (name || 'C')
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Início', subtitle: 'Visão geral da sua conta' },
  orcamentos: { title: 'Meus Serviços', subtitle: 'Orçamentos e solicitações' },
  contratos: { title: 'Contratos', subtitle: 'Documentos e assinaturas' },
  avaliacoes: { title: 'Avaliações', subtitle: 'Avalie os prestadores' },
  perfil: { title: 'Meu Perfil', subtitle: 'Dados da conta' },
};

export function ClientDashboard() {
  const navigate = useNavigate();
  const contratante = getContratante();
  const [aba, setAba] = useState('dashboard');
  const [orcs, setOrcs] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [perfil, setPerfil] = useState<any>(null);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [formPerfil, setFormPerfil] = useState({ nome: '', telefone: '', cpf: '', cidade: '', estado: '' });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState('');
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [avaliacoesRecebidas, setAvaliacoesRecebidas] = useState<any[]>([]);
  const [abaAvaliacoes, setAbaAvaliacoes] = useState<'feitas' | 'recebidas'>('feitas');
  const [modalAvaliacao, setModalAvaliacao] = useState<{ orc_id: string; prestador_id: string; prestador_nome: string } | null>(null);
  const [formAval, setFormAval] = useState({ nota: 5, comentario: '' });
  const [enviandoAval, setEnviandoAval] = useState(false);

  useEffect(() => {
    if (!contratante) { navigate('/auth'); return; }
    carregarTudo();
  }, []);

  async function salvarPerfil() {
    setSalvandoPerfil(true); setErroPerfil('');
    try {
      const updates: any = {};
      if (formPerfil.nome) updates.nome = formPerfil.nome;
      if (formPerfil.telefone) updates.telefone = formPerfil.telefone;
      if (formPerfil.cpf) updates.cpf = formPerfil.cpf;
      if (formPerfil.cidade) updates.cidade = formPerfil.cidade;
      if (formPerfil.estado) updates.estado = formPerfil.estado;
      const { error } = await supabase.from('usuarios').update(updates).eq('id', contratante!.id);
      if (error) throw error;
      setPerfil((p: any) => ({ ...p, ...updates }));
      setEditandoPerfil(false);
    } catch (e: any) { setErroPerfil(e.message || 'Erro ao salvar.'); }
    setSalvandoPerfil(false);
  }

  async function avaliarPrestador() {
    if (!modalAvaliacao) return;
    setEnviandoAval(true);
    try {
      const c = getContratante();
      const API_URL = import.meta.env.VITE_API_URL || 'https://servi-o-seguro-production.up.railway.app';

      // Garantir que temos o prestador_id — busca direto do ORC se necessário
      let prestadorId = modalAvaliacao.prestador_id;
      if (!prestadorId) {
        const { data: orc } = await supabase.from('orcs').select('prestador_id').eq('id', modalAvaliacao.orc_id).single();
        prestadorId = orc?.prestador_id;
      }
      if (!prestadorId) {
        alert('Erro: não foi possível identificar o prestador. Tente novamente.');
        setEnviandoAval(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/admin/avaliacoes/publica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orc_id: modalAvaliacao.orc_id,
          avaliado_id: prestadorId,
          avaliado_tipo: 'prestador',
          nota: formAval.nota,
          comentario: formAval.comentario,
          avaliador_nome: c?.nome || 'Cliente',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert('Erro ao enviar avaliação: ' + (json?.error || res.status));
        setEnviandoAval(false);
        return;
      }
      // Só atualiza estado local se salvou no banco
      setAvaliacoes(prev => [...prev, { orc_id: modalAvaliacao!.orc_id, avaliado_tipo: 'prestador', nota: formAval.nota, comentario: formAval.comentario, avaliador: c?.nome || 'Cliente', criado_em: new Date().toISOString() }]);
      setModalAvaliacao(null);
      setFormAval({ nota: 5, comentario: '' });
    } catch (e: any) {
      alert('Erro de conexão: ' + (e?.message || 'tente novamente'));
    }
    setEnviandoAval(false);
  }

  async function carregarTudo() {
    if (!contratante) return;
    const [oRes, pRes] = await Promise.all([
      supabase.from('orcs').select('*').eq('usuario_id', contratante.id).order('criado_em', { ascending: false }),
      supabase.from('usuarios').select('*').eq('id', contratante.id).limit(1),
    ]);
    const perfilData = pRes.data?.[0];
    if (perfilData) setPerfil(perfilData);

    // Busca ORCs pelo telefone do banco (WhatsApp), tentando vários formatos
    const telBanco = perfilData?.telefone?.replace(/\D/g, '') || '';
    const oTelRes = telBanco
      ? await supabase.from('orcs').select('*')
          .or(`telefone_cliente.eq.${telBanco},telefone_cliente.eq.+55${telBanco},telefone_cliente.eq.55${telBanco},telefone_cliente.eq.55${telBanco.replace(/^55/, '')}`)
          .is('usuario_id', null)
          .order('criado_em', { ascending: false })
      : { data: [] };

    // Mescla sem duplicatas
    const byId = new Map((oRes.data || []).map((o: any) => [o.id, o]));
    for (const o of (oTelRes.data || [])) if (!byId.has(o.id)) byId.set(o.id, o);
    const orcData = [...byId.values()].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

    if (orcData.length) {
      const ids = orcData.map((o: any) => o.id);
      // Busca contratos e chats em paralelo
      const [cRes, chatRes, avsRes] = await Promise.all([
        supabase.from('contratos').select('*, orcs(codigo, prestador_id, prestadores(nome))').in('orc_id', ids),
        supabase.from('chat_negociacao').select('orc_id, link_token, status, finalizado_cliente, finalizado_prestador').in('orc_id', ids),
        supabase.from('avaliacoes').select('*').in('orc_id', ids).eq('avaliado_tipo', 'prestador'),
      ]);
      setContratos(cRes.data || []);
      setAvaliacoes(avsRes.data || []);
      // Avaliações recebidas (prestador avaliou o usuário)
      if (contratante?.id) {
        const { data: recData } = await supabase.from('avaliacoes')
          .select('*').eq('avaliado_id', contratante.id).eq('avaliado_tipo', 'usuario')
          .order('criado_em', { ascending: false });
        setAvaliacoesRecebidas(recData || []);
      }
      // Injeta link_token e chat_status no ORC para facilitar a UI
      const chatMap = new Map((chatRes.data || []).map((c: any) => [c.orc_id, c]));
      const orcComChat = orcData.map((o: any) => ({
        ...o,
        _chat: chatMap.get(o.id) || null,
      }));
      setOrcs(orcComChat);
    } else {
      setOrcs(orcData);
    }
    setLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'oklch(0.6 0.118 184.704)', borderTopColor: 'transparent' }} />
        <span className="text-sm text-[#64748b] font-medium">Carregando...</span>
      </div>
    </div>
  );

  const page = pageTitles[aba] || pageTitles.dashboard;

  const sidebarContent = (
    <>
      <div className="px-5 pt-6 pb-5">
        <Link to="/" className="flex items-center gap-2.5">
          <div style={{ background: '#fff', borderRadius: 11, padding: 4, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src="/logo-escudo.png" alt="Serviço Seguro" style={{ height: '100%', width: 'auto', display: 'block' }} />
          </div>
          <span className="font-extrabold text-[15px] text-white tracking-tight">Serviço Seguro</span>
        </Link>
      </div>
      <div className="px-4 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
            style={{ background: 'oklch(0.92 0.05 184)', color: 'oklch(0.45 0.1 184)' }}>
            {getInitials(contratante?.nome || '')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-white truncate">{contratante?.nome}</div>
            <div className="text-xs text-white/50">Contratante</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setAba(id); setMobileMenu(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[14.5px] font-semibold transition-all text-left ${aba === id ? 'bg-[rgba(255,255,255,0.13)] text-white' : 'text-white/60 hover:bg-[rgba(255,255,255,0.07)] hover:text-white/90'}`}>
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>
      <div className="px-3 pb-5 border-t border-white/10 pt-3">
        <button onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[14.5px] font-semibold transition-all text-red-400/70 hover:text-red-400 hover:bg-[rgba(255,255,255,0.05)]">
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* SIDEBAR — desktop (não aparece no mobile) */}
      <aside className="w-64 flex-shrink-0 bg-[#030213] text-white min-h-screen sticky top-0 self-start hidden lg:flex flex-col" style={{ height: '100vh' }}>
        {sidebarContent}
      </aside>

      {/* SIDEBAR — mobile overlay (só renderiza quando aberto) */}
      {mobileMenu && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileMenu(false)} />
          <aside className="fixed left-0 top-0 h-full w-64 bg-[#030213] text-white z-50 flex flex-col lg:hidden shadow-[0_14px_40px_-18px_rgba(3,2,19,0.4)]">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* MAIN */}
      <div className="flex-1 min-w-0 bg-[#f8fafc] min-h-screen flex flex-col">

        {/* Top bar */}
        <div className="bg-white border-b border-[#e2e8f0] px-4 lg:px-7 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-[#f1f5f9] transition-colors"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu className="h-5 w-5 text-[#64748b]" />
            </button>
            <div>
              <div className="font-extrabold text-[#030213] text-[15px] leading-tight">{page.title}</div>
              <div className="text-xs text-[#64748b]">{page.subtitle}</div>
            </div>
          </div>
          <span className="bg-[#030213] text-white text-xs font-bold px-3 py-1 rounded-full">Contratante</span>
        </div>

        {/* Content */}
        <div className="p-4 lg:p-8 flex-1">

          {/* ── DASHBOARD ── */}
          {aba === 'dashboard' && (
            <div>
              {/* Pendência de avaliação */}
              {(() => {
                const pendentes = contratos.filter((c: any) =>
                  c.assinado_cliente && c.assinado_prestador &&
                  !avaliacoes.find((a: any) => a.orc_id === c.orc_id && a.avaliado_tipo === 'prestador') &&
                  c.orcs?.prestador_id
                );
                if (!pendentes.length) return null;
                return (
                  <div
                    className="rounded-[16px] p-4 flex items-center gap-4 mb-4 cursor-pointer"
                    style={{ background: '#FEF3C7', border: '2px solid #FCD34D' }}
                    onClick={() => setAba('contratos')}
                  >
                    <span className="text-3xl">⭐</span>
                    <div className="flex-1">
                      <div className="font-bold text-amber-900 text-sm">Avaliação pendente!</div>
                      <div className="text-xs text-amber-700 mt-0.5">
                        {pendentes.length === 1
                          ? 'Você tem 1 contrato assinado aguardando sua avaliação do prestador.'
                          : `Você tem ${pendentes.length} contratos aguardando avaliação.`}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-800 underline whitespace-nowrap">Avaliar agora →</span>
                  </div>
                );
              })()}
              {/* Hero banner */}
              <div className="bg-gradient-to-br from-[#030213] to-[#16161f] rounded-[20px] p-7 text-white relative overflow-hidden mb-6">
                <span className="absolute right-[-10px] bottom-[-30px] text-[150px] opacity-[0.06] select-none pointer-events-none leading-none">🛡️</span>
                <h3 className="font-extrabold text-xl relative z-10">Precisa de um serviço?</h3>
                <p className="text-white/60 text-sm mt-1 relative z-10">Nossa IA coleta tudo e conecta você ao profissional certo.</p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[11px] font-bold text-sm text-[#030213] mt-4 relative z-10 transition-opacity hover:opacity-90"
                  style={{ background: 'oklch(0.6 0.118 184.704)' }}
                >
                  <Plus className="h-4 w-4" />
                  Solicitar novo serviço
                </Link>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5">
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3 text-lg bg-[#EFF6FF]">📋</div>
                  <div className="text-sm text-[#64748b] font-semibold mb-1">Orçamentos</div>
                  <div className="text-[26px] font-extrabold text-[#030213]">{orcs.length}</div>
                </div>
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5">
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3 text-lg" style={{ background: 'oklch(0.95 0.03 184)' }}>⚡</div>
                  <div className="text-sm text-[#64748b] font-semibold mb-1">Ativos</div>
                  <div className="text-[26px] font-extrabold text-[#030213]">{orcs.filter((o: any) => o.status === 'CONTRATO ASSINADO').length}</div>
                </div>
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5">
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3 text-lg bg-[#EEEDFE]">📄</div>
                  <div className="text-sm text-[#64748b] font-semibold mb-1">Contratos</div>
                  <div className="text-[26px] font-extrabold text-[#030213]">{contratos.filter((c: any) => c.assinado_cliente && c.assinado_prestador).length}</div>
                </div>
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5">
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3 text-lg bg-[#FEF3C7]">⭐</div>
                  <div className="text-sm text-[#64748b] font-semibold mb-1">Avaliações</div>
                  <div className="text-[26px] font-extrabold text-[#030213]">{orcs.filter((o: any) => o.status === 'ENCERRADO').length}</div>
                </div>
              </div>

              {/* Recent ORCs */}
              <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                  <span className="font-bold text-[#030213] text-[15px]">Orçamentos recentes</span>
                  <button onClick={() => setAba('orcamentos')} className="text-sm font-semibold transition-colors hover:underline" style={{ color: 'oklch(0.6 0.118 184.704)' }}>Ver todos</button>
                </div>
                {orcs.length === 0 ? (
                  <div className="py-16 text-center text-[#64748b]">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-25" />
                    <p className="text-sm mb-4">Nenhum orçamento ainda.</p>
                    <Link to="/" className="inline-flex items-center gap-2 text-white text-sm font-bold px-5 py-2 rounded-[11px]" style={{ background: 'oklch(0.6 0.118 184.704)' }}>
                      Solicitar primeiro orçamento
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-[#f1f5f9]">
                    {orcs.slice(0, 3).map((o: any) => (
                      <div key={o.id} className="px-6 py-4 hover:bg-[#fafbfc] transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-bold text-sm text-[#030213]">{o.codigo}</span>
                          <div className="flex items-center gap-2">
                            <StatusBadge s={o.status} />
                            {o._chat?.link_token && (
                              <Link to={`/chat/${o._chat.link_token}?papel=cliente`}
                                className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: '#E6F1FB', color: '#0C447C' }}>
                                💬 Chat
                              </Link>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-[#64748b] leading-relaxed">{o.resumo_anamnese?.substring(0, 80) || 'Aguardando informações...'}</p>
                        <div className="text-xs text-[#94a3b8] mt-1">{o.criado_em ? new Date(o.criado_em).toLocaleDateString('pt-BR') : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ORÇAMENTOS ── */}
          {aba === 'orcamentos' && (
            <div className="space-y-3">
              {orcs.length === 0 ? (
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-16 text-center text-[#64748b]">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm">Nenhum orçamento ainda.</p>
                </div>
              ) : orcs.map((o: any) => (
                <div key={o.id} className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0 text-base" style={{ background: 'oklch(0.95 0.03 184)' }}>
                    {o.canal === 'whatsapp' ? '📱' : '💻'}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-bold text-sm text-[#030213]">{o.codigo}</span>
                      <StatusBadge s={o.status} />
                    </div>
                    <p className="text-sm text-[#64748b] truncate">{o.resumo_anamnese || 'Aguardando informações...'}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[#94a3b8]">{o.criado_em ? new Date(o.criado_em).toLocaleDateString('pt-BR') : ''}</span>
                      {o.valor_final && <span className="text-xs font-bold text-[#173404]">R$ {Number(o.valor_final).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {o._chat?.link_token && (
                      <Link
                        to={`/chat/${o._chat.link_token}?papel=cliente`}
                        className="text-xs font-bold px-3 py-1.5 rounded-[8px] border border-[#e2e8f0] text-[#030213] hover:bg-[#f8fafc] transition-colors"
                      >
                        💬 Chat
                      </Link>
                    )}
                    {contratos.find((c: any) => c.orc_id === o.id && !c.assinado_cliente) ? (
                      <Link
                        to={`/contrato?orc=${o.id}&papel=cliente`}
                        className="text-xs font-bold px-3 py-1.5 rounded-[8px] text-white transition-opacity hover:opacity-90"
                        style={{ background: 'oklch(0.6 0.118 184.704)', color: '#030213' }}
                      >
                        ✍️ Assinar
                      </Link>
                    ) : contratos.find((c: any) => c.orc_id === o.id) ? (
                      <Link
                        to={`/contrato?orc=${o.id}&papel=cliente`}
                        className="text-xs font-bold px-3 py-1.5 rounded-[8px] border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                      >
                        📄 Contrato
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CONTRATOS ── */}
          {aba === 'contratos' && (
            <div className="space-y-3">
              {contratos.length === 0 ? (
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-16 text-center text-[#64748b]">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm">Nenhum contrato ainda.</p>
                </div>
              ) : contratos.map((c: any) => (
                <div key={c.id} className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden">
                  {/* Header strip */}
                  <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-sm text-[#030213]">{c.orcs?.codigo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#EEEDFE] text-[#26215C] text-[10.5px] font-bold px-2.5 py-0.5 rounded-full">
                        {c.tipo === 'carta_aceite' ? 'Carta Aceite' : 'Contrato Seguro'}
                      </span>
                      <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${c.assinado_cliente && c.assinado_prestador ? 'bg-[#EAF3DE] text-[#173404]' : 'bg-[#FEF3C7] text-[#78350f]'}`}>
                        {c.assinado_cliente && c.assinado_prestador ? '✓ Assinado' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                  {/* Body */}
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-1">Valor</div>
                        <div className="font-bold text-[#030213]">R$ {Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-1">Sua assinatura</div>
                        <div className={`font-semibold text-sm ${c.assinado_cliente ? 'text-[#173404]' : 'text-[#78350f]'}`}>
                          {c.assinado_cliente ? '✅ Assinado' : '⏳ Pendente'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-1">Data</div>
                        <div className="font-semibold text-[#030213]">{c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '—'}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {!c.assinado_cliente ? (
                        <Link
                          to={`/contrato?orc=${c.orc_id}&papel=cliente`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-bold text-[#030213] transition-opacity hover:opacity-90"
                          style={{ background: 'oklch(0.6 0.118 184.704)' }}
                        >
                          ✍️ Assinar contrato
                        </Link>
                      ) : (
                        <Link
                          to={`/contrato?orc=${c.orc_id}&papel=cliente`}
                          className="inline-flex items-center gap-1.5 border border-[#e2e8f0] px-4 py-2 rounded-[10px] text-sm font-semibold text-[#030213] hover:bg-[#f8fafc] transition-colors"
                        >
                          Ver contrato
                        </Link>
                      )}
                      <a
                        href={`${import.meta.env.VITE_API_URL || 'https://servi-o-seguro-production.up.railway.app'}/api/contratos/${c.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 border border-[#e2e8f0] px-4 py-2 rounded-[10px] text-sm font-semibold text-[#030213] hover:bg-[#f8fafc] transition-colors"
                      >
                        📄 Baixar PDF
                      </a>
                      {c.assinado_cliente && c.assinado_prestador && !avaliacoes.find((a: any) => a.orc_id === c.orc_id && a.avaliado_tipo === 'prestador') && c.orcs?.prestador_id && (
                        <button
                          onClick={() => setModalAvaliacao({ orc_id: c.orc_id, prestador_id: c.orcs.prestador_id, prestador_nome: c.orcs.prestadores?.nome || 'Prestador' })}
                          className="inline-flex items-center gap-1.5 border border-amber-300 bg-amber-50 px-4 py-2 rounded-[10px] text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                        >
                          ⭐ Avaliar prestador
                        </button>
                      )}
                      {c.assinado_cliente && c.assinado_prestador && avaliacoes.find((a: any) => a.orc_id === c.orc_id && a.avaliado_tipo === 'prestador') && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#94a3b8] px-2">✓ Avaliado</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── AVALIAÇÕES ── */}
          {aba === 'avaliacoes' && (
            <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e2e8f0]">
                <h2 className="font-bold text-sm text-[#030213]">Avaliações</h2>
              </div>
              {/* Sub-tabs */}
              <div className="flex border-b border-[#e2e8f0]">
                {(['feitas', 'recebidas'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAbaAvaliacoes(tab)}
                    className="flex-1 py-3 text-sm font-bold transition-colors"
                    style={abaAvaliacoes === tab
                      ? { color: 'oklch(0.45 0.1 184)', borderBottom: '2px solid oklch(0.6 0.118 184.704)' }
                      : { color: '#94a3b8' }}
                  >
                    {tab === 'feitas'
                      ? `Feitas (${avaliacoes.filter((a: any) => a.avaliado_tipo === 'prestador').length})`
                      : `Recebidas (${avaliacoesRecebidas.length})`}
                  </button>
                ))}
              </div>
              {abaAvaliacoes === 'feitas' && (
                avaliacoes.filter((a: any) => a.avaliado_tipo === 'prestador').length === 0 ? (
                  <div className="py-16 text-center text-[#64748b]">
                    <Star className="h-10 w-10 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">Nenhuma avaliação feita ainda.</p>
                    <p className="text-xs mt-1 text-[#94a3b8]">Avalie os prestadores após assinar contratos.</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-3">
                    {avaliacoes.filter((a: any) => a.avaliado_tipo === 'prestador').map((av: any) => (
                      <div key={av.id || av.orc_id} className="border border-[#e2e8f0] rounded-[16px] p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-bold text-sm text-[#030213]">Prestador avaliado</div>
                            <div className="text-xs text-[#64748b] mt-0.5">Sua avaliação</div>
                          </div>
                          <span className="text-amber-500 text-base flex-shrink-0">{'⭐'.repeat(av.nota || 0)}</span>
                        </div>
                        {av.comentario && <p className="text-sm text-[#64748b]">{av.comentario}</p>}
                        {av.criado_em && <p className="text-xs text-[#94a3b8] mt-2">{new Date(av.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                      </div>
                    ))}
                  </div>
                )
              )}
              {abaAvaliacoes === 'recebidas' && (
                avaliacoesRecebidas.length === 0 ? (
                  <div className="py-16 text-center text-[#64748b]">
                    <Star className="h-10 w-10 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">Nenhuma avaliação recebida ainda.</p>
                    <p className="text-xs mt-1 text-[#94a3b8]">Os prestadores poderão avaliar você após concluir os serviços.</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-3">
                    {avaliacoesRecebidas.map((av: any) => (
                      <div key={av.id} className="border border-[#e2e8f0] rounded-[16px] p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-bold text-sm text-[#030213]">{av.avaliador || 'Prestador'}</div>
                            <div className="text-xs text-[#64748b] mt-0.5">Avaliou você como cliente</div>
                          </div>
                          <span className="text-amber-500 text-base flex-shrink-0">{'⭐'.repeat(av.nota || 0)}</span>
                        </div>
                        {av.comentario && <p className="text-sm text-[#64748b]">{av.comentario}</p>}
                        {av.criado_em && <p className="text-xs text-[#94a3b8] mt-2">{new Date(av.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* ── PERFIL ── */}
          {aba === 'perfil' && perfil && (
            <div className="max-w-2xl space-y-4">
              {/* Profile card */}
              <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden">
                <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0"
                      style={{ background: 'oklch(0.92 0.05 184)', color: 'oklch(0.45 0.1 184)' }}>
                      {getInitials(perfil.nome || '')}
                    </div>
                    <div>
                      <div className="font-bold text-[#030213] text-base">{perfil.nome}</div>
                      <div className="text-sm text-[#64748b]">{perfil.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditandoPerfil(!editandoPerfil); setFormPerfil({ nome: perfil.nome || '', telefone: perfil.telefone || '', cpf: perfil.cpf || '', cidade: perfil.cidade || '', estado: perfil.estado || '' }); setErroPerfil(''); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-[8px] border border-[#e2e8f0] transition-colors hover:bg-white"
                    style={{ color: editandoPerfil ? '#b91c1c' : '#64748b' }}
                  >
                    {editandoPerfil ? '✕ Cancelar' : '✏️ Editar'}
                  </button>
                </div>
                <div className="p-6">
                  {editandoPerfil ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { l: 'Nome completo', k: 'nome', type: 'text' },
                          { l: 'WhatsApp / Telefone', k: 'telefone', type: 'tel' },
                          { l: 'CPF', k: 'cpf', type: 'text' },
                          { l: 'Cidade', k: 'cidade', type: 'text' },
                          { l: 'Estado (UF)', k: 'estado', type: 'text' },
                        ].map(({ l, k, type }) => (
                          <div key={k}>
                            <div className="text-[10.5px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1">{l}</div>
                            <input
                              type={type}
                              value={(formPerfil as any)[k]}
                              onChange={e => setFormPerfil(p => ({ ...p, [k]: e.target.value }))}
                              className="w-full px-3 py-2 text-sm outline-none"
                              style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}
                              onFocus={e => (e.target.style.borderColor = '#030213')}
                              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                            />
                          </div>
                        ))}
                      </div>
                      {erroPerfil && <p className="text-xs text-red-500">{erroPerfil}</p>}
                      <button
                        onClick={salvarPerfil}
                        disabled={salvandoPerfil}
                        className="px-5 py-2.5 rounded-[10px] text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: '#030213' }}
                      >
                        {salvandoPerfil ? '⏳ Salvando...' : '💾 Salvar alterações'}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-5">
                      {[
                        { l: 'Nome completo', v: perfil.nome },
                        { l: 'Email', v: perfil.email },
                        { l: 'WhatsApp', v: perfil.telefone },
                        { l: 'CPF', v: perfil.cpf || '—' },
                        { l: 'Cidade', v: perfil.cidade },
                        { l: 'Estado', v: perfil.estado },
                      ].map(f => (
                        <div key={f.l}>
                          <div className="text-[10.5px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1">{f.l}</div>
                          <div className="text-sm font-semibold text-[#030213]">{f.v || '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Identity verification */}
              <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden">
                <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-6 py-4">
                  <div className="font-bold text-[#030213] text-[15px]">Verificação de Identidade</div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { ico: '📋', l: 'CPF', ok: !!perfil.cpf },
                      { ico: '🪪', l: 'Documento', ok: false },
                      { ico: '🤳', l: 'Biometria', ok: false },
                    ].map(s => (
                      <div key={s.l} className={`text-center border rounded-[14px] p-4 transition-colors ${s.ok ? 'border-[#86efac] bg-[#EAF3DE]' : 'border-[#e2e8f0] opacity-60'}`}>
                        <div className="text-2xl mb-2">{s.ico}</div>
                        <div className="text-xs font-bold text-[#030213] mb-0.5">{s.l}</div>
                        <div className={`text-[10.5px] font-semibold ${s.ok ? 'text-[#173404]' : 'text-[#94a3b8]'}`}>{s.ok ? '✓ Verificado' : 'Pendente'}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[12px] p-4 text-sm border" style={{ background: 'oklch(0.95 0.03 184)', borderColor: 'oklch(0.85 0.06 184)', color: 'oklch(0.45 0.1 184)' }}>
                    🔒 <strong>Em breve:</strong> A verificação biométrica será necessária para contratos do tipo Serviço Seguro.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal de avaliação */}
      {modalAvaliacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-[#030213] text-lg mb-1">Avaliar prestador</h3>
            <p className="text-sm text-[#717182] mb-5">{modalAvaliacao.prestador_nome}</p>
            {/* Estrelas */}
            <div className="flex gap-2 mb-4 justify-center">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setFormAval(f => ({ ...f, nota: n }))}
                  className="text-3xl transition-transform hover:scale-110">
                  {n <= formAval.nota ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            <textarea
              value={formAval.comentario}
              onChange={e => setFormAval(f => ({ ...f, comentario: e.target.value }))}
              placeholder="Comentário (opcional)"
              rows={3}
              className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213] resize-none mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setModalAvaliacao(null)}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-semibold border border-[#e2e8f0] hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={avaliarPrestador} disabled={enviandoAval}
                className="flex-1 py-2.5 rounded-[12px] text-sm font-bold text-white disabled:opacity-60"
                style={{ background: '#030213' }}>
                {enviandoAval ? 'Enviando...' : 'Enviar avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
