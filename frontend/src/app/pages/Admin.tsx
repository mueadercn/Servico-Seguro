import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  LayoutDashboard, ClipboardList, Users, Wrench, Tag, Star,
  DollarSign, Settings, Shield, FileText, LogOut, ArrowLeft,
  MessageSquare, Sparkles, Clock, AlertTriangle, ChevronRight,
  UserPlus, CheckCircle2, Phone, Calendar, Trophy, X, Plus,
  RefreshCw
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { AdminPrompts } from './AdminPrompts';
import { supabase } from '../../lib/supabase';

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_SENHA = 'admin123';

// ── FASES DO KANBAN ───────────────────────────────────────────
const FASES = [
  { id: 'anamnese', label: 'Anamnese', icon: MessageSquare, color: '#7F77DD', bg: '#EEEDFE', text: '#3C3489', statuses: ['NOVO', 'EM ANAMNESE'], alert: false },
  { id: 'chat', label: 'Chat ativo', icon: CheckCircle2, color: '#185FA5', bg: '#E6F1FB', text: '#042C53', statuses: ['ANAMNESE CONCLUÍDA', 'PRESTADOR NOTIFICADO', 'AGUARDANDO PRESTADOR'], alert: false },
  { id: 'contrato', label: 'Contrato', icon: FileText, color: '#534AB7', bg: '#EEEDFE', text: '#26215C', statuses: ['FECHADO', 'CONTRATO GERADO', 'AGUARDANDO ASSINATURA'], alert: false },
  { id: 'concluido', label: 'Concluído', icon: Trophy, color: '#3B6D11', bg: '#EAF3DE', text: '#173404', statuses: ['CONTRATO ASSINADO', 'SERVIÇO CONCLUÍDO'], alert: false },
  { id: 'atencao', label: 'Atenção', icon: AlertTriangle, color: '#A32D2D', bg: '#FCEBEB', text: '#501313', statuses: ['DIVERGÊNCIA DE VALOR', 'SEM RESPOSTA PRESTADOR', 'SEM RESPOSTA CLIENTE'], alert: true },
  { id: 'cancelado', label: 'Encerrado', icon: X, color: '#5F5E5A', bg: '#F1EFE8', text: '#2C2C2A', statuses: ['NÃO FECHOU', 'CANCELADO', 'ENCERRADO'], alert: false },
];

const navItems = [
  { id: 'kanban', label: 'Leads — Kanban', icon: LayoutDashboard },
  { id: 'chats', label: 'Histórico de Chats', icon: MessageSquare },
  { id: 'dashboard', label: 'Dashboard', icon: ClipboardList },
  { id: 'prestadores', label: 'Prestadores', icon: Users },
  { id: 'usuarios', label: 'Contratantes', icon: Users },
  { id: 'servicos', label: 'Serviços', icon: Wrench },
  { id: 'categorias', label: 'Categorias', icon: Tag },
  { id: 'contratos', label: 'Contratos', icon: FileText },
  { id: 'avaliacoes', label: 'Avaliações', icon: Star },
  { id: 'comissoes', label: 'Comissões', icon: DollarSign },
  { id: 'biometria', label: 'Verificações', icon: Shield },
  { id: 'config', label: 'Configurações', icon: Settings },
];

// ── TIPOS ─────────────────────────────────────────────────────
type ViewMode = 'kanban' | 'list' | 'chat';
type Fase = typeof FASES[0];
type ORC = any;

export function Admin() {
  const [logado, setLogado] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [aba, setAba] = useState('kanban');
  const [dados, setDados] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  // Kanban state
  const [orcs, setOrcs] = useState<ORC[]>([]);
  const [orcsLoading, setOrcsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [faseSelecionada, setFaseSelecionada] = useState<Fase | null>(null);
  const [orcSelecionado, setOrcSelecionado] = useState<ORC | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [chatDoOrc, setChatDoOrc] = useState<any | null>(null);
  const [mensagensChat, setMensagensChat] = useState<any[]>([]);

  // Modal estados para adicionar serviço e prestador
  const [modalServico, setModalServico] = useState(false);
  const [modalPrestador, setModalPrestador] = useState(false);
  const [formServico, setFormServico] = useState<any>({ titulo: '', descricao: '', prestador_id: '', categoria_id: '', tipo: 'orcamento' });
  const [formPrestador, setFormPrestador] = useState<any>({ nome: '', email: '', telefone: '', cidade: 'Santa Maria', cpf: '', bio: '' });
  const [prestadoresList, setPrestadoresList] = useState<any[]>([]);
  const [categoriasList, setCategoriasList] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('ss_admin')) {
      setLogado(true);
      carregarOrcs();
    }
  }, []);

  function fazerLogin() {
    if (email === ADMIN_EMAIL && senha === ADMIN_SENHA) {
      localStorage.setItem('ss_admin', '1');
      setLogado(true);
      carregarOrcs();
    } else {
      setErroLogin('Credenciais inválidas.');
    }
  }

  // ── CARREGAR ORCs ─────────────────────────────────────────
  async function carregarOrcs() {
    setOrcsLoading(true);
    try {
      const { data } = await supabase
        .from('orcs')
        .select('*, prestadores(nome, telefone), usuarios(nome, telefone), servicos(titulo, categorias(nome))')
        .order('criado_em', { ascending: false })
        .limit(200);
      setOrcs(data || []);
    } catch (e) {
      console.warn('Erro ao carregar ORCs:', e);
    }
    setOrcsLoading(false);
  }

  // ── CARREGAR CHAT E MENSAGENS DO ORC ────────────────────────
  async function carregarMensagens(orcId: string) {
    setMsgLoading(true);
    try {
      // Buscar o chat de negociação desse ORC
      const { data: chat } = await supabase
        .from('chat_negociacao')
        .select('*')
        .eq('orc_id', orcId)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      setChatDoOrc(chat || null);

      if (chat?.id) {
        const { data: msgs } = await supabase
          .from('chat_mensagens')
          .select('*')
          .eq('chat_id', chat.id)
          .order('criado_em', { ascending: true });
        setMensagensChat(msgs || []);
      } else {
        setMensagensChat([]);
      }
      // Manter mensagens da anamnese também (conversa com IA)
      const { data: msgsAnamnese } = await supabase
        .from('mensagens')
        .select('*')
        .eq('orc_id', orcId)
        .order('criado_em', { ascending: true });
      setMensagens(msgsAnamnese || []);
    } catch (e) {
      setMensagens([]);
      setMensagensChat([]);
    }
    setMsgLoading(false);
  }

  // ── KANBAN — leads por fase ───────────────────────────────
  function getLeadsDaFase(fase: Fase) {
    return orcs.filter(o => fase.statuses.includes(o.status));
  }

  function abrirFase(fase: Fase) {
    setFaseSelecionada(fase);
    setViewMode('list');
  }

  function abrirOrc(orc: ORC) {
    setOrcSelecionado(orc);
    setViewMode('chat');
    carregarMensagens(orc.id);
  }

  function voltarParaKanban() {
    setViewMode('kanban');
    setFaseSelecionada(null);
    setOrcSelecionado(null);
  }

  function voltarParaLista() {
    setViewMode('list');
    setOrcSelecionado(null);
    setMensagens([]);
  }

  async function deletarOrc(orcId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Remover este ORC? Esta ação não pode ser desfeita.')) return;
    try {
      // Deletar mensagens primeiro
      await supabase.from('mensagens').delete().eq('orc_id', orcId);
      await supabase.from('sessoes_whatsapp').delete().eq('id', orcId);
      await supabase.from('orcs').delete().eq('id', orcId);
      setOrcs(prev => prev.filter(o => o.id !== orcId));
    } catch (e) {
      console.warn('Erro ao deletar ORC:', e);
    }
  }

  // ── CARREGAR DADOS ADMIN ──────────────────────────────────
  async function carregarDados(pagina: string) {
    setLoading(true);
    try {
      if (pagina === 'chats') {
        const { data, error: chatErr } = await supabase
          .from('chat_negociacao')
          .select(`
            id, link_token, status, criado_em, finalizado_em,
            orcs ( id, codigo, nome_cliente, servico_nome, prestadores ( nome ) )
          `)
          .order('criado_em', { ascending: false })
          .limit(200);
        if (chatErr) console.warn('[Admin] Erro ao carregar chats:', chatErr.message);
        // Buscar contagem de mensagens por chat
        const chatIds = (data || []).map((c: any) => c.id);
        const contagensMap: Record<string, number> = {};
        if (chatIds.length) {
          const { data: contagens } = await supabase
            .from('chat_mensagens')
            .select('chat_id')
            .in('chat_id', chatIds);
          (contagens || []).forEach((m: any) => {
            contagensMap[m.chat_id] = (contagensMap[m.chat_id] || 0) + 1;
          });
        }
        setDados({ chats: (data || []).map((c: any) => ({ ...c, total_mensagens: contagensMap[c.id] || 0 })) });
      } else if (pagina === 'dashboard') {
        const [o, p, u, c] = await Promise.all([
          supabase.from('orcs').select('id, status'),
          supabase.from('prestadores').select('id, ativo, verificado'),
          supabase.from('usuarios').select('id'),
          supabase.from('contratos').select('id, valor, comissao'),
        ]);
        setDados({
          total_orcs: o.data?.length || 0,
          orcs_ativos: o.data?.filter((x: any) => !['ENCERRADO', 'CANCELADO'].includes(x.status)).length || 0,
          total_prestadores: p.data?.length || 0,
          prestadores_verificados: p.data?.filter((x: any) => x.verificado).length || 0,
          total_usuarios: u.data?.length || 0,
          total_contratos: c.data?.length || 0,
          total_comissao: c.data?.reduce((a: number, x: any) => a + (Number(x.comissao) || 0), 0) || 0,
        });
      } else if (pagina === 'prestadores') {
        const { data } = await supabase.from('prestadores').select('*').order('criado_em', { ascending: false });
        setDados({ prestadores: data || [] });
      } else if (pagina === 'usuarios') {
        const { data } = await supabase.from('usuarios').select('*').order('criado_em', { ascending: false });
        setDados({ usuarios: data || [] });
      } else if (pagina === 'servicos') {
        const { data } = await supabase.from('servicos').select('*, prestadores(nome), categorias(nome)').order('criado_em', { ascending: false });
        setDados({ servicos: data || [] });
      } else if (pagina === 'categorias') {
        const { data } = await supabase.from('categorias').select('*').order('nome');
        setDados({ categorias: data || [] });
      } else if (pagina === 'contratos') {
        const { data } = await supabase.from('contratos').select('*, orcs(codigo, nome_cliente)').order('criado_em', { ascending: false });
        setDados({ contratos: data || [] });
      } else if (pagina === 'avaliacoes') {
        const { data } = await supabase.from('avaliacoes').select('*').order('criado_em', { ascending: false });
        setDados({ avaliacoes: data || [] });
      } else if (pagina === 'comissoes') {
        const { data } = await supabase.from('comissoes').select('*').order('ordem');
        setDados({ comissoes: data || [] });
      } else if (pagina === 'biometria') {
        const { data } = await supabase.from('prestadores').select('id,nome,telefone,cidade,verificado').order('criado_em', { ascending: false });
        setDados({ biometria: data || [] });
      } else if (pagina === 'config') {
        const { data } = await supabase.from('configuracoes').select('*').order('chave');
        setDados({ configs: data || [] });
      }
    } catch (e) { console.warn(e); }
    setLoading(false);
  }

  function irPara(p: string) {
    setAba(p);
    setMobileMenu(false);
    if (p !== 'kanban') carregarDados(p);
    if (p === 'servicos') {
      supabase.from('prestadores').select('id,nome').eq('ativo', true).order('nome')
        .then(({ data }) => setPrestadoresList(data || []));
      supabase.from('categorias').select('id,nome,icone').eq('ativa', true).order('nome')
        .then(({ data }) => setCategoriasList(data || []));
    }
    if (p === 'prestadores') {
      supabase.from('categorias').select('id,nome').eq('ativa', true).order('nome')
        .then(({ data }) => setCategoriasList(data || []));
    }
  }

  async function salvarServico() {
    if (!formServico.titulo || !formServico.prestador_id) {
      alert('Título e prestador são obrigatórios.');
      return;
    }
    setSalvando(true);
    try {
      await supabase.from('servicos').insert({
        titulo: formServico.titulo,
        descricao: formServico.descricao || null,
        prestador_id: formServico.prestador_id,
        categoria_id: formServico.categoria_id || null,
        tipo: formServico.tipo || 'orcamento',
        ativo: true,
        aceita_orcamento_online: formServico.aceita_online || false
      });
      setModalServico(false);
      setFormServico({ titulo: '', descricao: '', prestador_id: '', categoria_id: '', tipo: 'orcamento' });
      carregarDados('servicos');
    } catch (e) { console.warn(e); }
    setSalvando(false);
  }

  async function salvarPrestador() {
    if (!formPrestador.nome || !formPrestador.telefone) {
      alert('Nome e telefone são obrigatórios.');
      return;
    }
    setSalvando(true);
    try {
      const { data: p } = await supabase.from('prestadores').insert({
        nome: formPrestador.nome,
        email: formPrestador.email || null,
        telefone: formPrestador.telefone,
        cpf: formPrestador.cpf || null,
        cidade: formPrestador.cidade || 'Santa Maria',
        estado: 'RS',
        bio: formPrestador.bio || null,
        ativo: true,
        verificado: false
      }).select('id');
      
      if (p?.[0]?.id && formPrestador.email && formPrestador.senha) {
        const senhaHash = btoa(formPrestador.senha);
        await supabase.from('prestador_auth').insert({
          prestador_id: p[0].id,
          email: formPrestador.email.toLowerCase(),
          senha_hash: senhaHash,
          ativo: true
        });
      }
      
      setModalPrestador(false);
      setFormPrestador({ nome: '', email: '', telefone: '', cidade: 'Santa Maria', cpf: '', bio: '' });
      carregarDados('prestadores');
    } catch (e) { console.warn(e); }
    setSalvando(false);
  }

  async function toggleVerificado(id: string, atual: boolean) {
    await supabase.from('prestadores').update({ verificado: !atual }).eq('id', id);
    carregarDados('biometria');
  }

  // ── STATUS BADGE ──────────────────────────────────────────
  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      'NOVO': 'bg-blue-100 text-blue-800',
      'EM ANAMNESE': 'bg-purple-100 text-purple-800',
      'ANAMNESE CONCLUÍDA': 'bg-green-100 text-green-800',
      'PRESTADOR NOTIFICADO': 'bg-amber-100 text-amber-800',
      'AGUARDANDO PRESTADOR': 'bg-amber-100 text-amber-800',
      'VISITA AGENDADA': 'bg-blue-100 text-blue-800',
      'ORÇAMENTO ONLINE': 'bg-blue-100 text-blue-800',
      'VISITA REALIZADA': 'bg-teal-100 text-teal-800',
      'FECHADO': 'bg-green-100 text-green-800',
      'CONTRATO ASSINADO': 'bg-green-100 text-green-800',
      'ENCERRADO': 'bg-gray-100 text-gray-600',
      'CANCELADO': 'bg-red-100 text-red-800',
      'DIVERGÊNCIA DE VALOR': 'bg-red-100 text-red-800',
      'NÃO FECHOU': 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[s] || 'bg-gray-100 text-gray-600'}`}>
        {s}
      </span>
    );
  };

  const initials = (nome: string) => nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  const timeAgo = (ts: string) => {
    if (!ts) return '—';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'há menos de 1h';
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  };

  const tbl = "w-full text-sm border-collapse";
  const th = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-slate-50 border-b";
  const td = "px-4 py-3 border-b border-border";

  // ── LOGIN ─────────────────────────────────────────────────
  if (!logado) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl border p-8 w-full max-w-sm shadow-sm">
        <div className="text-center mb-6">
          <Logo className="h-10 mx-auto mb-3" />
          <h2 className="font-bold text-primary">Painel Admin</h2>
        </div>
        {erroLogin && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">❌ {erroLogin}</div>
        )}
        <div className="space-y-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary" />
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fazerLogin()}
            placeholder="Senha" className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary" />
          <button onClick={fazerLogin} className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors">
            Entrar no painel
          </button>
        </div>
      </div>
    </div>
  );

  // ── LAYOUT ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* SIDEBAR */}
      <aside className={`fixed left-0 top-0 h-full w-60 bg-primary z-40 flex flex-col transition-transform lg:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-white/10"><Logo className="h-8" /></div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => irPara(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${aba === id ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={() => { localStorage.removeItem('ss_admin'); setLogado(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all">
            <LogOut className="h-4 w-4" />Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">

        {/* TOPBAR */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenu(!mobileMenu)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
              <LayoutDashboard className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-primary">{navItems.find(n => n.id === aba)?.label || 'Admin'}</h1>
              {aba === 'kanban' && (
                <p className="text-xs text-muted-foreground">
                  {orcs.length} ORCs totais · {orcs.filter(o => !['ENCERRADO', 'NÃO FECHOU', 'CANCELADO'].includes(o.status)).length} ativos
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {aba === 'kanban' && (
              <button onClick={carregarOrcs} className="p-2 hover:bg-slate-100 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">⚙️ Admin</span>
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-6 flex-1">

          {/* ── KANBAN ─────────────────────────────────────── */}
          {aba === 'kanban' && (
            <div>
              {orcsLoading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (

                /* KANBAN VIEW */
                viewMode === 'kanban' && (
                  <div>
                    {/* GRID DE FASES */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                      {FASES.map(fase => {
                        const leads = getLeadsDaFase(fase);
                        const count = leads.length;
                        const Icon = fase.icon;
                        return (
                          <button key={fase.id} onClick={() => abrirFase(fase)}
                            className={`text-left bg-white rounded-2xl border overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group ${fase.alert && count > 0 ? 'border-red-300' : 'border-border'}`}>
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="p-2 rounded-xl" style={{ background: fase.bg }}>
                                  <Icon className="h-4 w-4" style={{ color: fase.color }} />
                                </div>
                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div className="text-2xl font-bold text-primary mb-1">{count}</div>
                              <div className="text-xs font-semibold text-muted-foreground truncate">{fase.label}</div>
                              {fase.alert && count > 0 && (
                                <div className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Requer atenção
                                </div>
                              )}
                            </div>
                            {/* barra de progresso */}
                            <div className="h-1 bg-slate-100">
                              <div className="h-full rounded-r transition-all"
                                style={{ width: `${Math.min(100, count * 20)}%`, background: fase.color }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* RESUMO RÁPIDO */}
                    <div className="bg-white rounded-2xl border overflow-hidden">
                      <div className="px-5 py-4 border-b flex items-center justify-between">
                        <h2 className="font-bold text-primary">Todos os ORCs recentes</h2>
                        <span className="text-xs text-muted-foreground">{orcs.length} total</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className={tbl}>
                          <thead><tr>
                            {['Código', 'Cliente', 'Serviço', 'Status', 'Resumo IA', 'Tempo'].map(h => (
                              <th key={h} className={th}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {orcs.map((o: any) => (
                              <tr key={o.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => abrirOrc(o)}>
                                <td className={td}><span className="font-mono font-bold text-primary text-xs">{o.codigo}</span></td>
                                <td className={td}><span className="font-medium text-sm">{o.nome_cliente || '—'}</span></td>
                                <td className={td + " text-xs text-muted-foreground"}>{o.servicos?.titulo || '—'}</td>
                                <td className={td}>{statusBadge(o.status)}</td>
                                <td className={td + " max-w-xs"}>
                                  {o.resumo_anamnese ? (
                                    <div className="space-y-0.5">
                                      {o.resumo_anamnese.split('\n').filter((l: string) => l.trim()).slice(0, 2).map((l: string, i: number) => (
                                        <div key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                          <span className="text-success">•</span>
                                          <span>{l.replace(/^[•\-\*]\s*/, '')}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">Em andamento...</span>
                                  )}
                                </td>
                                <td className={td + " text-xs text-muted-foreground whitespace-nowrap"}>
                                  <div>{timeAgo(o.criado_em)}</div>
                                  <button onClick={e => deletarOrc(o.id, e)} className="text-red-400 hover:text-red-600 text-xs mt-0.5">✕ remover</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* LISTA DE LEADS DA FASE */}
              {viewMode === 'list' && faseSelecionada && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={voltarParaKanban}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <ArrowLeft className="h-4 w-4" /> Kanban
                    </button>
                    <span className="text-muted-foreground">/</span>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg" style={{ background: faseSelecionada.bg }}>
                        <faseSelecionada.icon className="h-3.5 w-3.5" style={{ color: faseSelecionada.color }} />
                      </div>
                      <span className="font-bold text-primary">{faseSelecionada.label}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: faseSelecionada.bg, color: faseSelecionada.text }}>
                        {getLeadsDaFase(faseSelecionada).length} leads
                      </span>
                    </div>
                  </div>

                  {getLeadsDaFase(faseSelecionada).length === 0 ? (
                    <div className="bg-white rounded-2xl border py-16 text-center text-muted-foreground">
                      <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhum lead nesta fase.</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {getLeadsDaFase(faseSelecionada).map((orc: any) => (
                        <div key={orc.id}
                          className="bg-white rounded-2xl border hover:shadow-md hover:border-primary/20 transition-all duration-200 overflow-hidden cursor-pointer"
                          onClick={() => abrirOrc(orc)}>
                          <div className="p-5">
                            {/* Header do card */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                                {initials(orc.nome_cliente || 'X')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-primary truncate">{orc.nome_cliente || 'Cliente'}</div>
                                <div className="font-mono text-xs text-muted-foreground">{orc.codigo}</div>
                              </div>
                              {statusBadge(orc.status)}
                            </div>

                            {/* Serviço */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                              <Wrench className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>{orc.servicos?.titulo || orc.servicos?.categorias?.nome || 'Serviço não especificado'}</span>
                            </div>

                            {/* Resumo da IA */}
                            <div className={`rounded-xl p-3 mb-3 ${orc.resumo_anamnese ? 'bg-green-50 border border-green-100' : 'bg-slate-50 border border-border'}`}>
                              <div className="flex items-center gap-1.5 mb-2">
                                <Sparkles className="h-3 w-3 text-success" />
                                <span className="text-xs font-bold text-success uppercase tracking-wider">Resumo do serviço</span>
                              </div>
                              {orc.resumo_anamnese ? (
                                <div className="space-y-1">
                                  {orc.resumo_anamnese.split('\n').filter((l: string) => l.trim()).map((linha: string, i: number) => (
                                    <div key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                                      <span className="text-success mt-0.5 flex-shrink-0">•</span>
                                      <span className="leading-relaxed">{linha.replace(/^[•\-\*]\s*/, '')}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">Anamnese em andamento...</p>
                              )}
                            </div>

                            {/* Prestador vinculado */}
                            {orc.prestadores?.nome && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                                <Users className="h-3.5 w-3.5" />
                                <span>Prestador: <strong>{orc.prestadores.nome}</strong></span>
                                {orc.prestadores.telefone && (
                                  <span className="text-muted-foreground">· {orc.prestadores.telefone}</span>
                                )}
                              </div>
                            )}

                            {/* Tempo */}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {timeAgo(orc.criado_em)}
                              {orc.canal && <span className="ml-2">{orc.canal === 'whatsapp' ? '📱 WhatsApp' : '💻 Site'}</span>}
                            </div>
                          </div>

                          {/* Footer com ações */}
                          <div className="px-5 py-3 bg-slate-50 border-t flex items-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); abrirOrc(orc); }}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <MessageSquare className="h-3.5 w-3.5" /> Ver conversa
                            </button>
                            {faseSelecionada.id === 'atencao' && (
                              <button
                                onClick={e => e.stopPropagation()}
                                className="ml-auto flex items-center gap-1.5 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors">
                                <AlertTriangle className="h-3.5 w-3.5" /> Resolver
                              </button>
                            )}
                            <button
                              onClick={e => deletarOrc(orc.id, e)}
                              title="Remover ORC"
                              className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors">
                              <X className="h-3.5 w-3.5" /> Remover
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CONVERSA BRUTA + RESUMO IA */}
              {viewMode === 'chat' && orcSelecionado && (
                <div>
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 mb-5 text-sm">
                    <button onClick={voltarParaKanban} className="text-muted-foreground hover:text-foreground transition-colors">Kanban</button>
                    <span className="text-muted-foreground">/</span>
                    <button onClick={voltarParaLista} className="text-muted-foreground hover:text-foreground transition-colors">
                      {faseSelecionada?.label}
                    </button>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-bold text-primary">{orcSelecionado.nome_cliente}</span>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-5">
                    {/* COLUNA ESQUERDA — info do ORC */}
                    <div className="space-y-4">
                      {/* Card do ORC */}
                      <div className="bg-white rounded-2xl border p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {initials(orcSelecionado.nome_cliente || 'X')}
                          </div>
                          <div>
                            <div className="font-bold text-primary">{orcSelecionado.nome_cliente}</div>
                            <div className="font-mono text-xs text-muted-foreground">{orcSelecionado.codigo}</div>
                          </div>
                        </div>
                        <div className="space-y-2.5 text-sm">
                          {[
                            { label: 'Status', value: statusBadge(orcSelecionado.status) },
                            { label: 'Canal', value: orcSelecionado.canal === 'whatsapp' ? '📱 WhatsApp' : '💻 Site' },
                            { label: 'Serviço', value: orcSelecionado.servicos?.titulo || '—' },
                            { label: 'Telefone', value: orcSelecionado.telefone_cliente || '—' },
                            { label: 'Criado', value: orcSelecionado.criado_em ? new Date(orcSelecionado.criado_em).toLocaleString('pt-BR') : '—' },
                          ].map(f => (
                            <div key={f.label} className="flex items-start justify-between gap-3">
                              <span className="text-muted-foreground text-xs">{f.label}</span>
                              <span className="text-xs font-medium text-right">{f.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Prestador vinculado */}
                      {orcSelecionado.prestadores?.nome && (
                        <div className="bg-white rounded-2xl border p-5">
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Prestador</div>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center text-success font-bold text-sm">
                              {initials(orcSelecionado.prestadores.nome)}
                            </div>
                            <div>
                              <div className="font-bold text-sm">{orcSelecionado.prestadores.nome}</div>
                              {orcSelecionado.prestadores.telefone && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3 w-3" />{orcSelecionado.prestadores.telefone}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Resumo da IA */}
                      {orcSelecionado.resumo_anamnese && (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="h-4 w-4 text-success" />
                            <span className="text-xs font-bold text-success uppercase tracking-wider">Resumo gerado pela IA</span>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{orcSelecionado.resumo_anamnese}</p>
                        </div>
                      )}

                      {/* Valor */}
                      {orcSelecionado.valor_final && (
                        <div className="bg-white rounded-2xl border p-5">
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Valor acordado</div>
                          <div className="text-2xl font-bold text-success">
                            {Number(orcSelecionado.valor_final).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          {orcSelecionado.comissao_valor && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Comissão: {Number(orcSelecionado.comissao_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* COLUNA DIREITA — chat entre usuários */}
                    <div className="lg:col-span-2 space-y-4">
                      {/* Chat de negociação */}
                      <div className="bg-white rounded-2xl border overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            <span className="font-bold text-primary text-sm">Chat entre usuários</span>
                            <span className="text-xs text-muted-foreground">{mensagensChat.length} mensagens</span>
                          </div>
                          {chatDoOrc && (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                chatDoOrc.status === 'finalizado' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                              }`}>{chatDoOrc.status}</span>
                              <a
                                href={`${window.location.origin}/chat/${chatDoOrc.link_token}?papel=cliente`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary underline"
                              >
                                🔗 Abrir chat
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 min-h-0" style={{ maxHeight: '400px' }}>
                          {msgLoading ? (
                            <div className="flex justify-center py-8">
                              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                          ) : !chatDoOrc ? (
                            <div className="text-center py-10 text-muted-foreground">
                              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">Chat ainda não foi gerado para este ORC.</p>
                            </div>
                          ) : mensagensChat.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">Nenhuma mensagem no chat ainda.</p>
                              <p className="text-xs mt-1">O link foi enviado mas ninguém escreveu ainda.</p>
                            </div>
                          ) : (
                            mensagensChat.map((msg: any, i: number) => {
                              const isCliente = msg.remetente === 'cliente';
                              return (
                                <div key={i} className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}>
                                  <div className="max-w-[75%]">
                                    <div className={`text-xs font-semibold mb-1 ${isCliente ? 'text-right text-blue-600' : 'text-left text-green-700'}`}>
                                      {isCliente ? `👤 ${orcSelecionado.nome_cliente}` : `👷 ${orcSelecionado.prestadores?.nome || 'Prestador'}`}
                                    </div>
                                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                      isCliente ? 'bg-primary text-white rounded-tr-sm' : 'bg-slate-100 text-foreground rounded-tl-sm'
                                    }`}>
                                      {msg.tipo === 'texto' && msg.conteudo}
                                      {msg.tipo === 'imagem' && <img src={msg.conteudo} alt="imagem" className="rounded-xl max-w-full max-h-48 object-cover" />}
                                      {msg.tipo === 'audio' && <audio controls src={msg.conteudo} className="max-w-full" />}
                                    </div>
                                    <div className={`text-xs text-muted-foreground mt-1 ${isCliente ? 'text-right' : 'text-left'}`}>
                                      {new Date(msg.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Anamnese com IA — colapsável */}
                      {mensagens.length > 0 && (
                        <details className="bg-slate-50 border border-border rounded-2xl overflow-hidden">
                          <summary className="px-5 py-3 cursor-pointer text-xs font-semibold text-muted-foreground flex items-center gap-2 select-none">
                            <Sparkles className="h-3.5 w-3.5" /> Anamnese com IA ({mensagens.length} msgs) — clique para expandir
                          </summary>
                          <div className="p-5 flex flex-col gap-2 max-h-64 overflow-y-auto">
                            {mensagens.map((msg: any, i: number) => {
                              const isCliente = msg.remetente === 'cliente';
                              const isSistema = msg.remetente === 'sistema';
                              return (
                                <div key={i} className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}>
                                  {isSistema ? (
                                    <div className="self-center bg-slate-200 text-slate-500 text-xs px-3 py-1 rounded-full">
                                      Sistema: {msg.conteudo}
                                    </div>
                                  ) : (
                                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${isCliente ? 'bg-blue-100 text-blue-900' : 'bg-white border text-slate-700'}`}>
                                      {msg.conteudo}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {loading && aba !== 'kanban' && (
            <div className="flex justify-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {/* HISTÓRICO DE CHATS */}
          {!loading && aba === 'chats' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">{(dados.chats || []).length} chats registrados</span>
              </div>
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>
                      {['ORC', 'Serviço', 'Cliente', 'Prestador', 'Status', 'Mensagens', 'Link', 'Data'].map(h => (
                        <th key={h} className={th}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(dados.chats || []).map((c: any) => {
                        const frontendUrl = window.location.origin;
                        const statusColor: Record<string, string> = {
                          conversando: 'bg-blue-100 text-blue-800',
                          aguardando_orcamento: 'bg-amber-100 text-amber-800',
                          orcamento_enviado: 'bg-purple-100 text-purple-800',
                          finalizado: 'bg-green-100 text-green-800',
                        };
                        return (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className={td}><span className="font-mono font-bold text-primary text-xs">{c.orcs?.codigo || '—'}</span></td>
                            <td className={td + ' text-xs text-muted-foreground max-w-[140px] truncate'}>{c.orcs?.servico_nome || '—'}</td>
                            <td className={td}><span className="text-sm font-medium">{c.orcs?.nome_cliente || '—'}</span></td>
                            <td className={td}><span className="text-sm">{c.orcs?.prestadores?.nome || '—'}</span></td>
                            <td className={td}>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor[c.status] || 'bg-slate-100 text-slate-600'}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className={td + ' text-center'}>
                              <span className="text-sm font-bold text-primary">{c.total_mensagens}</span>
                            </td>
                            <td className={td}>
                              <div className="flex gap-2">
                                <a href={`${frontendUrl}/chat/${c.link_token}?papel=cliente`} target="_blank" rel="noreferrer"
                                  className="text-xs text-blue-600 underline">👤 Cliente</a>
                                <a href={`${frontendUrl}/chat/${c.link_token}?papel=prestador`} target="_blank" rel="noreferrer"
                                  className="text-xs text-green-700 underline">👷 Prestador</a>
                              </div>
                            </td>
                            <td className={td + ' text-xs text-muted-foreground whitespace-nowrap'}>
                              {c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '—'}
                              {c.finalizado_em && <div className="text-green-600">Finalizado {new Date(c.finalizado_em).toLocaleDateString('pt-BR')}</div>}
                            </td>
                          </tr>
                        );
                      })}
                      {(dados.chats || []).length === 0 && (
                        <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">Nenhum chat registrado ainda.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DASHBOARD */}
          {!loading && aba === 'dashboard' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { l: 'Total ORCs', v: dados.total_orcs || 0, ic: '📋' },
                { l: 'ORCs Ativos', v: dados.orcs_ativos || 0, ic: '⚡' },
                { l: 'Prestadores', v: dados.total_prestadores || 0, ic: '👷' },
                { l: 'Verificados', v: dados.prestadores_verificados || 0, ic: '🤳' },
                { l: 'Contratantes', v: dados.total_usuarios || 0, ic: '👤' },
                { l: 'Contratos', v: dados.total_contratos || 0, ic: '📄' },
                { l: 'Comissão Total', v: 'R$ ' + (dados.total_comissao || 0).toFixed(2), ic: '💰' },
              ].map(s => (
                <div key={s.l} className="bg-white rounded-2xl border p-5">
                  <div className="text-2xl mb-2">{s.ic}</div>
                  <div className="text-2xl font-bold text-primary">{s.v}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* PRESTADORES */}
          {!loading && aba === 'prestadores' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-muted-foreground">{(dados.prestadores || []).length} prestadores cadastrados</span>
                <button onClick={() => setModalPrestador(true)}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                  <Plus className="h-4 w-4" /> Novo Prestador
                </button>
              </div>
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Nome', 'Telefone', 'Cidade', 'Status', 'Verificado', 'Ação'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.prestadores || []).map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className={td}>
                            <div className="font-semibold">{p.nome}</div>
                            {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                          </td>
                          <td className={td}>{p.telefone}</td>
                          <td className={td}>{p.cidade}</td>
                          <td className={td}><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span></td>
                          <td className={td}><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.verificado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{p.verificado ? '✓ Verificado' : 'Pendente'}</span></td>
                          <td className={td}><button onClick={() => toggleVerificado(p.id, p.verificado)} className={`text-xs px-3 py-1 rounded-lg font-semibold ${p.verificado ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{p.verificado ? 'Remover' : 'Aprovar'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MODAL NOVO PRESTADOR */}
              {modalPrestador && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setModalPrestador(false); }}>
                  <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                      <h3 className="font-bold text-primary">Novo Prestador</h3>
                      <button onClick={() => setModalPrestador(false)}><X className="h-5 w-5" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                      {[
                        { label: 'Nome completo *', key: 'nome', placeholder: 'João Silva', type: 'text' },
                        { label: 'Telefone * (com DDI+DDD)', key: 'telefone', placeholder: '5555999998888', type: 'text' },
                        { label: 'Email', key: 'email', placeholder: 'joao@email.com', type: 'email' },
                        { label: 'Senha (para acesso ao painel)', key: 'senha', placeholder: '••••••••', type: 'password' },
                        { label: 'CPF', key: 'cpf', placeholder: '000.000.000-00', type: 'text' },
                        { label: 'Cidade', key: 'cidade', placeholder: 'Santa Maria', type: 'text' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">{f.label}</label>
                          <input type={f.type} value={(formPrestador as any)[f.key] || ''} onChange={e => setFormPrestador((p: any) => ({ ...p, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
                        </div>
                      ))}
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Bio / Apresentação</label>
                        <textarea value={formPrestador.bio || ''} onChange={e => setFormPrestador((p: any) => ({ ...p, bio: e.target.value }))}
                          placeholder="Breve apresentação do prestador..."
                          rows={3} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary resize-none" />
                      </div>
                      <button onClick={salvarPrestador} disabled={salvando}
                        className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                        {salvando ? 'Salvando...' : '✓ Cadastrar prestador'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* USUARIOS */}
          {!loading && aba === 'usuarios' && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className={tbl}>
                  <thead><tr>{['Nome', 'Email', 'Telefone', 'Cidade', 'Cadastro'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(dados.usuarios || []).map((u: any) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className={td}><span className="font-semibold">{u.nome}</span></td>
                        <td className={td + " text-xs"}>{u.email}</td>
                        <td className={td}>{u.telefone}</td>
                        <td className={td}>{u.cidade}</td>
                        <td className={td + " text-xs text-muted-foreground"}>{u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SERVIÇOS */}
          {!loading && aba === 'servicos' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-muted-foreground">{(dados.servicos || []).length} serviços cadastrados</span>
                <button onClick={() => { setModalServico(true); supabase.from('prestadores').select('id,nome').eq('ativo', true).order('nome').then(({ data }) => setPrestadoresList(data || [])); supabase.from('categorias').select('id,nome,icone').eq('ativa', true).order('nome').then(({ data }) => setCategoriasList(data || [])); }}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                  <Plus className="h-4 w-4" /> Novo Serviço
                </button>
              </div>
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Título', 'Categoria', 'Prestador', 'Online', 'Status'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.servicos || []).map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className={td}><span className="font-semibold">{s.titulo}</span></td>
                          <td className={td}>{s.categorias?.nome || '—'}</td>
                          <td className={td}>{s.prestadores?.nome || '—'}</td>
                          <td className={td}><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.aceita_orcamento_online ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>{s.aceita_orcamento_online ? '✓ Sim' : 'Não'}</span></td>
                          <td className={td}><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MODAL NOVO SERVIÇO */}
              {modalServico && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setModalServico(false); }}>
                  <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                      <h3 className="font-bold text-primary">Novo Serviço</h3>
                      <button onClick={() => setModalServico(false)}><X className="h-5 w-5" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Título do serviço *</label>
                        <input value={formServico.titulo} onChange={e => setFormServico((f: any) => ({ ...f, titulo: e.target.value }))}
                          placeholder="Ex: Instalação elétrica residencial"
                          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Prestador *</label>
                        <select value={formServico.prestador_id} onChange={e => setFormServico((f: any) => ({ ...f, prestador_id: e.target.value }))}
                          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white">
                          <option value="">Selecione o prestador</option>
                          {prestadoresList.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Categoria</label>
                        <select value={formServico.categoria_id} onChange={e => setFormServico((f: any) => ({ ...f, categoria_id: e.target.value }))}
                          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white">
                          <option value="">Selecione a categoria</option>
                          {categoriasList.map((c: any) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Descrição</label>
                        <textarea value={formServico.descricao} onChange={e => setFormServico((f: any) => ({ ...f, descricao: e.target.value }))}
                          placeholder="Descrição do serviço (opcional)"
                          rows={3} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary resize-none" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Tipo de preço</label>
                          <select value={formServico.tipo} onChange={e => setFormServico((f: any) => ({ ...f, tipo: e.target.value }))}
                            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white">
                            <option value="orcamento">Sob orçamento</option>
                            <option value="fixo">Preço fixo</option>
                          </select>
                        </div>
                        {formServico.tipo === 'fixo' && (
                          <div className="flex-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Valor (R$)</label>
                            <input type="number" value={formServico.valor_fixo || ''} onChange={e => setFormServico((f: any) => ({ ...f, valor_fixo: e.target.value }))}
                              placeholder="0,00" className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
                          </div>
                        )}
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={formServico.aceita_online || false} onChange={e => setFormServico((f: any) => ({ ...f, aceita_online: e.target.checked }))}
                          className="w-4 h-4 rounded" />
                        <span className="text-sm">Aceita orçamento online (sem visita)</span>
                      </label>
                      <button onClick={salvarServico} disabled={salvando}
                        className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                        {salvando ? 'Salvando...' : '✓ Criar serviço'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CATEGORIAS */}
          {!loading && aba === 'categorias' && (
            <div>
              {/* Formulário nova categoria */}
              <div className="bg-white rounded-2xl border p-5 mb-4">
                <h3 className="font-bold text-primary text-sm mb-3">Nova Categoria</h3>
                <div className="flex gap-3 flex-wrap">
                  <input id="cat-icone" placeholder="Ícone (ex: 🔧)" maxLength={4}
                    className="w-24 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-center text-xl" />
                  <input id="cat-nome" placeholder="Nome da categoria"
                    className="flex-1 min-w-[160px] border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary" />
                  <input id="cat-descricao" placeholder="Descrição (opcional)"
                    className="flex-1 min-w-[200px] border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary" />
                  <button
                    onClick={async () => {
                      const icone = (document.getElementById('cat-icone') as HTMLInputElement).value.trim();
                      const nome = (document.getElementById('cat-nome') as HTMLInputElement).value.trim();
                      const descricao = (document.getElementById('cat-descricao') as HTMLInputElement).value.trim();
                      if (!nome) return alert('Nome obrigatório');
                      await supabase.from('categorias').insert({ nome, icone: icone || '📋', descricao: descricao || null, ativa: true });
                      (document.getElementById('cat-nome') as HTMLInputElement).value = '';
                      (document.getElementById('cat-icone') as HTMLInputElement).value = '';
                      (document.getElementById('cat-descricao') as HTMLInputElement).value = '';
                      carregarDados('categorias');
                    }}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" /> Adicionar
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Ícone', 'Nome', 'Descrição', 'Status', 'Ação'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.categorias || []).map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className={td + ' text-xl'}>{c.icone || '📋'}</td>
                          <td className={td}><span className="font-semibold">{c.nome}</span></td>
                          <td className={td + ' text-xs text-muted-foreground'}>{c.descricao || '—'}</td>
                          <td className={td}>
                            <button
                              onClick={async () => {
                                await supabase.from('categorias').update({ ativa: !c.ativa }).eq('id', c.id);
                                carregarDados('categorias');
                              }}
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold cursor-pointer ${c.ativa ? 'bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-800' : 'bg-red-100 text-red-800 hover:bg-green-100 hover:text-green-800'}`}
                            >
                              {c.ativa ? 'Ativa' : 'Inativa'}
                            </button>
                          </td>
                          <td className={td}>
                            <button
                              onClick={async () => {
                                if (!confirm(`Remover categoria "${c.nome}"? Serviços vinculados perdem a categoria.`)) return;
                                await supabase.from('categorias').delete().eq('id', c.id);
                                carregarDados('categorias');
                              }}
                              className="text-xs px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CONTRATOS */}
          {!loading && aba === 'contratos' && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className={tbl}>
                  <thead><tr>{['ORC', 'Tipo', 'Valor', 'Contratante', 'Prestador', 'Status'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(dados.contratos || []).map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className={td}><span className="font-mono font-bold text-primary text-xs">{c.orcs?.codigo}</span></td>
                        <td className={td}>{c.tipo === 'carta_aceite' ? '📜 Carta Aceite' : '🛡️ Contrato Seguro'}</td>
                        <td className={td}><span className="font-bold text-success">R$ {Number(c.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></td>
                        <td className={td}>{c.assinado_cliente ? '✅' : '⏳'}</td>
                        <td className={td}>{c.assinado_prestador ? '✅' : '⏳'}</td>
                        <td className={td}><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.assinado_cliente && c.assinado_prestador ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{c.assinado_cliente && c.assinado_prestador ? 'Assinado' : 'Pendente'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AVALIAÇÕES */}
          {!loading && aba === 'avaliacoes' && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className={tbl}>
                  <thead><tr>{['Avaliado', 'Tipo', 'Nota', 'Comentário', 'Data'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(dados.avaliacoes || []).map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className={td}>{a.avaliado_id?.substring(0, 8)}...</td>
                        <td className={td}>{a.avaliado_tipo}</td>
                        <td className={td}>{'⭐'.repeat(a.nota)}</td>
                        <td className={td + " text-xs text-muted-foreground max-w-xs truncate"}>{a.comentario || '—'}</td>
                        <td className={td + " text-xs text-muted-foreground"}>{a.criado_em ? new Date(a.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COMISSÕES */}
          {!loading && aba === 'comissoes' && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Edite o valor da taxa diretamente na tabela e clique em Salvar.</p>
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Ordem', 'Valor Mín', 'Valor Máx', 'Tipo', 'Taxa', 'Ação'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.comissoes || []).map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className={td}><span className="font-semibold">#{c.ordem}</span></td>
                          <td className={td}>R$ {Number(c.valor_min || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className={td}>{c.valor_max ? 'R$ ' + Number(c.valor_max).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'Sem limite'}</td>
                          <td className={td}>{c.tipo === 'fixo' ? 'Fixo (R$)' : 'Percentual (%)'}</td>
                          <td className={td}>
                            <input
                              type="number"
                              defaultValue={c.valor}
                              id={`comissao-${c.id}`}
                              className="w-24 border border-border rounded-lg px-2 py-1 text-sm outline-none focus:border-primary font-bold text-success"
                            />
                          </td>
                          <td className={td}>
                            <button
                              onClick={async () => {
                                const input = document.getElementById(`comissao-${c.id}`) as HTMLInputElement;
                                const novoValor = parseFloat(input.value);
                                if (isNaN(novoValor)) return;
                                await supabase.from('comissoes').update({ valor: novoValor }).eq('id', c.id);
                                carregarDados('comissoes');
                              }}
                              className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold transition-colors"
                            >
                              Salvar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BIOMETRIA */}
          {!loading && aba === 'biometria' && (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                  <div className="text-2xl font-bold text-success">{(dados.biometria || []).filter((p: any) => p.verificado).length}</div>
                  <div className="text-sm text-green-700">Verificados</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <div className="text-2xl font-bold text-amber-600">{(dados.biometria || []).filter((p: any) => !p.verificado).length}</div>
                  <div className="text-sm text-amber-700">Pendentes</div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Nome', 'Telefone', 'Cidade', 'Status', 'Ação'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.biometria || []).map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className={td}><span className="font-semibold">{p.nome}</span></td>
                          <td className={td}>{p.telefone}</td>
                          <td className={td}>{p.cidade}</td>
                          <td className={td}><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.verificado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{p.verificado ? '🤳 Verificado' : '⏳ Pendente'}</span></td>
                          <td className={td}><button onClick={() => toggleVerificado(p.id, p.verificado)} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${p.verificado ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>{p.verificado ? '✕ Remover' : '✓ Aprovar'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CONFIG — PROMPTS DA IA */}
          {aba === 'config' && (
            <AdminPrompts />
          )}

        </div>
      </div>

      {mobileMenu && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileMenu(false)} />}
    </div>
  );
}
