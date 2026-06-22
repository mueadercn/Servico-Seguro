import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  LayoutDashboard, ClipboardList, Users, Wrench, Tag, Star,
  DollarSign, Settings, Shield, FileText, LogOut, ArrowLeft,
  MessageSquare, Sparkles, Clock, AlertTriangle, ChevronRight,
  UserPlus, CheckCircle2, Phone, Calendar, Trophy, X, Plus,
  RefreshCw, Menu
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { AdminPrompts } from './AdminPrompts';
import { supabase, apiCall } from '../../lib/supabase';

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_SENHA = 'admin123';

function ComissaoTemplateEditor({ onSave }: { onSave: () => void }) {
  const [template, setTemplate] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('configuracoes').select('valor').eq('chave', 'comissao_mensagem_template').maybeSingle()
      .then(({ data }) => { if (data?.valor) setTemplate(data.valor); });
  }, []);

  const salvar = async () => {
    await supabase.from('configuracoes').upsert({ chave: 'comissao_mensagem_template', valor: template }, { onConflict: 'chave' });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSave();
  };

  return (
    <div>
      <textarea
        value={template}
        onChange={e => setTemplate(e.target.value)}
        rows={5}
        placeholder={`Exemplo:\n💰 Olá {NOME}! O contrato {ORC} foi assinado.\nA comissão é de {VALOR}. Pague via PIX: chave@email.com`}
        className="w-full border border-[#e2e8f0] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#030213] font-mono resize-none"
      />
      <button onClick={salvar} className="mt-2 bg-[#030213] text-white text-sm font-bold px-4 py-2 rounded-[10px] hover:bg-[#030213]/90 transition-colors">
        {saved ? '✓ Salvo' : 'Salvar template'}
      </button>
    </div>
  );
}

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
  { id: 'comissoes-contratos', label: 'Comissões Contratos', icon: DollarSign },
  { id: 'biometria', label: 'Verificações', icon: Shield },
  { id: 'suporte', label: 'Suporte', icon: MessageSquare },
  { id: 'config', label: 'Configurações', icon: Settings },
];

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

  const [orcs, setOrcs] = useState<ORC[]>([]);
  const [orcsLoading, setOrcsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [faseSelecionada, setFaseSelecionada] = useState<Fase | null>(null);
  const [orcSelecionado, setOrcSelecionado] = useState<ORC | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [chatDoOrc, setChatDoOrc] = useState<any | null>(null);
  const [mensagensChat, setMensagensChat] = useState<any[]>([]);

  const [modalServico, setModalServico] = useState(false);
  const [modalPrestador, setModalPrestador] = useState(false);
  const [formServico, setFormServico] = useState<any>({ titulo: '', descricao: '', prestador_id: '', categoria_id: '', tipo: 'orcamento' });
  const [formPrestador, setFormPrestador] = useState<any>({ nome: '', email: '', telefone: '', cidade: 'Santa Maria', cpf: '', bio: '' });
  const [prestadoresList, setPrestadoresList] = useState<any[]>([]);
  const [categoriasList, setCategoriasList] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [modalEditContrato, setModalEditContrato] = useState(false);
  const [editandoContratoId, setEditandoContratoId] = useState('');
  const [prestadorDetalhe, setPrestadorDetalhe] = useState<any>(null);
  const [docsAssinados, setDocsAssinados] = useState<{ selfie_url: string | null; doc_url: string | null } | null>(null);
  const [formContrato, setFormContrato] = useState({ tipo: '', valor: '', prazo: '', pagamento: '', garantia: '', comissao: '' });
  const [erroContrato, setErroContrato] = useState('');

  const [servicoDetalhe, setServicoDetalhe] = useState<any>(null);
  const [filtroServicoCidade, setFiltroServicoCidade] = useState('');
  const [chatSelecionado, setChatSelecionado] = useState<any | null>(null);
  const [chatMsgsDetalhe, setChatMsgsDetalhe] = useState<any[]>([]);
  const [chatMsgDetalhando, setChatMsgDetalhando] = useState(false);

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

  async function carregarMensagens(orcId: string) {
    setMsgLoading(true);
    try {
      const { chat, mensagens: msgsChat } = await apiCall(`/api/chat/orc/${orcId}`);
      setChatDoOrc(chat || null);
      setMensagensChat(msgsChat || []);
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
      await supabase.from('mensagens').delete().eq('orc_id', orcId);
      await supabase.from('sessoes_whatsapp').delete().eq('id', orcId);
      await supabase.from('orcs').delete().eq('id', orcId);
      setOrcs(prev => prev.filter(o => o.id !== orcId));
    } catch (e) {
      console.warn('Erro ao deletar ORC:', e);
    }
  }

  async function abrirChatDetalhe(c: any) {
    setChatSelecionado(c);
    setChatMsgDetalhando(true);
    try {
      const { data } = await supabase
        .from('chat_mensagens')
        .select('*')
        .eq('chat_id', c.id)
        .order('criado_em', { ascending: true });
      setChatMsgsDetalhe(data || []);
    } catch {
      setChatMsgsDetalhe([]);
    }
    setChatMsgDetalhando(false);
  }

  async function carregarDados(pagina: string) {
    setLoading(true);
    try {
      if (pagina === 'chats') {
        try {
          const data = await apiCall('/api/chat/admin/all');
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
        } catch (e) {
          console.warn('[Admin] Erro ao carregar chats:', e);
          setDados({ chats: [] });
        }
      } else if (pagina === 'dashboard') {
        const agora = new Date();
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
        const inicioMesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
        const fimMesPassado = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59).toISOString();
        const [o, p, u, c, chats, orcsMes, orcsPassado, cMes] = await Promise.all([
          supabase.from('orcs').select('id, status, criado_em'),
          supabase.from('prestadores').select('id, ativo, verificado, criado_em'),
          supabase.from('usuarios').select('id, criado_em'),
          supabase.from('contratos').select('id, valor, comissao, assinado_cliente, assinado_prestador, criado_em'),
          supabase.from('chat_negociacao').select('id, status'),
          supabase.from('orcs').select('id').gte('criado_em', inicioMes),
          supabase.from('orcs').select('id').gte('criado_em', inicioMesPassado).lte('criado_em', fimMesPassado),
          supabase.from('contratos').select('id, valor, comissao').gte('criado_em', inicioMes),
        ]);
        const contratos = c.data || [];
        const contratosAssinados = contratos.filter((x: any) => x.assinado_cliente && x.assinado_prestador);
        const faturamentoTotal = contratos.reduce((a: number, x: any) => a + (Number(x.valor) || 0), 0);
        const faturamentoMes = (cMes.data || []).reduce((a: number, x: any) => a + (Number(x.valor) || 0), 0);
        const comissaoTotal = contratos.reduce((a: number, x: any) => a + (Number(x.comissao) || 0), 0);
        const comissaoMes = (cMes.data || []).reduce((a: number, x: any) => a + (Number(x.comissao) || 0), 0);
        const orcsTotalMes = orcsMes.data?.length || 0;
        const orcsTotalPassado = orcsPassado.data?.length || 0;
        const crescimento = orcsTotalPassado > 0 ? Math.round(((orcsTotalMes - orcsTotalPassado) / orcsTotalPassado) * 100) : null;
        const taxaConversao = (o.data?.length || 0) > 0 ? Math.round((contratosAssinados.length / (o.data?.length || 1)) * 100) : 0;
        const chatsAtivos = (chats.data || []).filter((x: any) => !['contrato_gerado', 'finalizado'].includes(x.status)).length;
        setDados({
          total_orcs: o.data?.length || 0,
          orcs_ativos: o.data?.filter((x: any) => !['ENCERRADO', 'CANCELADO'].includes(x.status)).length || 0,
          orcs_mes: orcsTotalMes,
          crescimento_mes: crescimento,
          total_prestadores: p.data?.length || 0,
          prestadores_ativos: p.data?.filter((x: any) => x.ativo).length || 0,
          prestadores_verificados: p.data?.filter((x: any) => x.verificado).length || 0,
          total_usuarios: u.data?.length || 0,
          usuarios_mes: (u.data || []).filter((x: any) => x.criado_em >= inicioMes).length,
          total_contratos: contratos.length,
          contratos_assinados: contratosAssinados.length,
          faturamento_total: faturamentoTotal,
          faturamento_mes: faturamentoMes,
          comissao_total: comissaoTotal,
          comissao_mes: comissaoMes,
          taxa_conversao: taxaConversao,
          chats_ativos: chatsAtivos,
        });
      } else if (pagina === 'prestadores') {
        const { data } = await supabase.from('prestadores').select('*').order('criado_em', { ascending: false });
        setDados({ prestadores: data || [] });
      } else if (pagina === 'usuarios') {
        const { data } = await supabase.from('usuarios').select('*').order('criado_em', { ascending: false });
        setDados({ usuarios: data || [] });
      } else if (pagina === 'servicos') {
        const { data } = await supabase.from('servicos').select('*, prestadores(nome, cidade), categorias(nome,icone)').order('criado_em', { ascending: false });
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
      } else if (pagina === 'comissoes-contratos') {
        const res = await apiCall('/api/admin/comissoes-contratos');
        setDados({ comissoesContratos: res.comissoes || [] });
      } else if (pagina === 'biometria') {
        const { data } = await supabase.from('prestadores').select('id,nome,telefone,cidade,verificado').order('criado_em', { ascending: false });
        setDados({ biometria: data || [] });
      } else if (pagina === 'suporte') {
        const res = await apiCall('/api/admin/suporte');
        setDados({ suporte: res.mensagens || [] });
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

  function abrirEditContrato(c: any) {
    setEditandoContratoId(c.id);
    setFormContrato({
      tipo: c.tipo || 'carta_aceite',
      valor: String(c.valor || ''),
      prazo: c.prazo || '',
      pagamento: c.pagamento || '',
      garantia: c.garantia || '',
      comissao: String(c.comissao || ''),
    });
    setErroContrato('');
    setModalEditContrato(true);
  }

  async function salvarContrato() {
    setErroContrato('');
    setSalvando(true);
    try {
      await apiCall(`/api/contratos/${editandoContratoId}`, {
        method: 'PUT',
        body: formContrato,
      });
      setModalEditContrato(false);
      carregarDados('contratos');
    } catch (e: any) {
      setErroContrato(e.message || 'Erro ao salvar.');
    }
    setSalvando(false);
  }

  async function toggleVerificado(id: string, atual: boolean) {
    await supabase.from('prestadores').update({ verificado: !atual }).eq('id', id);
    carregarDados('prestadores');
  }

  async function abrirDetalhe(p: any) {
    setPrestadorDetalhe(p);
    setDocsAssinados(null);
    try {
      const res = await apiCall(`/api/admin/prestadores/${p.id}/docs`);
      if (res.ok) setDocsAssinados({ selfie_url: res.selfie_url, doc_url: res.doc_url });
    } catch {}
  }

  const statusBadge = (s: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      'NOVO':                    { bg: '#E6F1FB', color: '#0C447C' },
      'EM ANAMNESE':             { bg: '#E6F1FB', color: '#0C447C' },
      'ANAMNESE CONCLUÍDA':      { bg: '#ececf0', color: '#030213' },
      'PRESTADOR NOTIFICADO':    { bg: '#ececf0', color: '#030213' },
      'AGUARDANDO PRESTADOR':    { bg: '#ececf0', color: '#030213' },
      'VISITA AGENDADA':         { bg: '#E6F1FB', color: '#0C447C' },
      'ORÇAMENTO ONLINE':        { bg: '#E6F1FB', color: '#0C447C' },
      'VISITA REALIZADA':        { bg: '#ececf0', color: '#030213' },
      'FECHADO':                 { bg: '#EEEDFE', color: '#26215C' },
      'CONTRATO GERADO':         { bg: '#EEEDFE', color: '#26215C' },
      'AGUARDANDO ASSINATURA':   { bg: '#EEEDFE', color: '#26215C' },
      'CONTRATO ASSINADO':       { bg: 'oklch(0.95 0.03 184)', color: 'oklch(0.45 0.1 184)' },
      'SERVIÇO CONCLUÍDO':       { bg: '#EAF3DE', color: '#173404' },
      'DIVERGÊNCIA DE VALOR':    { bg: '#FCEBEB', color: '#501313' },
      'SEM RESPOSTA PRESTADOR':  { bg: '#FCEBEB', color: '#501313' },
      'SEM RESPOSTA CLIENTE':    { bg: '#FCEBEB', color: '#501313' },
      'NÃO FECHOU':              { bg: '#f1f5f9', color: '#64748b' },
      'CANCELADO':               { bg: '#f1f5f9', color: '#64748b' },
      'ENCERRADO':               { bg: '#f1f5f9', color: '#64748b' },
    };
    const style = map[s] || { bg: '#f1f5f9', color: '#64748b' };
    return (
      <span className="inline-flex rounded-full text-[10.5px] font-bold px-2.5 py-0.5 whitespace-nowrap"
        style={{ background: style.bg, color: style.color }}>
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

  const tbl = 'w-full text-left border-collapse';
  const th = 'px-5 py-3 text-[11px] font-bold uppercase text-[#64748b] tracking-wider bg-[#f8fafc] border-b border-[#e2e8f0]';
  const td = 'px-5 py-3.5 border-b border-[#f1f5f9] text-sm';

  // ── MODAL SHARED STYLES ─────────────────────────────────────
  const inputCls = 'w-full border border-[#e2e8f0] rounded-[12px] px-3 py-2.5 text-sm outline-none focus:border-[#030213]';
  const labelCls = 'text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block';

  // ── LOGIN ─────────────────────────────────────────────────
  if (!logado) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="bg-white rounded-[20px] border border-[#e2e8f0] p-8 w-full max-w-sm shadow-[0_8px_32px_-8px_rgba(3,2,19,0.12)]">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mx-auto mb-3" style={{ background: '#030213' }}>
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="font-extrabold text-[#030213] text-xl">Painel Admin</h2>
          <p className="text-[#64748b] text-sm mt-1">Serviço Seguro</p>
        </div>
        {erroLogin && (
          <div className="bg-[#FCEBEB] border border-[#f5c6c6] text-[#501313] text-sm px-4 py-3 rounded-[12px] mb-4">
            {erroLogin}
          </div>
        )}
        <div className="space-y-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" className={inputCls} />
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fazerLogin()}
            placeholder="Senha" className={inputCls} />
          <button onClick={fazerLogin}
            className="w-full py-3 bg-[#030213] text-white rounded-[12px] font-bold text-sm hover:bg-[#030213]/90 transition-colors">
            Entrar no painel
          </button>
        </div>
      </div>
    </div>
  );

  // ── LAYOUT ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc] flex">

      {/* SIDEBAR */}
      <aside className={`w-[250px] flex-shrink-0 bg-[#030213] text-white min-h-screen flex flex-col sticky top-0 h-screen overflow-y-auto z-40 fixed left-0 top-0 transition-transform lg:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-[9px] flex items-center justify-center text-sm font-bold">SS</div>
            <div>
              <div className="font-extrabold text-sm leading-tight">Serviço Seguro</div>
              <div className="text-[10px] text-white/45 uppercase tracking-widest mt-0.5">Painel Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = aba === id;
            const alertCount = id === 'kanban' ? getLeadsDaFase(FASES.find(f => f.id === 'atencao')!).length : 0;
            return (
              <button key={id} onClick={() => irPara(id)}
                className={`w-full flex items-center gap-2.5 px-[13px] py-[10px] rounded-[10px] text-[13.5px] font-semibold transition-all relative ${isActive ? 'bg-[rgba(255,255,255,0.13)] text-white' : 'text-white/60 hover:bg-[rgba(255,255,255,0.08)] hover:text-white'}`}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {alertCount > 0 && id === 'kanban' && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom user row */}
        <div className="px-4 py-4 border-t border-white/10 flex items-center gap-2.5 mt-auto">
          <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
            style={{ background: 'oklch(0.6 0.118 184.704)', color: 'white' }}>
            AD
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm leading-tight">Admin</div>
            <div className="text-white/45 text-xs truncate">admin@admin.com</div>
          </div>
          <button onClick={() => { localStorage.removeItem('ss_admin'); setLogado(false); }}
            className="text-white/50 hover:text-white transition-colors ml-auto flex-shrink-0" title="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 lg:ml-[250px] flex flex-col min-h-screen">

        {/* TOPBAR */}
        <div className="bg-white border-b border-[#e2e8f0] px-7 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenu(!mobileMenu)}
              className="lg:hidden p-2 hover:bg-[#f8fafc] rounded-[10px] transition-colors">
              <Menu className="h-5 w-5 text-[#64748b]" />
            </button>
            <div>
              <h1 className="font-extrabold text-xl text-[#030213]">
                {navItems.find(n => n.id === aba)?.label || 'Admin'}
              </h1>
              {aba === 'kanban' && (
                <p className="text-sm text-[#64748b]">
                  {orcs.length} ORCs totais · {orcs.filter(o => !['ENCERRADO', 'NÃO FECHOU', 'CANCELADO'].includes(o.status)).length} ativos
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {aba === 'kanban' && (
              <button onClick={carregarOrcs}
                className="p-2 hover:bg-[#f8fafc] rounded-[10px] text-[#64748b] hover:text-[#030213] transition-colors border border-[#e2e8f0]">
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-6 flex-1">

          {/* ── KANBAN ─────────────────────────────────────── */}
          {aba === 'kanban' && (
            <div>
              {orcsLoading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-4 border-[#030213] border-t-transparent rounded-full" />
                </div>
              ) : (
                viewMode === 'kanban' && (
                  <div>
                    {/* KANBAN COLUMNS */}
                    <div className="flex gap-3.5 overflow-x-auto pb-4">
                      {FASES.map(fase => {
                        const leads = getLeadsDaFase(fase);
                        const count = leads.length;
                        const Icon = fase.icon;
                        return (
                          <div key={fase.id}
                            className="w-[270px] flex-shrink-0 bg-white rounded-[14px] border-t-[3px] overflow-hidden"
                            style={{ borderTopColor: fase.color }}>
                            {/* Column header */}
                            <div className="px-3.5 py-3 flex items-center justify-between border-b border-[#f1f5f9]">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" style={{ color: fase.color }} />
                                <span className="font-semibold text-[13.5px] text-[#030213]">{fase.label}</span>
                              </div>
                              <span className="rounded-full text-[10.5px] font-bold px-2 py-0.5 min-w-[22px] text-center"
                                style={{ background: fase.bg, color: fase.text }}>
                                {count}
                              </span>
                            </div>
                            {/* Cards */}
                            <div className="py-2 max-h-[calc(100vh-240px)] overflow-y-auto">
                              {leads.length === 0 ? (
                                <div className="mx-2 mb-2 py-6 text-center text-[#94a3b8] text-xs">
                                  Nenhum lead
                                </div>
                              ) : (
                                leads.map((orc: any) => (
                                  <div key={orc.id}
                                    className="mx-2 mb-2 border border-[#e2e8f0] rounded-[11px] p-3 cursor-pointer hover:shadow-[0_4px_12px_-2px_rgba(3,2,19,0.15)] hover:border-[#cbd5e1] transition-all"
                                    onClick={() => abrirOrc(orc)}>
                                    <div className="font-mono font-bold text-xs text-[#030213]">{orc.codigo}</div>
                                    <div className="text-[13px] text-[#475569] line-clamp-2 mt-1">
                                      {orc.canal === 'whatsapp' ? '📱 ' : '💻 '}
                                      {orc.servicos?.titulo || orc.resumo_anamnese?.split('\n')[0] || 'Sem resumo'}
                                    </div>
                                    <div className="text-[#94a3b8] text-xs mt-1">{orc.nome_cliente || '—'}</div>
                                    {orc.prestadores?.nome && (
                                      <div className="mt-1.5">
                                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                                          style={{ background: 'oklch(0.95 0.03 184)', color: 'oklch(0.45 0.1 184)' }}>
                                          👷 {orc.prestadores.nome}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-[#94a3b8] text-[11px]">{timeAgo(orc.criado_em)}</span>
                                      <button onClick={e => deletarOrc(orc.id, e)}
                                        className="text-[#f87171] hover:text-red-600 text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            {/* View all button */}
                            {count > 0 && (
                              <button onClick={() => abrirFase(fase)}
                                className="w-full px-3.5 py-2.5 text-[12px] font-semibold text-[#64748b] hover:text-[#030213] border-t border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors text-left flex items-center gap-1">
                                Ver todos <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* TABELA RESUMO */}
                    <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden mt-4">
                      <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                        <h2 className="font-bold text-[#030213]">Todos os ORCs recentes</h2>
                        <span className="text-xs text-[#64748b]">{orcs.length} total</span>
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
                              <tr key={o.id} className="hover:bg-[#f8fafc] cursor-pointer" onClick={() => abrirOrc(o)}>
                                <td className={td}><span className="font-mono font-bold text-[#030213] text-xs">{o.codigo}</span></td>
                                <td className={td}><span className="font-medium">{o.nome_cliente || '—'}</span></td>
                                <td className={`${td} text-xs text-[#64748b]`}>{o.servicos?.titulo || '—'}</td>
                                <td className={td}>{statusBadge(o.status)}</td>
                                <td className={`${td} max-w-xs`}>
                                  {o.resumo_anamnese ? (
                                    <div className="space-y-0.5">
                                      {o.resumo_anamnese.split('\n').filter((l: string) => l.trim()).slice(0, 2).map((l: string, i: number) => (
                                        <div key={i} className="text-xs text-[#64748b] flex items-start gap-1">
                                          <span className="text-[#3B6D11]">•</span>
                                          <span>{l.replace(/^[•\-\*]\s*/, '')}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-[#94a3b8] italic">Em andamento...</span>
                                  )}
                                </td>
                                <td className={`${td} text-xs text-[#64748b] whitespace-nowrap`}>
                                  <div>{timeAgo(o.criado_em)}</div>
                                  <button onClick={e => deletarOrc(o.id, e)}
                                    className="text-[#f87171] hover:text-red-600 text-xs mt-0.5">✕ remover</button>
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
                      className="flex items-center gap-2 text-sm text-[#64748b] hover:text-[#030213] transition-colors">
                      <ArrowLeft className="h-4 w-4" /> Kanban
                    </button>
                    <span className="text-[#94a3b8]">/</span>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-[8px]" style={{ background: faseSelecionada.bg }}>
                        <faseSelecionada.icon className="h-3.5 w-3.5" style={{ color: faseSelecionada.color }} />
                      </div>
                      <span className="font-bold text-[#030213]">{faseSelecionada.label}</span>
                      <span className="text-xs font-bold rounded-full px-2.5 py-0.5"
                        style={{ background: faseSelecionada.bg, color: faseSelecionada.text }}>
                        {getLeadsDaFase(faseSelecionada).length} leads
                      </span>
                    </div>
                  </div>

                  {getLeadsDaFase(faseSelecionada).length === 0 ? (
                    <div className="bg-white rounded-[14px] border border-[#e2e8f0] py-16 text-center text-[#94a3b8]">
                      <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhum lead nesta fase.</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {getLeadsDaFase(faseSelecionada).map((orc: any) => (
                        <div key={orc.id}
                          className="bg-white rounded-[14px] border border-[#e2e8f0] hover:shadow-[0_4px_12px_-2px_rgba(3,2,19,0.12)] hover:border-[#cbd5e1] transition-all cursor-pointer overflow-hidden"
                          onClick={() => abrirOrc(orc)}>
                          <div className="p-5">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 text-white"
                                style={{ background: 'oklch(0.6 0.118 184.704)' }}>
                                {initials(orc.nome_cliente || 'X')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-[#030213] truncate">{orc.nome_cliente || 'Cliente'}</div>
                                <div className="font-mono text-xs text-[#94a3b8]">{orc.codigo}</div>
                              </div>
                              {statusBadge(orc.status)}
                            </div>

                            <div className="flex items-center gap-2 text-sm text-[#64748b] mb-3">
                              <Wrench className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>{orc.servicos?.titulo || orc.servicos?.categorias?.nome || 'Serviço não especificado'}</span>
                            </div>

                            <div className={`rounded-[10px] p-3 mb-3 ${orc.resumo_anamnese ? 'bg-[#EAF3DE] border border-[#c8e6a8]' : 'bg-[#f8fafc] border border-[#e2e8f0]'}`}>
                              <div className="flex items-center gap-1.5 mb-2">
                                <Sparkles className="h-3 w-3 text-[#3B6D11]" />
                                <span className="text-xs font-bold text-[#3B6D11] uppercase tracking-wider">Resumo do serviço</span>
                              </div>
                              {orc.resumo_anamnese ? (
                                <div className="space-y-1">
                                  {orc.resumo_anamnese.split('\n').filter((l: string) => l.trim()).map((linha: string, i: number) => (
                                    <div key={i} className="flex items-start gap-1.5 text-xs text-[#030213]">
                                      <span className="text-[#3B6D11] mt-0.5 flex-shrink-0">•</span>
                                      <span className="leading-relaxed">{linha.replace(/^[•\-\*]\s*/, '')}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-[#94a3b8] italic">Anamnese em andamento...</p>
                              )}
                            </div>

                            {orc.prestadores?.nome && (
                              <div className="flex items-center gap-2 text-xs text-[#64748b] mb-3">
                                <Users className="h-3.5 w-3.5" />
                                <span>Prestador: <strong>{orc.prestadores.nome}</strong></span>
                                {orc.prestadores.telefone && (
                                  <span className="text-[#94a3b8]">· {orc.prestadores.telefone}</span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                              <Clock className="h-3 w-3" />
                              {timeAgo(orc.criado_em)}
                              {orc.canal && <span className="ml-2">{orc.canal === 'whatsapp' ? '📱 WhatsApp' : '💻 Site'}</span>}
                            </div>
                          </div>

                          <div className="px-5 py-3 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); abrirOrc(orc); }}
                              className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#030213] transition-colors">
                              <MessageSquare className="h-3.5 w-3.5" /> Ver conversa
                            </button>
                            {faseSelecionada.id === 'atencao' && (
                              <button
                                onClick={e => e.stopPropagation()}
                                className="ml-auto flex items-center gap-1.5 text-xs bg-[#FCEBEB] text-[#501313] px-3 py-1.5 rounded-[8px] hover:bg-red-200 transition-colors">
                                <AlertTriangle className="h-3.5 w-3.5" /> Resolver
                              </button>
                            )}
                            <button
                              onClick={e => deletarOrc(orc.id, e)}
                              className="ml-auto flex items-center gap-1 text-xs text-[#f87171] hover:text-red-600 hover:bg-[#FCEBEB] px-2 py-1.5 rounded-[8px] transition-colors">
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
                  <div className="flex items-center gap-2 mb-5 text-sm">
                    <button onClick={voltarParaKanban} className="text-[#64748b] hover:text-[#030213] transition-colors">Kanban</button>
                    <span className="text-[#94a3b8]">/</span>
                    <button onClick={voltarParaLista} className="text-[#64748b] hover:text-[#030213] transition-colors">
                      {faseSelecionada?.label}
                    </button>
                    <span className="text-[#94a3b8]">/</span>
                    <span className="font-bold text-[#030213]">{orcSelecionado.nome_cliente}</span>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-5">
                    <div className="space-y-4">
                      <div className="bg-white rounded-[14px] border border-[#e2e8f0] p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                            style={{ background: 'oklch(0.6 0.118 184.704)' }}>
                            {initials(orcSelecionado.nome_cliente || 'X')}
                          </div>
                          <div>
                            <div className="font-bold text-[#030213]">{orcSelecionado.nome_cliente}</div>
                            <div className="font-mono text-xs text-[#94a3b8]">{orcSelecionado.codigo}</div>
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
                              <span className="text-[#94a3b8] text-xs">{f.label}</span>
                              <span className="text-xs font-medium text-right text-[#030213]">{f.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {orcSelecionado.prestadores?.nome && (
                        <div className="bg-white rounded-[14px] border border-[#e2e8f0] p-5">
                          <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">Prestador</div>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white"
                              style={{ background: 'oklch(0.6 0.118 184.704)' }}>
                              {initials(orcSelecionado.prestadores.nome)}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-[#030213]">{orcSelecionado.prestadores.nome}</div>
                              {orcSelecionado.prestadores.telefone && (
                                <div className="text-xs text-[#94a3b8] flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3 w-3" />{orcSelecionado.prestadores.telefone}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {orcSelecionado.resumo_anamnese && (
                        <div className="bg-[#EAF3DE] border border-[#c8e6a8] rounded-[14px] p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="h-4 w-4 text-[#3B6D11]" />
                            <span className="text-xs font-bold text-[#3B6D11] uppercase tracking-wider">Resumo gerado pela IA</span>
                          </div>
                          <p className="text-sm text-[#030213] leading-relaxed">{orcSelecionado.resumo_anamnese}</p>
                        </div>
                      )}

                      {orcSelecionado.valor_final && (
                        <div className="bg-white rounded-[14px] border border-[#e2e8f0] p-5">
                          <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Valor acordado</div>
                          <div className="text-2xl font-extrabold text-[#3B6D11]">
                            {Number(orcSelecionado.valor_final).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          {orcSelecionado.comissao_valor && (
                            <div className="text-xs text-[#64748b] mt-1">
                              Comissão: {Number(orcSelecionado.comissao_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-[#030213]" />
                            <span className="font-bold text-[#030213] text-sm">Chat entre usuários</span>
                            <span className="text-xs text-[#94a3b8]">{mensagensChat.length} mensagens</span>
                          </div>
                          {chatDoOrc && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] font-bold rounded-full px-2.5 py-0.5"
                                style={chatDoOrc.status === 'finalizado'
                                  ? { background: '#EAF3DE', color: '#173404' }
                                  : { background: '#E6F1FB', color: '#0C447C' }}>
                                {chatDoOrc.status}
                              </span>
                              <a href={`${window.location.origin}/chat/${chatDoOrc.link_token}?papel=cliente`}
                                target="_blank" rel="noreferrer"
                                className="text-xs font-semibold underline" style={{ color: 'oklch(0.45 0.1 184)' }}>
                                🔗 Abrir chat
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 min-h-0" style={{ maxHeight: '400px' }}>
                          {msgLoading ? (
                            <div className="flex justify-center py-8">
                              <div className="animate-spin w-6 h-6 border-2 border-[#030213] border-t-transparent rounded-full" />
                            </div>
                          ) : !chatDoOrc ? (
                            <div className="text-center py-10 text-[#94a3b8]">
                              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">Chat ainda não foi gerado para este ORC.</p>
                            </div>
                          ) : mensagensChat.length === 0 ? (
                            <div className="text-center py-10 text-[#94a3b8]">
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
                                    <div className={`text-xs font-semibold mb-1 ${isCliente ? 'text-right text-blue-600' : 'text-left text-[#3B6D11]'}`}>
                                      {isCliente ? `👤 ${orcSelecionado.nome_cliente}` : `👷 ${orcSelecionado.prestadores?.nome || 'Prestador'}`}
                                    </div>
                                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isCliente ? 'bg-[#030213] text-white rounded-tr-sm' : 'bg-[#f8fafc] text-[#030213] rounded-tl-sm border border-[#e2e8f0]'}`}>
                                      {msg.tipo === 'texto' && msg.conteudo}
                                      {msg.tipo === 'imagem' && <img src={msg.conteudo} alt="imagem" className="rounded-xl max-w-full max-h-48 object-cover" />}
                                      {msg.tipo === 'audio' && <audio controls src={msg.conteudo} className="max-w-full" />}
                                    </div>
                                    <div className={`text-xs text-[#94a3b8] mt-1 ${isCliente ? 'text-right' : 'text-left'}`}>
                                      {new Date(msg.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {mensagens.length > 0 && (
                        <details className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[14px] overflow-hidden">
                          <summary className="px-5 py-3 cursor-pointer text-xs font-semibold text-[#64748b] flex items-center gap-2 select-none">
                            <Sparkles className="h-3.5 w-3.5" /> Anamnese com IA ({mensagens.length} msgs) — clique para expandir
                          </summary>
                          <div className="p-5 flex flex-col gap-2 max-h-64 overflow-y-auto">
                            {mensagens.map((msg: any, i: number) => {
                              const isCliente = msg.remetente === 'cliente';
                              const isSistema = msg.remetente === 'sistema';
                              return (
                                <div key={i} className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}>
                                  {isSistema ? (
                                    <div className="self-center bg-[#e2e8f0] text-[#64748b] text-xs px-3 py-1 rounded-full">
                                      Sistema: {msg.conteudo}
                                    </div>
                                  ) : (
                                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${isCliente ? 'bg-[#E6F1FB] text-[#0C447C]' : 'bg-white border border-[#e2e8f0] text-[#475569]'}`}>
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
              <div className="animate-spin w-8 h-8 border-4 border-[#030213] border-t-transparent rounded-full" />
            </div>
          )}

          {/* HISTÓRICO DE CHATS */}
          {!loading && aba === 'chats' && (
            <div className={chatSelecionado ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-[#64748b]">{(dados.chats || []).length} chats registrados — clique para ver detalhes</span>
                  {chatSelecionado && (
                    <button onClick={() => setChatSelecionado(null)} className="text-xs text-[#64748b] hover:text-[#030213]">✕ Fechar painel</button>
                  )}
                </div>
                <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className={tbl}>
                      <thead><tr>
                        {['ORC', 'Serviço', 'Cliente', 'Prestador', 'Status', 'Msgs', 'Data'].map(h => (
                          <th key={h} className={th}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {(dados.chats || []).map((c: any) => {
                          const statusColor: Record<string, { bg: string; color: string }> = {
                            conversando:           { bg: '#E6F1FB', color: '#0C447C' },
                            aguardando_orcamento:  { bg: '#FEF3C7', color: '#92400e' },
                            orcamento_enviado:     { bg: '#EEEDFE', color: '#26215C' },
                            elaborando_contrato:   { bg: '#EEEDFE', color: '#3C3489' },
                            contrato_gerado:       { bg: '#FFF3E0', color: '#7c3b0a' },
                            finalizado:            { bg: '#EAF3DE', color: '#173404' },
                          };
                          const sc = statusColor[c.status] || { bg: '#f1f5f9', color: '#64748b' };
                          const selecionado = chatSelecionado?.id === c.id;
                          return (
                            <tr key={c.id} onClick={() => abrirChatDetalhe(c)}
                              className={`cursor-pointer transition-colors ${selecionado ? 'bg-[#f8fafc]' : 'hover:bg-[#f8fafc]'}`}>
                              <td className={td}><span className="font-mono font-bold text-[#030213] text-xs">{c.orcs?.codigo || '—'}</span></td>
                              <td className={`${td} text-xs text-[#64748b] max-w-[120px] truncate`}>{c.orcs?.servicos?.titulo || c.orcs?.servico_nome || '—'}</td>
                              <td className={td}><span className="font-medium">{c.orcs?.nome_cliente || '—'}</span></td>
                              <td className={td}><span>{c.orcs?.prestadores?.nome || '—'}</span></td>
                              <td className={td}>
                                <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                                  style={{ background: sc.bg, color: sc.color }}>
                                  {c.status}
                                </span>
                              </td>
                              <td className={`${td} text-center`}>
                                <span className="font-bold text-[#030213]">{c.total_mensagens}</span>
                              </td>
                              <td className={`${td} text-xs text-[#94a3b8] whitespace-nowrap`}>
                                {c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        {(dados.chats || []).length === 0 && (
                          <tr><td colSpan={7} className="text-center py-12 text-[#94a3b8] text-sm">Nenhum chat registrado ainda.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {chatSelecionado && (
                <div className="space-y-4">
                  <div className="bg-white rounded-[14px] border border-[#e2e8f0] p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono font-bold text-[#030213] text-sm">{chatSelecionado.orcs?.codigo || '—'}</span>
                        <div className="text-xs text-[#64748b] mt-0.5">{chatSelecionado.orcs?.servicos?.titulo || chatSelecionado.orcs?.servico_nome || '—'}</div>
                      </div>
                      <div className="flex gap-2">
                        <a href={`${window.location.origin}/chat/${chatSelecionado.link_token}?papel=cliente`} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-600 underline">👤 Abrir cliente</a>
                        <a href={`${window.location.origin}/chat/${chatSelecionado.link_token}?papel=prestador`} target="_blank" rel="noreferrer"
                          className="text-xs text-[#3B6D11] underline">👷 Abrir prestador</a>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {[
                        ['👤 Cliente', chatSelecionado.orcs?.nome_cliente || '—'],
                        ['👷 Prestador', chatSelecionado.orcs?.prestadores?.nome || '—'],
                        ['💰 Valor', chatSelecionado.orcs?.valor_final ? Number(chatSelecionado.orcs.valor_final).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'],
                        ['📋 Comissão', chatSelecionado.orcs?.comissao_valor ? Number(chatSelecionado.orcs.comissao_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'],
                        ['Status chat', chatSelecionado.status],
                        ['Status ORC', chatSelecionado.orcs?.status || '—'],
                        ['Criado', chatSelecionado.criado_em ? new Date(chatSelecionado.criado_em).toLocaleString('pt-BR') : '—'],
                        ['Finalizado', chatSelecionado.finalizado_em ? new Date(chatSelecionado.finalizado_em).toLocaleString('pt-BR') : '—'],
                      ].map(([l, v]) => (
                        <div key={l}>
                          <div className="text-[#94a3b8] mb-0.5">{l}</div>
                          <div className="font-semibold text-[#030213]">{v}</div>
                        </div>
                      ))}
                    </div>
                    {chatSelecionado.orcs?.resumo_anamnese && (
                      <div className="mt-3 bg-[#EAF3DE] border border-[#c8e6a8] rounded-[10px] p-3">
                        <div className="text-xs font-bold text-[#3B6D11] mb-1">✨ Resumo da Anamnese (IA)</div>
                        <p className="text-xs text-[#030213] leading-relaxed">{chatSelecionado.orcs.resumo_anamnese}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[#030213]" />
                      <span className="font-bold text-sm text-[#030213]">Conversa completa</span>
                      <span className="text-xs text-[#94a3b8]">({chatMsgsDetalhe.length} mensagens)</span>
                    </div>
                    <div className="p-4 flex flex-col gap-3 max-h-[480px] overflow-y-auto">
                      {chatMsgDetalhando ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin w-6 h-6 border-2 border-[#030213] border-t-transparent rounded-full" />
                        </div>
                      ) : chatMsgsDetalhe.length === 0 ? (
                        <div className="text-center py-8 text-[#94a3b8] text-sm">Nenhuma mensagem ainda.</div>
                      ) : (
                        chatMsgsDetalhe.map((msg: any, i: number) => {
                          const isCliente = msg.remetente === 'cliente';
                          const isIA = msg.remetente === 'ia' || msg.remetente === 'sistema';
                          return (
                            <div key={i} className={`flex ${isCliente ? 'justify-end' : isIA ? 'justify-center' : 'justify-start'}`}>
                              {isIA ? (
                                <div className="bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] text-xs px-3 py-1.5 rounded-full max-w-[90%] text-center">
                                  🤖 {msg.conteudo}
                                </div>
                              ) : (
                                <div className="max-w-[78%]">
                                  <div className={`text-xs font-semibold mb-1 ${isCliente ? 'text-right text-blue-600' : 'text-left text-[#3B6D11]'}`}>
                                    {isCliente ? `👤 ${chatSelecionado.orcs?.nome_cliente || 'Cliente'}` : `👷 ${chatSelecionado.orcs?.prestadores?.nome || 'Prestador'}`}
                                  </div>
                                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isCliente ? 'bg-[#030213] text-white rounded-tr-sm' : 'bg-[#f8fafc] text-[#030213] rounded-tl-sm border border-[#e2e8f0]'}`}>
                                    {msg.tipo === 'imagem' ? <img src={msg.conteudo} alt="" className="rounded-xl max-w-full max-h-40 object-cover" /> : msg.conteudo}
                                  </div>
                                  <div className={`text-xs text-[#94a3b8] mt-1 ${isCliente ? 'text-right' : 'text-left'}`}>
                                    {new Date(msg.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DASHBOARD */}
          {!loading && aba === 'dashboard' && (
            <div className="space-y-6">

              {/* Bloco financeiro principal */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8] mb-3">💰 Financeiro</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      l: 'Faturamento Total', sub: 'Soma dos contratos',
                      v: 'R$ ' + (dados.faturamento_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                      ic: '💵', bg: '#E6F1FB', color: '#0C447C',
                    },
                    {
                      l: 'Faturamento este Mês', sub: 'Contratos gerados no mês',
                      v: 'R$ ' + (dados.faturamento_mes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                      ic: '📈', bg: 'oklch(0.95 0.03 184)', color: 'oklch(0.45 0.1 184)',
                    },
                    {
                      l: 'Comissão Total', sub: 'Plataforma acumulada',
                      v: 'R$ ' + (dados.comissao_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                      ic: '💰', bg: '#EAF3DE', color: '#173404',
                    },
                    {
                      l: 'Comissão este Mês', sub: 'Receita do mês atual',
                      v: 'R$ ' + (dados.comissao_mes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                      ic: '🏦', bg: '#EEEDFE', color: '#26215C',
                    },
                  ].map(s => (
                    <div key={s.l} className="bg-white border border-[#e2e8f0] rounded-[16px] p-5" style={{ boxShadow: '0 2px 12px -4px rgba(3,2,19,0.06)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xl">{s.ic}</span>
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{s.sub}</span>
                      </div>
                      <div className="text-[22px] font-extrabold text-[#030213] leading-tight">{s.v}</div>
                      <div className="text-xs text-[#64748b] font-semibold mt-1">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloco de crescimento / conversão */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8] mb-3">📊 Crescimento & Conversão</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      l: 'ORCs este mês', sub: 'vs. mês anterior',
                      v: dados.orcs_mes ?? 0,
                      delta: dados.crescimento_mes !== null
                        ? (dados.crescimento_mes >= 0 ? `+${dados.crescimento_mes}%` : `${dados.crescimento_mes}%`)
                        : '—',
                      deltaColor: dados.crescimento_mes >= 0 ? '#173404' : '#501313',
                      deltaBg: dados.crescimento_mes >= 0 ? '#EAF3DE' : '#FCEBEB',
                      ic: '⚡',
                    },
                    {
                      l: 'Taxa de Conversão', sub: 'ORCs → Contratos assinados',
                      v: (dados.taxa_conversao || 0) + '%',
                      delta: `${dados.contratos_assinados || 0} contratos`,
                      deltaColor: '#26215C', deltaBg: '#EEEDFE', ic: '🎯',
                    },
                    {
                      l: 'Chats em andamento', sub: 'Negociações ativas agora',
                      v: dados.chats_ativos || 0,
                      delta: `${dados.total_contratos || 0} total contratos`,
                      deltaColor: '#0C447C', deltaBg: '#E6F1FB', ic: '💬',
                    },
                    {
                      l: 'Novos clientes/mês', sub: 'Contratantes cadastrados',
                      v: dados.usuarios_mes || 0,
                      delta: `${dados.total_usuarios || 0} total`,
                      deltaColor: '#92400e', deltaBg: '#FEF3C7', ic: '👤',
                    },
                  ].map(s => (
                    <div key={s.l} className="bg-white border border-[#e2e8f0] rounded-[16px] p-5" style={{ boxShadow: '0 2px 12px -4px rgba(3,2,19,0.06)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xl">{s.ic}</span>
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.deltaBg, color: s.deltaColor }}>{s.delta}</span>
                      </div>
                      <div className="text-[26px] font-extrabold text-[#030213] leading-tight">{s.v}</div>
                      <div className="text-xs text-[#64748b] font-semibold mt-1">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloco de rede */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8] mb-3">🏗️ Rede de Prestadores</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { l: 'Total de Prestadores', v: dados.total_prestadores || 0, ic: '👷', sub: `${dados.prestadores_ativos || 0} ativos`, bg: '#E6F1FB', color: '#0C447C' },
                    { l: 'Identidades Verificadas', v: dados.prestadores_verificados || 0, ic: '🤳', sub: 'Biometria aprovada', bg: 'oklch(0.95 0.03 184)', color: 'oklch(0.45 0.1 184)' },
                    { l: 'Total de ORCs', v: dados.total_orcs || 0, ic: '📋', sub: `${dados.orcs_ativos || 0} em andamento`, bg: '#fffbeb', color: '#b45309' },
                    { l: 'Contratantes Ativos', v: dados.total_usuarios || 0, ic: '🏠', sub: 'Usuários cadastrados', bg: '#EEEDFE', color: '#26215C' },
                  ].map(s => (
                    <div key={s.l} className="bg-white border border-[#e2e8f0] rounded-[16px] p-5" style={{ boxShadow: '0 2px 12px -4px rgba(3,2,19,0.06)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xl">{s.ic}</span>
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{s.sub}</span>
                      </div>
                      <div className="text-[26px] font-extrabold text-[#030213] leading-tight">{s.v}</div>
                      <div className="text-xs text-[#64748b] font-semibold mt-1">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* PRESTADORES */}
          {!loading && aba === 'prestadores' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-[#64748b]">{(dados.prestadores || []).length} prestadores cadastrados</span>
                <button onClick={() => setModalPrestador(true)}
                  className="flex items-center gap-2 bg-[#030213] text-white px-4 py-2 rounded-[12px] text-sm font-bold hover:bg-[#030213]/90 transition-colors">
                  <Plus className="h-4 w-4" /> Novo Prestador
                </button>
              </div>
              <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Nome', 'Telefone', 'Cidade', 'Status', 'Perfil Verificado', 'Ação'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.prestadores || []).map((p: any) => (
                        <tr key={p.id} className="hover:bg-[#f8fafc]">
                          <td className={td}>
                            <div className="font-semibold text-[#030213]">{p.nome}</div>
                            {p.email && <div className="text-xs text-[#94a3b8]">{p.email}</div>}
                          </td>
                          <td className={td}>{p.telefone}</td>
                          <td className={td}>{p.cidade}</td>
                          <td className={td}>
                            <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                              style={p.ativo ? { background: '#EAF3DE', color: '#173404' } : { background: '#FCEBEB', color: '#501313' }}>
                              {p.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className={td}>
                            {p.verificado ? (
                              <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5" style={{ background: '#EAF3DE', color: '#173404' }}>✓ Verificado</span>
                            ) : p.verificacao_solicitada ? (
                              <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5" style={{ background: '#FEF3C7', color: '#92400e' }}>⏳ Docs enviados</span>
                            ) : (
                              <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5" style={{ background: '#f1f5f9', color: '#64748b' }}>—</span>
                            )}
                          </td>
                          <td className={td}>
                            <div className="flex gap-2">
                              {(p.selfie_url || p.doc_identidade_url) && (
                                <button onClick={() => abrirDetalhe(p)}
                                  className="text-xs px-3 py-1 rounded-[8px] font-semibold"
                                  style={{ background: '#E6F1FB', color: '#0C447C' }}>
                                  Ver docs
                                </button>
                              )}
                              <button onClick={() => toggleVerificado(p.id, p.verificado)}
                                className="text-xs px-3 py-1 rounded-[8px] font-semibold transition-colors"
                                style={p.verificado ? { background: '#FCEBEB', color: '#501313' } : { background: '#EAF3DE', color: '#173404' }}>
                                {p.verificado ? 'Remover' : 'Aprovar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* USUARIOS */}
          {!loading && aba === 'usuarios' && (
            <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className={tbl}>
                  <thead><tr>{['Nome', 'Email', 'Telefone', 'Cidade', 'Cadastro'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(dados.usuarios || []).map((u: any) => (
                      <tr key={u.id} className="hover:bg-[#f8fafc]">
                        <td className={td}><span className="font-semibold text-[#030213]">{u.nome}</span></td>
                        <td className={`${td} text-xs`}>{u.email}</td>
                        <td className={td}>{u.telefone}</td>
                        <td className={td}>{u.cidade}</td>
                        <td className={`${td} text-xs text-[#94a3b8]`}>{u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
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
                <span className="text-sm text-[#64748b]">{(dados.servicos || []).length} serviços cadastrados</span>
                <button onClick={() => {
                  setModalServico(true);
                  supabase.from('prestadores').select('id,nome').eq('ativo', true).order('nome').then(({ data }) => setPrestadoresList(data || []));
                  supabase.from('categorias').select('id,nome,icone').eq('ativa', true).order('nome').then(({ data }) => setCategoriasList(data || []));
                }}
                  className="flex items-center gap-2 bg-[#030213] text-white px-4 py-2 rounded-[12px] text-sm font-bold hover:bg-[#030213]/90 transition-colors">
                  <Plus className="h-4 w-4" /> Novo Serviço
                </button>
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Filtrar por cidade..."
                  value={filtroServicoCidade}
                  onChange={e => setFiltroServicoCidade(e.target.value)}
                  className="w-full max-w-xs border border-[#e2e8f0] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#030213]"
                />
              </div>
              <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Título', 'Categoria', 'Prestador', 'Cidade', 'Status', 'Ações'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.servicos || [])
                        .filter((s: any) => !filtroServicoCidade || (s.prestadores?.cidade || '').toLowerCase().includes(filtroServicoCidade.toLowerCase()))
                        .map((s: any) => (
                        <tr key={s.id} className="hover:bg-[#f8fafc] cursor-pointer" onClick={() => setServicoDetalhe(s)}>
                          <td className={td}><span className="font-semibold text-[#030213]">{s.titulo}</span></td>
                          <td className={td}>{s.categorias?.icone} {s.categorias?.nome || '—'}</td>
                          <td className={td}>{s.prestadores?.nome || '—'}</td>
                          <td className={td}>{s.prestadores?.cidade || '—'}</td>
                          <td className={td}>
                            <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                              style={s.ativo ? { background: '#EAF3DE', color: '#173404' } : { background: '#FCEBEB', color: '#501313' }}>
                              {s.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className={td} onClick={e => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  await supabase.from('servicos').update({ ativo: !s.ativo }).eq('id', s.id);
                                  carregarDados('servicos');
                                }}
                                className="text-[11px] font-bold px-2.5 py-1 rounded-[8px] border border-[#e2e8f0] hover:bg-[#f1f5f9] transition-colors"
                                title={s.ativo ? 'Desativar' : 'Ativar'}>
                                {s.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remover o serviço "${s.titulo}"? Esta ação não pode ser desfeita.`)) return;
                                  await supabase.from('servicos').delete().eq('id', s.id);
                                  carregarDados('servicos');
                                }}
                                className="text-[11px] font-bold px-2.5 py-1 rounded-[8px] border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                                Remover
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Service detail modal */}
              {servicoDetalhe && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setServicoDetalhe(null)}>
                  <div className="bg-white rounded-[18px] shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-[#030213] text-lg">{servicoDetalhe.titulo}</h3>
                        <p className="text-sm text-[#64748b]">{servicoDetalhe.categorias?.icone} {servicoDetalhe.categorias?.nome}</p>
                      </div>
                      <button onClick={() => setServicoDetalhe(null)} className="text-[#64748b] hover:text-[#030213] text-xl font-bold">✕</button>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div><span className="font-semibold text-[#030213]">Prestador:</span> <span className="text-[#374151]">{servicoDetalhe.prestadores?.nome || '—'}</span></div>
                      <div><span className="font-semibold text-[#030213]">Cidade:</span> <span className="text-[#374151]">{servicoDetalhe.prestadores?.cidade || '—'}</span></div>
                      {servicoDetalhe.descricao && (
                        <div><span className="font-semibold text-[#030213]">Descrição:</span> <p className="text-[#374151] mt-1 leading-relaxed">{servicoDetalhe.descricao}</p></div>
                      )}
                      {servicoDetalhe.preco_base && (
                        <div><span className="font-semibold text-[#030213]">Preço base:</span> <span className="text-[#374151]">R$ {Number(servicoDetalhe.preco_base).toFixed(2)}</span></div>
                      )}
                      {servicoDetalhe.area_atendimento && (
                        <div><span className="font-semibold text-[#030213]">Área de atendimento:</span> <span className="text-[#374151]">{servicoDetalhe.area_atendimento}</span></div>
                      )}
                      <div className="flex gap-3 pt-2">
                        <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                          style={servicoDetalhe.ativo ? { background: '#EAF3DE', color: '#173404' } : { background: '#FCEBEB', color: '#501313' }}>
                          {servicoDetalhe.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                          style={servicoDetalhe.aceita_orcamento_online ? { background: '#E6F1FB', color: '#0C447C' } : { background: '#f1f5f9', color: '#64748b' }}>
                          {servicoDetalhe.aceita_orcamento_online ? 'Online: Sim' : 'Online: Não'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CATEGORIAS */}
          {!loading && aba === 'categorias' && (
            <div>
              <div className="bg-white rounded-[14px] border border-[#e2e8f0] p-5 mb-4">
                <h3 className="font-bold text-[#030213] text-sm mb-3">Nova Categoria</h3>
                <div className="flex gap-3 flex-wrap">
                  <input id="cat-icone" placeholder="Ícone (ex: 🔧)" maxLength={4}
                    className="w-24 border border-[#e2e8f0] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#030213] text-center text-xl" />
                  <input id="cat-nome" placeholder="Nome da categoria"
                    className="flex-1 min-w-[160px] border border-[#e2e8f0] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#030213]" />
                  <input id="cat-descricao" placeholder="Descrição (opcional)"
                    className="flex-1 min-w-[200px] border border-[#e2e8f0] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#030213]" />
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
                    className="px-4 py-2 bg-[#030213] text-white rounded-[12px] text-sm font-bold hover:bg-[#030213]/90 transition-colors flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Adicionar
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Ícone', 'Nome', 'Descrição', 'Status', 'Ação'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.categorias || []).map((c: any) => (
                        <tr key={c.id} className="hover:bg-[#f8fafc]">
                          <td className={`${td} text-xl`}>{c.icone || '📋'}</td>
                          <td className={td}><span className="font-semibold text-[#030213]">{c.nome}</span></td>
                          <td className={`${td} text-xs text-[#94a3b8]`}>{c.descricao || '—'}</td>
                          <td className={td}>
                            <button
                              onClick={async () => {
                                await supabase.from('categorias').update({ ativa: !c.ativa }).eq('id', c.id);
                                carregarDados('categorias');
                              }}
                              className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 cursor-pointer transition-colors"
                              style={c.ativa ? { background: '#EAF3DE', color: '#173404' } : { background: '#FCEBEB', color: '#501313' }}>
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
                              className="text-xs px-2 py-1 text-[#f87171] hover:text-red-600 hover:bg-[#FCEBEB] rounded-[8px] transition-colors">
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
            <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#e2e8f0] text-xs text-[#64748b] bg-[#f8fafc]">
                Contratos não assinados por nenhuma parte podem ser editados pelo Admin.
              </div>
              <div className="overflow-x-auto">
                <table className={tbl}>
                  <thead><tr>{['ORC', 'Tipo', 'Valor', 'Comissão', 'Prazo', 'Cliente ✍', 'Prestador ✍', 'Status', ''].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(dados.contratos || []).map((c: any) => {
                      const nenhumAssinou = !c.assinado_cliente && !c.assinado_prestador;
                      return (
                        <tr key={c.id} className="hover:bg-[#f8fafc]">
                          <td className={td}><span className="font-mono font-bold text-[#030213] text-xs">{c.orcs?.codigo}</span></td>
                          <td className={td}>{c.tipo === 'carta_aceite' ? '📜 Carta Aceite' : '🛡️ Contrato Seguro'}</td>
                          <td className={td}><span className="font-bold text-[#3B6D11]">R$ {Number(c.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></td>
                          <td className={td}><span className="text-xs text-[#94a3b8]">R$ {Number(c.comissao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></td>
                          <td className={td}><span className="text-xs">{c.prazo || '—'}</span></td>
                          <td className={td}>{c.assinado_cliente ? '✅' : '⏳'}</td>
                          <td className={td}>{c.assinado_prestador ? '✅' : '⏳'}</td>
                          <td className={td}>
                            <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                              style={c.assinado_cliente && c.assinado_prestador
                                ? { background: '#EAF3DE', color: '#173404' }
                                : { background: '#FEF3C7', color: '#92400e' }}>
                              {c.assinado_cliente && c.assinado_prestador ? 'Assinado' : 'Pendente'}
                            </span>
                          </td>
                          <td className={td}>
                            {nenhumAssinou && (
                              <button onClick={() => abrirEditContrato(c)}
                                className="text-xs px-2 py-1 bg-[#f8fafc] text-[#030213] border border-[#e2e8f0] rounded-[8px] hover:bg-[#e2e8f0] font-semibold transition-colors">
                                ✏️ Editar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AVALIAÇÕES */}
          {!loading && aba === 'avaliacoes' && (
            <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className={tbl}>
                  <thead><tr>{['Avaliado', 'Tipo', 'Nota', 'Comentário', 'Data'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(dados.avaliacoes || []).map((a: any) => (
                      <tr key={a.id} className="hover:bg-[#f8fafc]">
                        <td className={td}>{a.avaliado_id?.substring(0, 8)}...</td>
                        <td className={td}>{a.avaliado_tipo}</td>
                        <td className={td}>{'⭐'.repeat(a.nota)}</td>
                        <td className={`${td} text-xs text-[#94a3b8] max-w-xs truncate`}>{a.comentario || '—'}</td>
                        <td className={`${td} text-xs text-[#94a3b8]`}>{a.criado_em ? new Date(a.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
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
              <p className="text-xs text-[#64748b] mb-3">Edite o valor da taxa diretamente na tabela e clique em Salvar.</p>
              <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Ordem', 'Valor Mín', 'Valor Máx', 'Tipo', 'Taxa', 'Ação'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.comissoes || []).map((c: any) => (
                        <tr key={c.id} className="hover:bg-[#f8fafc]">
                          <td className={td}><span className="font-semibold text-[#030213]">#{c.ordem}</span></td>
                          <td className={td}>R$ {Number(c.valor_min || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className={td}>{c.valor_max ? 'R$ ' + Number(c.valor_max).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'Sem limite'}</td>
                          <td className={td}>{c.tipo === 'fixo' ? 'Fixo (R$)' : 'Percentual (%)'}</td>
                          <td className={td}>
                            <input
                              type="number"
                              defaultValue={c.valor}
                              id={`comissao-${c.id}`}
                              className="w-24 border border-[#e2e8f0] rounded-[10px] px-2 py-1 text-sm outline-none focus:border-[#030213] font-bold text-[#3B6D11]"
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
                              className="text-xs px-3 py-1.5 bg-[#030213] text-white rounded-[8px] hover:bg-[#030213]/90 font-semibold transition-colors">
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
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5">
                  <div className="text-[26px] font-extrabold text-[#030213]">{(dados.biometria || []).filter((p: any) => p.verificado).length}</div>
                  <div className="text-sm text-[#64748b] font-semibold mb-1">Verificados</div>
                </div>
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5">
                  <div className="text-[26px] font-extrabold text-[#030213]">{(dados.biometria || []).filter((p: any) => !p.verificado).length}</div>
                  <div className="text-sm text-[#64748b] font-semibold mb-1">Pendentes</div>
                </div>
              </div>
              <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['Nome', 'Telefone', 'Cidade', 'Status', 'Ação'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.biometria || []).map((p: any) => (
                        <tr key={p.id} className="hover:bg-[#f8fafc]">
                          <td className={td}><span className="font-semibold text-[#030213]">{p.nome}</span></td>
                          <td className={td}>{p.telefone}</td>
                          <td className={td}>{p.cidade}</td>
                          <td className={td}>
                            <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                              style={p.verificado ? { background: '#EAF3DE', color: '#173404' } : { background: '#FEF3C7', color: '#92400e' }}>
                              {p.verificado ? '🤳 Verificado' : '⏳ Pendente'}
                            </span>
                          </td>
                          <td className={td}>
                            <button onClick={() => toggleVerificado(p.id, p.verificado)}
                              className="text-xs px-3 py-1.5 rounded-[8px] font-semibold transition-colors"
                              style={p.verificado ? { background: '#FCEBEB', color: '#501313' } : { background: '#EAF3DE', color: '#173404' }}>
                              {p.verificado ? '✕ Remover' : '✓ Aprovar'}
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

          {/* COMISSÕES CONTRATOS */}
          {aba === 'comissoes-contratos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg font-extrabold text-[#030213]">Comissões de Contratos</h2>
                  <p className="text-xs text-[#94a3b8]">Contratos assinados — rastreamento de pagamento de comissão</p>
                </div>
                <div className="text-sm text-[#64748b] font-semibold">
                  {(dados.comissoesContratos || []).filter((c: any) => c.status_comissao === 'pendente').length} pendentes
                </div>
              </div>
              <div className="bg-white rounded-[14px] border border-[#e2e8f0] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={tbl}>
                    <thead><tr>{['ORC', 'Prestador', 'Cliente', 'Comissão', 'Assinado em', 'Status', 'Ação'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {(dados.comissoesContratos || []).map((c: any) => (
                        <tr key={c.id} className="hover:bg-[#f8fafc]">
                          <td className={td}><span className="font-mono text-xs">{c.orcs?.codigo || '—'}</span></td>
                          <td className={td}>{c.orcs?.prestadores?.nome || '—'}</td>
                          <td className={td}>{c.orcs?.nome_cliente || '—'}</td>
                          <td className={td}>{c.comissao ? `R$ ${Number(c.comissao).toFixed(2)}` : '—'}</td>
                          <td className={td}>{c.assinado_em ? new Date(c.assinado_em).toLocaleDateString('pt-BR') : '—'}</td>
                          <td className={td}>
                            <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                              style={c.status_comissao === 'pago'
                                ? { background: '#EAF3DE', color: '#173404' }
                                : c.status_comissao === 'isento'
                                ? { background: '#f1f5f9', color: '#64748b' }
                                : { background: '#FEF3C7', color: '#92400E' }}>
                              {c.status_comissao === 'pago' ? '✓ Pago' : c.status_comissao === 'isento' ? 'Isento' : '⏳ Pendente'}
                            </span>
                          </td>
                          <td className={td}>
                            {c.status_comissao === 'pendente' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    await apiCall(`/api/admin/comissoes-contratos/${c.id}`, 'PATCH', { status_comissao: 'pago' });
                                    carregarDados('comissoes-contratos');
                                  }}
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-[8px] bg-[#EAF3DE] text-[#173404] hover:bg-[#d4edba] transition-colors">
                                  Marcar Pago
                                </button>
                                <button
                                  onClick={async () => {
                                    await apiCall(`/api/admin/comissoes-contratos/${c.id}`, 'PATCH', { status_comissao: 'isento' });
                                    carregarDados('comissoes-contratos');
                                  }}
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-[8px] border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] transition-colors">
                                  Isento
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!(dados.comissoesContratos || []).length && (
                        <tr><td colSpan={7} className="text-center py-8 text-[#94a3b8] text-sm">Nenhum contrato assinado ainda</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Template da mensagem de comissão */}
              <div className="bg-white rounded-[14px] border border-[#e2e8f0] p-5">
                <h3 className="font-bold text-[#030213] text-sm mb-1">Mensagem de cobrança de comissão</h3>
                <p className="text-xs text-[#94a3b8] mb-3">Use {'{NOME}'}, {'{VALOR}'}, {'{ORC}'} como variáveis. Enviada ao prestador no momento da assinatura e nos dias 2, 3 e 7 seguintes.</p>
                <ComissaoTemplateEditor onSave={() => carregarDados('comissoes-contratos')} />
              </div>
            </div>
          )}

          {/* CONFIG */}
          {/* SUPORTE */}
          {aba === 'suporte' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg font-extrabold text-[#030213]">Suporte</h2>
                  <p className="text-xs text-[#94a3b8]">Mensagens recebidas pela página de Contato</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#E6F1FB', color: '#0C447C' }}>
                  {(dados.suporte || []).filter((m: any) => m.status === 'novo').length} novas
                </span>
              </div>
              {!(dados.suporte || []).length ? (
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-16 text-center text-[#94a3b8] text-sm">
                  Nenhuma mensagem ainda.
                </div>
              ) : (dados.suporte || []).map((m: any) => (
                <div key={m.id} className="bg-white border rounded-[16px] p-5 space-y-3"
                  style={{ borderColor: m.status === 'novo' ? '#7F77DD' : '#e2e8f0' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#030213]">{m.nome || 'Anônimo'}</span>
                        <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full"
                          style={m.status === 'novo'
                            ? { background: '#EEEDFE', color: '#3C3489' }
                            : m.status === 'lido'
                              ? { background: '#FEF3C7', color: '#92400e' }
                              : { background: '#EAF3DE', color: '#173404' }}>
                          {m.status === 'novo' ? '● Novo' : m.status === 'lido' ? 'Lido' : '✓ Resolvido'}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        {m.email && <span className="text-xs text-[#64748b]">{m.email}</span>}
                        {m.telefone && <span className="text-xs text-[#64748b]">{m.telefone}</span>}
                        <span className="text-xs text-[#94a3b8]">{m.criado_em ? new Date(m.criado_em).toLocaleString('pt-BR') : ''}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {m.status !== 'lido' && m.status !== 'resolvido' && (
                        <button onClick={async () => {
                          await apiCall(`/api/admin/suporte/${m.id}`, { method: 'PATCH', body: { status: 'lido' } });
                          carregarDados('suporte');
                        }} className="text-xs px-3 py-1 rounded-[8px] font-semibold" style={{ background: '#FEF3C7', color: '#92400e' }}>
                          Marcar lido
                        </button>
                      )}
                      {m.status !== 'resolvido' && (
                        <button onClick={async () => {
                          await apiCall(`/api/admin/suporte/${m.id}`, { method: 'PATCH', body: { status: 'resolvido' } });
                          carregarDados('suporte');
                        }} className="text-xs px-3 py-1 rounded-[8px] font-semibold" style={{ background: '#EAF3DE', color: '#173404' }}>
                          ✓ Resolvido
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-bold text-[#64748b] uppercase tracking-wide">{m.assunto}</div>
                  <p className="text-sm text-[#030213] leading-relaxed whitespace-pre-wrap">{m.mensagem}</p>
                </div>
              ))}
            </div>
          )}

          {aba === 'config' && <AdminPrompts />}

        </div>
      </div>

      {/* MODALS */}

      {/* MODAL EDITAR CONTRATO */}
      {modalEditContrato && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalEditContrato(false); }}>
          <div className="bg-white rounded-[20px] shadow-[0_24px_60px_-24px_rgba(3,2,19,0.45)] w-full max-w-md overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h3 className="font-extrabold text-[#030213]">✏️ Editar Contrato</h3>
              <button onClick={() => setModalEditContrato(false)}
                className="p-2 hover:bg-[#f8fafc] rounded-[10px] transition-colors text-[#64748b]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {erroContrato && (
                <div className="bg-[#FCEBEB] border border-[#f5c6c6] text-[#501313] text-sm px-4 py-3 rounded-[12px]">
                  {erroContrato}
                </div>
              )}
              <div>
                <label className={labelCls}>Tipo</label>
                <select value={formContrato.tipo} onChange={e => setFormContrato(f => ({ ...f, tipo: e.target.value }))}
                  className={inputCls + ' bg-white'}>
                  <option value="carta_aceite">📜 Carta Aceite</option>
                  <option value="servico_seguro">🛡️ Contrato Seguro</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Valor (R$)</label>
                  <input type="number" value={formContrato.valor} onChange={e => setFormContrato(f => ({ ...f, valor: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Comissão (R$)</label>
                  <input type="number" value={formContrato.comissao} onChange={e => setFormContrato(f => ({ ...f, comissao: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Prazo de execução</label>
                <input type="text" value={formContrato.prazo} onChange={e => setFormContrato(f => ({ ...f, prazo: e.target.value }))}
                  placeholder="Ex: 5 dias úteis" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Forma de pagamento</label>
                <input type="text" value={formContrato.pagamento} onChange={e => setFormContrato(f => ({ ...f, pagamento: e.target.value }))}
                  placeholder="Ex: À vista" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Garantia</label>
                <input type="text" value={formContrato.garantia} onChange={e => setFormContrato(f => ({ ...f, garantia: e.target.value }))}
                  placeholder="Ex: 90 dias" className={inputCls} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalEditContrato(false)}
                  className="flex-1 border border-[#e2e8f0] rounded-[12px] py-3 font-semibold text-sm hover:bg-[#f8fafc] transition-colors">
                  Cancelar
                </button>
                <button onClick={salvarContrato} disabled={salvando}
                  className="flex-1 py-3 bg-[#030213] text-white rounded-[12px] font-bold text-sm hover:bg-[#030213]/90 disabled:opacity-50 transition-colors">
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO PRESTADOR */}
      {modalPrestador && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalPrestador(false); }}>
          <div className="bg-white rounded-[20px] shadow-[0_24px_60px_-24px_rgba(3,2,19,0.45)] w-full max-w-md overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h3 className="font-extrabold text-[#030213]">Novo Prestador</h3>
              <button onClick={() => setModalPrestador(false)}
                className="p-2 hover:bg-[#f8fafc] rounded-[10px] transition-colors text-[#64748b]">
                <X className="h-5 w-5" />
              </button>
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
                  <label className={labelCls}>{f.label}</label>
                  <input type={f.type} value={(formPrestador as any)[f.key] || ''}
                    onChange={e => setFormPrestador((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className={inputCls} />
                </div>
              ))}
              <div>
                <label className={labelCls}>Bio / Apresentação</label>
                <textarea value={formPrestador.bio || ''}
                  onChange={e => setFormPrestador((p: any) => ({ ...p, bio: e.target.value }))}
                  placeholder="Breve apresentação do prestador..."
                  rows={3} className={inputCls + ' resize-none'} />
              </div>
              <button onClick={salvarPrestador} disabled={salvando}
                className="w-full py-3 bg-[#030213] text-white rounded-[12px] font-bold text-sm hover:bg-[#030213]/90 disabled:opacity-50 transition-colors">
                {salvando ? 'Salvando...' : '✓ Cadastrar prestador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO SERVIÇO */}
      {modalServico && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalServico(false); }}>
          <div className="bg-white rounded-[20px] shadow-[0_24px_60px_-24px_rgba(3,2,19,0.45)] w-full max-w-md overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h3 className="font-extrabold text-[#030213]">Novo Serviço</h3>
              <button onClick={() => setModalServico(false)}
                className="p-2 hover:bg-[#f8fafc] rounded-[10px] transition-colors text-[#64748b]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Título do serviço *</label>
                <input value={formServico.titulo} onChange={e => setFormServico((f: any) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Instalação elétrica residencial" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Prestador *</label>
                <select value={formServico.prestador_id} onChange={e => setFormServico((f: any) => ({ ...f, prestador_id: e.target.value }))}
                  className={inputCls + ' bg-white'}>
                  <option value="">Selecione o prestador</option>
                  {prestadoresList.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Categoria</label>
                <select value={formServico.categoria_id} onChange={e => setFormServico((f: any) => ({ ...f, categoria_id: e.target.value }))}
                  className={inputCls + ' bg-white'}>
                  <option value="">Selecione a categoria</option>
                  {categoriasList.map((c: any) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Descrição</label>
                <textarea value={formServico.descricao} onChange={e => setFormServico((f: any) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descrição do serviço (opcional)"
                  rows={3} className={inputCls + ' resize-none'} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Tipo de preço</label>
                  <select value={formServico.tipo} onChange={e => setFormServico((f: any) => ({ ...f, tipo: e.target.value }))}
                    className={inputCls + ' bg-white'}>
                    <option value="orcamento">Sob orçamento</option>
                    <option value="fixo">Preço fixo</option>
                  </select>
                </div>
                {formServico.tipo === 'fixo' && (
                  <div className="flex-1">
                    <label className={labelCls}>Valor (R$)</label>
                    <input type="number" value={formServico.valor_fixo || ''} onChange={e => setFormServico((f: any) => ({ ...f, valor_fixo: e.target.value }))}
                      placeholder="0,00" className={inputCls} />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={formServico.aceita_online || false}
                  onChange={e => setFormServico((f: any) => ({ ...f, aceita_online: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-[#030213]">Aceita orçamento online (sem visita)</span>
              </label>
              <button onClick={salvarServico} disabled={salvando}
                className="w-full py-3 bg-[#030213] text-white rounded-[12px] font-bold text-sm hover:bg-[#030213]/90 disabled:opacity-50 transition-colors">
                {salvando ? 'Salvando...' : '✓ Criar serviço'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mobileMenu && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileMenu(false)} />
      )}

      {/* MODAL DETALHE PRESTADOR — Verificação de documentos */}
      {prestadorDetalhe && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setPrestadorDetalhe(null); setDocsAssinados(null); } }}>
          <div className="bg-white rounded-[20px] shadow-[0_24px_60px_-24px_rgba(3,2,19,0.45)] w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-[#030213]">{prestadorDetalhe.nome}</h3>
                <p className="text-xs text-[#64748b] mt-0.5">Verificação de documentos</p>
              </div>
              <button onClick={() => { setPrestadorDetalhe(null); setDocsAssinados(null); }}
                className="p-2 hover:bg-[#f8fafc] rounded-[10px] transition-colors text-[#64748b]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex gap-3 flex-wrap">
                {prestadorDetalhe.verificado ? (
                  <span className="rounded-full text-xs font-bold px-3 py-1" style={{ background: '#EAF3DE', color: '#173404' }}>✓ Perfil Verificado</span>
                ) : prestadorDetalhe.verificacao_solicitada ? (
                  <span className="rounded-full text-xs font-bold px-3 py-1" style={{ background: '#FEF3C7', color: '#92400e' }}>⏳ Verificação solicitada</span>
                ) : (
                  <span className="rounded-full text-xs font-bold px-3 py-1" style={{ background: '#f1f5f9', color: '#64748b' }}>Sem solicitação</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#64748b] mb-2">Selfie</p>
                  {docsAssinados === null ? (
                    <div className="w-full aspect-square rounded-[12px] border border-[#e2e8f0] flex items-center justify-center text-[#94a3b8] text-xs">Carregando...</div>
                  ) : docsAssinados.selfie_url ? (
                    <a href={docsAssinados.selfie_url} target="_blank" rel="noopener noreferrer">
                      <img src={docsAssinados.selfie_url} alt="Selfie"
                        className="w-full aspect-square object-cover rounded-[12px] border border-[#e2e8f0] hover:opacity-90 transition-opacity" />
                    </a>
                  ) : (
                    <div className="w-full aspect-square rounded-[12px] border-2 border-dashed border-[#e2e8f0] flex items-center justify-center text-[#94a3b8] text-sm">Não enviado</div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#64748b] mb-2">Documento (RG/CNH)</p>
                  {docsAssinados === null ? (
                    <div className="w-full aspect-square rounded-[12px] border border-[#e2e8f0] flex items-center justify-center text-[#94a3b8] text-xs">Carregando...</div>
                  ) : docsAssinados.doc_url ? (
                    <a href={docsAssinados.doc_url} target="_blank" rel="noopener noreferrer">
                      <img src={docsAssinados.doc_url} alt="Documento"
                        className="w-full aspect-square object-cover rounded-[12px] border border-[#e2e8f0] hover:opacity-90 transition-opacity" />
                    </a>
                  ) : (
                    <div className="w-full aspect-square rounded-[12px] border-2 border-dashed border-[#e2e8f0] flex items-center justify-center text-[#94a3b8] text-sm">Não enviado</div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                {prestadorDetalhe.verificado ? (
                  <button
                    onClick={async () => {
                      await toggleVerificado(prestadorDetalhe.id, true);
                      setPrestadorDetalhe(null);
                    }}
                    className="flex-1 py-2.5 rounded-[12px] font-semibold text-sm"
                    style={{ background: '#FCEBEB', color: '#501313' }}>
                    Remover verificação
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await toggleVerificado(prestadorDetalhe.id, false);
                      setPrestadorDetalhe(null);
                    }}
                    className="flex-1 py-2.5 rounded-[12px] font-semibold text-sm"
                    style={{ background: '#EAF3DE', color: '#173404' }}>
                    ✓ Aprovar — Perfil Verificado
                  </button>
                )}
                <button onClick={() => { setPrestadorDetalhe(null); setDocsAssinados(null); }}
                  className="px-5 py-2.5 rounded-[12px] font-semibold text-sm"
                  style={{ background: '#f1f5f9', color: '#64748b' }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
