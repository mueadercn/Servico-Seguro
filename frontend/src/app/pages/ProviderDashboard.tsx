import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import {
  LayoutDashboard, ClipboardList, FileText, Star, User, LogOut,
  Plus, TrendingUp, CheckCircle2, Settings,
  Shield, X, ChevronDown, MessageSquare, DollarSign, Menu, ArrowLeft
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase, getPrestador, logout, apiCall } from '../../lib/supabase';

const TEAL = 'oklch(0.6 0.118 184.704)';
const TEAL_LIGHT_BG = 'oklch(0.95 0.03 184)';
const TEAL_DARK_TEXT = 'oklch(0.45 0.1 184)';
const PRIMARY = '#030213';

const navItems = [
  { id: 'perfil', label: 'Perfil', icon: User, badge: '📷' },
  { id: 'servicos', label: 'Serviços', icon: Settings, badge: null },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Meus ORCs', icon: ClipboardList },
  { id: 'conversas', label: 'Conversas', icon: MessageSquare },
  { id: 'chats', label: 'Contratos', icon: FileText },
  { id: 'avaliacoes', label: 'Avaliações', icon: Star },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'NOVO':                   { bg: '#E6F1FB', color: '#0C447C' },
    'EM ANAMNESE':            { bg: '#E6F1FB', color: '#0C447C' },
    'ANAMNESE CONCLUÍDA':     { bg: '#ececf0', color: '#030213' },
    'PRESTADOR NOTIFICADO':   { bg: '#ececf0', color: '#030213' },
    'FECHADO':                { bg: '#EEEDFE', color: '#26215C' },
    'CONTRATO GERADO':        { bg: '#EEEDFE', color: '#26215C' },
    'CONTRATO ASSINADO':      { bg: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT },
    'SERVIÇO CONCLUÍDO':      { bg: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT },
    'ENCERRADO':              { bg: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT },
    'CANCELADO':              { bg: '#f1f5f9', color: '#64748b' },
    'DIVERGÊNCIA':            { bg: '#FCEBEB', color: '#501313' },
    'SEM RESPOSTA':           { bg: '#FCEBEB', color: '#501313' },
  };
  const style = map[status] || { bg: '#f1f5f9', color: '#64748b' };
  return (
    <span
      className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}

export function ProviderDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const prestador = getPrestador();
  const [aba, setAba] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('aba') || 'dashboard';
  });
  const [abaConversas, setAbaConversas] = useState<'ativos' | 'encerrados'>('ativos');
  const [leads, setLeads] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [perfil, setPerfil] = useState<any>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [avaliacoesFeitas, setAvaliacoesFeitas] = useState<any[]>([]);
  const [abaAvaliacoes, setAbaAvaliacoes] = useState<'recebidas' | 'feitas'>('recebidas');
  const [modalAvalCliente, setModalAvalCliente] = useState<{ orc_id: string; nome_cliente: string } | null>(null);
  const [formAvalCliente, setFormAvalCliente] = useState({ nota: 5, comentario: '' });
  const [enviandoAvalCliente, setEnviandoAvalCliente] = useState(false);

  const [modalServico, setModalServico] = useState(false);
  const [formServico, setFormServico] = useState({
    titulo: '', descricao: '', categoria_id: '',
    tipo: 'orcamento', valor_fixo: '', aceita_orcamento_online: false
  });
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [concluindoOrc, setConcluindoOrc] = useState<string | null>(null);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [formPerfil, setFormPerfil] = useState({ nome: '', telefone: '', cpf: '', bio: '', cidade: '', estado: '' });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState<'selfie' | 'documento' | null>(null);
  const [solicitandoVerif, setSolicitandoVerif] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [galeria, setGaleria] = useState<string[]>([]);
  const [uploadingGaleria, setUploadingGaleria] = useState(false);

  function mostrarMsg(tipo: 'ok' | 'erro', texto: string) {
    setUploadMsg({ tipo, texto });
    setTimeout(() => setUploadMsg(null), 4000);
  }

  async function uploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !prestador) return;
    setUploadingFoto(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const storagePath = `fotos/${prestador.id}/perfil.${ext}`;
      const { error: upErr } = await supabase.storage.from('chat-arquivos').upload(storagePath, file, { upsert: true, contentType: file.type });
      if (upErr) { mostrarMsg('erro', `Erro ao enviar foto: ${upErr.message}`); setUploadingFoto(false); e.target.value = ''; return; }
      const { data: urlData } = supabase.storage.from('chat-arquivos').getPublicUrl(storagePath);
      const url = urlData.publicUrl + '?t=' + Date.now();
      const { error: dbErr } = await supabase.from('prestadores').update({ foto_url: url }).eq('id', prestador.id);
      if (dbErr) { mostrarMsg('erro', `Erro ao salvar URL: ${dbErr.message}`); setUploadingFoto(false); e.target.value = ''; return; }
      setPerfil((p: any) => ({ ...p, foto_url: url }));
      mostrarMsg('ok', 'Foto de perfil atualizada!');
    } catch (err: any) { mostrarMsg('erro', err.message || 'Erro desconhecido'); }
    setUploadingFoto(false);
    e.target.value = '';
  }

  async function uploadDocVerificacao(tipo: 'selfie' | 'documento', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !prestador) return;
    setUploadingDoc(tipo);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const storagePath = `documentos/${prestador.id}/${tipo}.${ext}`;
      const { error: upErr } = await supabase.storage.from('chat-arquivos').upload(storagePath, file, { upsert: true, contentType: file.type });
      if (upErr) { mostrarMsg('erro', `Erro ao enviar ${tipo}: ${upErr.message}`); setUploadingDoc(null); e.target.value = ''; return; }
      const { data: urlData } = supabase.storage.from('chat-arquivos').getPublicUrl(storagePath);
      const url = urlData.publicUrl;
      const field = tipo === 'selfie' ? 'selfie_url' : 'doc_identidade_url';
      const { error: dbErr } = await supabase.from('prestadores').update({ [field]: url }).eq('id', prestador.id);
      if (dbErr) { mostrarMsg('erro', `Erro ao salvar no banco: ${dbErr.message}`); setUploadingDoc(null); e.target.value = ''; return; }
      setPerfil((p: any) => ({ ...p, [field]: url }));
      mostrarMsg('ok', tipo === 'selfie' ? 'Selfie enviada com sucesso!' : 'Documento enviado com sucesso!');
    } catch (err: any) { mostrarMsg('erro', err.message || 'Erro desconhecido'); }
    setUploadingDoc(null);
    e.target.value = '';
  }

  async function solicitarVerificacao() {
    if (!prestador || !perfil) return;
    setSolicitandoVerif(true);
    await supabase.from('prestadores').update({ verificacao_solicitada: true }).eq('id', prestador.id);
    setPerfil((p: any) => ({ ...p, verificacao_solicitada: true }));
    setSolicitandoVerif(false);
  }

  async function compressImage(file: File, maxWidth = 1200, quality = 0.78): Promise<File> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target!.result as string;
        img.onload = () => {
          const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
            'image/jpeg', quality
          );
        };
      };
    });
  }

  async function uploadFotoGaleria(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !prestador) return;
    if (galeria.length >= 6) { mostrarMsg('erro', 'Máximo de 6 fotos atingido.'); return; }
    setUploadingGaleria(true);
    try {
      const file = await compressImage(rawFile);
      const storagePath = `fotos/${prestador.id}/galeria_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('chat-arquivos').upload(storagePath, file, { upsert: false, contentType: 'image/jpeg' });
      if (upErr) { mostrarMsg('erro', `Erro ao enviar foto: ${upErr.message}`); setUploadingGaleria(false); e.target.value = ''; return; }
      const { data: urlData } = supabase.storage.from('chat-arquivos').getPublicUrl(storagePath);
      const url = urlData.publicUrl;
      const newGaleria = [...galeria, url];
      const { error: dbErr } = await supabase.from('prestadores').update({ fotos_urls: newGaleria }).eq('id', prestador.id);
      if (dbErr) { mostrarMsg('erro', `Erro ao salvar foto: ${dbErr.message}`); setUploadingGaleria(false); e.target.value = ''; return; }
      setGaleria(newGaleria);
      mostrarMsg('ok', 'Foto de portfólio adicionada!');
    } catch (err: any) { mostrarMsg('erro', err.message || 'Erro desconhecido'); }
    setUploadingGaleria(false);
    e.target.value = '';
  }

  async function removerFotoGaleria(idx: number) {
    if (!prestador) return;
    const newGaleria = galeria.filter((_, i) => i !== idx);
    const { error } = await supabase.from('prestadores').update({ fotos_urls: newGaleria }).eq('id', prestador.id);
    if (error) { mostrarMsg('erro', 'Erro ao remover foto.'); return; }
    setGaleria(newGaleria);
    mostrarMsg('ok', 'Foto removida.');
  }

  useEffect(() => {
    if (!prestador) { navigate('/auth'); return; }
    carregarTudo();
  }, []);

  async function carregarTudo() {
    if (!prestador) return;
    const [lRes, sRes, avRes, pRes, cRes] = await Promise.all([
      supabase.from('orcs').select('*').eq('prestador_id', prestador.id).order('criado_em', { ascending: false }),
      supabase.from('servicos').select('*, categorias(nome,icone)').eq('prestador_id', prestador.id).order('criado_em', { ascending: false }),
      supabase.from('avaliacoes').select('*').eq('avaliado_id', prestador.id).eq('avaliado_tipo', 'prestador').order('criado_em', { ascending: false }),
      supabase.from('prestadores').select('*').eq('id', prestador.id).limit(1),
      supabase.from('categorias').select('id,nome,icone').eq('ativa', true).order('nome'),
    ]);
    setLeads(lRes.data || []);
    setServicos(sRes.data || []);
    setAvaliacoes(avRes.data || []);
    if (pRes.data?.[0]) {
      setPerfil(pRes.data[0]);
      setGaleria(Array.isArray(pRes.data[0].fotos_urls) ? pRes.data[0].fotos_urls : []);
    }
    if (cRes.data?.length) setCategorias(cRes.data);

    // Carregar avaliações feitas pelo prestador (avaliou clientes)
    const orcIds = (lRes.data || []).map((o: any) => o.id);
    if (orcIds.length) {
      const { data: feitasData } = await supabase.from('avaliacoes')
        .select('*').in('orc_id', orcIds).eq('avaliado_tipo', 'usuario')
        .order('criado_em', { ascending: false });
      setAvaliacoesFeitas(feitasData || []);
    }
    try {
      const chatsData = await apiCall(`/api/chat/prestador/${prestador.id}`);
      setChats(chatsData || []);
    } catch { setChats([]); }
    try {
      const contratosData = await apiCall(`/api/contratos/prestador/${prestador.id}`);
      setContratos(contratosData || []);
    } catch { setContratos([]); }
    setLoading(false);
  }

  const setForm = (k: string, v: any) => setFormServico(f => ({ ...f, [k]: v }));

  async function criarServico() {
    if (!formServico.titulo || !formServico.categoria_id) {
      setErroForm('Preencha o título e a categoria.'); return;
    }
    setSalvando(true); setErroForm('');
    try {
      const { error } = await supabase.from('servicos').insert({
        titulo: formServico.titulo,
        descricao: formServico.descricao || null,
        categoria_id: formServico.categoria_id,
        prestador_id: prestador!.id,
        tipo: formServico.tipo,
        valor_fixo: formServico.valor_fixo ? parseFloat(formServico.valor_fixo) : null,
        aceita_orcamento_online: formServico.aceita_orcamento_online,
        cidade: perfil?.cidade || 'Santa Maria',
        ativo: true
      });
      if (error) throw error;
      setModalServico(false);
      setFormServico({ titulo: '', descricao: '', categoria_id: '', tipo: 'orcamento', valor_fixo: '', aceita_orcamento_online: false });
      carregarTudo();
    } catch (e: any) { setErroForm(e.message); }
    setSalvando(false);
  }

  async function marcarConcluido(orcId: string, nomeCliente?: string) {
    if (!confirm('Confirmar que o serviço foi concluído?')) return;
    setConcluindoOrc(orcId);
    try {
      await supabase.from('orcs').update({ status: 'SERVIÇO CONCLUÍDO' }).eq('id', orcId);
      await carregarTudo();
      setModalAvalCliente({ orc_id: orcId, nome_cliente: nomeCliente || 'Cliente' });
    } catch (e: any) {
      alert('Erro: ' + (e.message || 'Não foi possível marcar como concluído.'));
    }
    setConcluindoOrc(null);
  }

  async function avaliarCliente() {
    if (!modalAvalCliente || !prestador) return;
    setEnviandoAvalCliente(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://servi-o-seguro-production.up.railway.app';
      const res = await fetch(`${API_URL}/api/admin/avaliacoes/publica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orc_id: modalAvalCliente.orc_id,
          avaliado_tipo: 'usuario',
          avaliador_tipo: 'prestador',
          nota: formAvalCliente.nota,
          comentario: formAvalCliente.comentario,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert('Erro ao enviar avaliação: ' + (json?.error || res.status));
        setEnviandoAvalCliente(false);
        return;
      }
      // Só atualiza estado local se salvou no banco
      setAvaliacoesFeitas(prev => [...prev, { orc_id: modalAvalCliente!.orc_id, avaliado_tipo: 'usuario', nota: formAvalCliente.nota, comentario: formAvalCliente.comentario, avaliador: prestador.nome, criado_em: new Date().toISOString() }]);
      setModalAvalCliente(null);
      setFormAvalCliente({ nota: 5, comentario: '' });
    } catch (e: any) {
      alert('Erro de conexão: ' + (e?.message || 'tente novamente'));
    }
    setEnviandoAvalCliente(false);
  }

  async function salvarPerfil() {
    setSalvandoPerfil(true); setErroPerfil('');
    try {
      const updates: any = {};
      if (formPerfil.nome) updates.nome = formPerfil.nome;
      if (formPerfil.telefone) updates.telefone = formPerfil.telefone;
      if (formPerfil.cpf) updates.cpf = formPerfil.cpf;
      if (formPerfil.bio !== undefined) updates.bio = formPerfil.bio;
      if (formPerfil.cidade) updates.cidade = formPerfil.cidade;
      if (formPerfil.estado) updates.estado = formPerfil.estado;
      const { error } = await supabase.from('prestadores').update(updates).eq('id', prestador!.id);
      if (error) throw error;
      setPerfil((p: any) => ({ ...p, ...updates }));
      setEditandoPerfil(false);
    } catch (e: any) { setErroPerfil(e.message || 'Erro ao salvar.'); }
    setSalvandoPerfil(false);
  }

  async function toggleServico(id: string, ativo: boolean) {
    await supabase.from('servicos').update({ ativo: !ativo }).eq('id', id);
    carregarTudo();
  }

  const mediaAvaliacao = avaliacoes.length
    ? (avaliacoes.reduce((a, v) => a + v.nota, 0) / avaliacoes.length).toFixed(1)
    : '—';

  const comissaoPendente = contratos
    .filter(c => !c.assinado_prestador || !c.assinado_cliente)
    .reduce((acc, c) => acc + (Number(c.comissao) || 0), 0);

  const kpiCards = [
    {
      label: 'Total de ORCs',
      value: leads.length,
      icon: TrendingUp,
      iconBg: '#E6F1FB',
      iconColor: '#0C447C',
      delta: leads.filter(l => l.status !== 'CANCELADO' && l.status !== 'ENCERRADO').length + ' ativos',
    },
    {
      label: 'ORCs ativos',
      value: leads.filter(l => !['CANCELADO','ENCERRADO','SERVIÇO CONCLUÍDO'].includes(l.status)).length,
      icon: CheckCircle2,
      iconBg: TEAL_LIGHT_BG,
      iconColor: TEAL_DARK_TEXT,
      delta: leads.filter(l => l.status === 'CONTRATO ASSINADO').length + ' assinados',
    },
    {
      label: 'Avaliação média',
      value: mediaAvaliacao,
      icon: Star,
      iconBg: '#fffbeb',
      iconColor: '#b45309',
      delta: avaliacoes.length + ' avaliações',
    },
    {
      label: 'Comissão pendente',
      value: comissaoPendente > 0
        ? `R$ ${comissaoPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : 'R$ 0,00',
      icon: DollarSign,
      iconBg: '#EEEDFE',
      iconColor: '#26215C',
      delta: contratos.filter(c => c.assinado_cliente && c.assinado_prestador).length + ' contratos fechados',
    },
  ];

  const currentNavLabel = navItems.find(n => n.id === aba)?.label || 'Dashboard';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <div
        className="animate-spin w-10 h-10 border-4 border-t-transparent rounded-full"
        style={{ borderColor: TEAL, borderTopColor: 'transparent' }}
      />
    </div>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#e2e8f0]">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileMenu(false)}>
          <img src="/logo-escudo.png" alt="Serviço Seguro" style={{ height: 34, width: 'auto', display: 'block', flexShrink: 0 }} />
          <span className="font-extrabold text-sm" style={{ color: PRIMARY }}>Serviço Seguro</span>
        </Link>
      </div>

      {/* Provider avatar block */}
      <div className="px-4 py-4 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-3">
          {perfil?.foto_url ? (
            <img
              src={perfil.foto_url}
              alt={perfil.nome}
              className="w-11 h-11 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0"
              style={{ background: 'oklch(0.92 0.05 184)', color: TEAL_DARK_TEXT }}
            >
              {(prestador?.nome || 'P').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate" style={{ color: PRIMARY }}>{prestador?.nome}</div>
            <span
              className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5 mt-0.5 inline-block"
              style={{ background: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT }}
            >
              Prestador
            </span>
          </div>
        </div>
        {perfil?.verificado && (
          <div
            className="flex items-center gap-1.5 mt-2.5 text-xs font-semibold"
            style={{ color: TEAL_DARK_TEXT }}
          >
            <Shield className="w-3 h-3" />
            Identidade verificada
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon, badge }) => {
          const isPerfilOrServico = id === 'perfil' || id === 'servicos';
          const activeStyle = id === 'perfil'
            ? { background: 'oklch(0.95 0.03 184)', color: TEAL_DARK_TEXT }
            : id === 'servicos'
            ? { background: '#EEEDFE', color: '#26215C' }
            : { background: 'rgba(3,2,19,0.08)', color: PRIMARY };
          const inactiveStyle = id === 'perfil'
            ? { color: TEAL_DARK_TEXT, fontWeight: 700 }
            : id === 'servicos'
            ? { color: '#534AB7', fontWeight: 700 }
            : { color: '#64748b' };
          return (
            <button
              key={id}
              onClick={() => { setAba(id); setMobileMenu(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-semibold transition-all"
              style={aba === id ? activeStyle : inactiveStyle}
              onMouseEnter={e => {
                if (aba !== id) (e.currentTarget as HTMLButtonElement).style.background = isPerfilOrServico ? 'rgba(0,0,0,0.03)' : 'rgba(3,2,19,0.04)';
              }}
              onMouseLeave={e => {
                if (aba !== id) (e.currentTarget as HTMLButtonElement).style.background = '';
              }}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {badge && <span className="ml-auto text-base">{badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-[#e2e8f0]">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-semibold transition-all"
          style={{ color: '#b91c1c' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ background: '#f8fafc' }}>
      {/* SIDEBAR — desktop */}
      <aside
        className="w-64 flex-shrink-0 border-r border-[#e2e8f0] bg-white min-h-screen sticky top-0 self-start hidden lg:flex flex-col"
        style={{ height: '100vh' }}
      >
        {sidebarContent}
      </aside>

      {/* SIDEBAR — mobile overlay */}
      {mobileMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileMenu(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-64 bg-white z-50 flex flex-col lg:hidden shadow-[0_14px_40px_-18px_rgba(3,2,19,0.25)]">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* TOAST UPLOAD */}
      {uploadMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-[14px] shadow-lg text-sm font-semibold flex items-center gap-2 transition-all"
          style={uploadMsg.tipo === 'ok'
            ? { background: '#EAF3DE', color: '#173404', border: '1px solid #b7e08a' }
            : { background: '#FCEBEB', color: '#501313', border: '1px solid #f5c6c6' }}>
          {uploadMsg.tipo === 'ok' ? '✓' : '✕'} {uploadMsg.texto}
        </div>
      )}

      {/* MAIN */}
      <div className="flex-1 min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="bg-white border-b border-[#e2e8f0] px-7 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-[10px] transition-colors"
              style={{ color: '#64748b' }}
              onClick={() => setMobileMenu(!mobileMenu)}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(3,2,19,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-extrabold text-base leading-tight truncate max-w-[160px] sm:max-w-none" style={{ color: PRIMARY }}>{currentNavLabel}</h1>
              <p className="text-xs text-[#64748b] leading-tight">Portal do Prestador</p>
            </div>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full text-white hidden sm:inline-block"
            style={{ background: TEAL }}
          >
            Profissional
          </span>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-7 flex-1">

          {/* ── DASHBOARD ── */}
          {aba === 'dashboard' && (
            <div className="space-y-6">
              {/* Pendências de avaliação */}
              {(() => {
                const pendentes = contratos.filter((c: any) =>
                  c.assinado_cliente && c.assinado_prestador &&
                  !avaliacoesFeitas.find((a: any) => a.orc_id === c.orc_id)
                );
                if (!pendentes.length) return null;
                return (
                  <div
                    className="rounded-[16px] p-4 flex items-center gap-4 cursor-pointer"
                    style={{ background: '#FEF3C7', border: '2px solid #FCD34D' }}
                    onClick={() => setAba('chats')}
                  >
                    <span className="text-3xl">⭐</span>
                    <div className="flex-1">
                      <div className="font-bold text-amber-900 text-sm">Avaliação pendente!</div>
                      <div className="text-xs text-amber-700 mt-0.5">
                        {pendentes.length === 1
                          ? 'Você tem 1 contrato assinado aguardando sua avaliação do cliente.'
                          : `Você tem ${pendentes.length} contratos aguardando avaliação.`}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-800 underline whitespace-nowrap">Ir para Contratos →</span>
                  </div>
                );
              })()}
              {/* KPI grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map(card => (
                  <div
                    key={card.label}
                    className="bg-white border border-[#e2e8f0] rounded-[16px] p-5"
                    style={{ boxShadow: '0 14px 40px -18px rgba(3,2,19,0.10)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-sm text-[#64748b] font-semibold leading-snug">{card.label}</p>
                      <div
                        className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                        style={{ background: card.iconBg }}
                      >
                        <card.icon className="w-4 h-4" style={{ color: card.iconColor }} />
                      </div>
                    </div>
                    <div className="text-[26px] font-extrabold leading-none mb-1" style={{ color: PRIMARY }}>
                      {card.value}
                    </div>
                    <div className="text-xs font-semibold" style={{ color: TEAL_DARK_TEXT }}>{card.delta}</div>
                  </div>
                ))}
              </div>

              {/* Recent ORCs */}
              <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                  <h2 className="font-bold text-sm" style={{ color: PRIMARY }}>ORCs recentes</h2>
                  <button
                    className="text-xs font-semibold transition-colors"
                    style={{ color: TEAL_DARK_TEXT }}
                    onClick={() => setAba('leads')}
                  >
                    Ver todos →
                  </button>
                </div>
                {leads.length === 0 ? (
                  <div className="py-16 text-center text-[#64748b]">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">Nenhum ORC ainda.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Código', 'Resumo', 'Cliente', 'Status', 'Data'].map(h => (
                            <th
                              key={h}
                              className="px-5 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider"
                              style={{ color: '#64748b' }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leads.slice(0, 5).map((l: any) => (
                          <tr key={l.id} className="border-t border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors">
                            <td className="px-5 py-3 font-mono font-bold text-xs" style={{ color: PRIMARY }}>{l.codigo}</td>
                            <td className="px-5 py-3 text-[#64748b] max-w-[180px] truncate text-xs">{l.resumo_anamnese?.substring(0, 50) || '—'}</td>
                            <td className="px-5 py-3 font-semibold text-sm" style={{ color: PRIMARY }}>{l.nome_cliente || '—'}</td>
                            <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                            <td className="px-5 py-3 text-xs text-[#64748b]">{l.criado_em ? new Date(l.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── LEADS / ORCs ── */}
          {aba === 'leads' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-[#64748b]">{leads.length} ORC{leads.length !== 1 ? 's' : ''} encontrado{leads.length !== 1 ? 's' : ''}</p>
              </div>
              {leads.length === 0 ? (
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-16 text-center text-[#64748b]">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm">Nenhum ORC recebido ainda.</p>
                </div>
              ) : (
                leads.map((l: any) => (
                  <div
                    key={l.id}
                    className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 mb-3"
                    style={{ boxShadow: '0 14px 40px -18px rgba(3,2,19,0.08)' }}
                  >
                    <div className="flex flex-wrap items-start gap-3 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-mono font-bold text-sm" style={{ color: PRIMARY }}>{l.codigo}</span>
                          <StatusBadge status={l.status} />
                          <span className="text-xs text-[#64748b]">{l.canal === 'whatsapp' ? '📱 WhatsApp' : '💻 Web'}</span>
                        </div>
                        <div className="font-bold text-sm mb-0.5" style={{ color: PRIMARY }}>{l.nome_cliente || '—'}</div>
                        {l.resumo_anamnese && (
                          <p className="text-xs text-[#64748b] line-clamp-2 mt-1">{l.resumo_anamnese}</p>
                        )}
                        <div className="text-xs text-[#94a3b8] mt-1.5">
                          {l.criado_em ? new Date(l.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {l.link_token && (
                          <a
                            href={`/chat/${l.link_token}?papel=prestador`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold px-4 py-2 rounded-[10px] border border-[#e2e8f0] transition-colors text-center hover:bg-[#f8fafc]"
                            style={{ color: PRIMARY }}
                          >
                            Ver chat
                          </a>
                        )}
                        {(l.status === 'CONTRATO GERADO' || l.status === 'ANAMNESE CONCLUÍDA') && (
                          <a
                            href={`/contrato?orc=${l.id}&papel=prestador`}
                            className="text-xs font-bold px-4 py-2 rounded-[10px] border transition-colors text-center"
                            style={{ background: '#EEEDFE', color: '#26215C', borderColor: '#EEEDFE' }}
                          >
                            Assinar contrato
                          </a>
                        )}
                        {l.status === 'CONTRATO ASSINADO' && (
                          <button
                            onClick={() => marcarConcluido(l.id)}
                            disabled={concluindoOrc === l.id}
                            className="text-xs font-bold px-4 py-2 rounded-[10px] text-white transition-colors text-center disabled:opacity-50"
                            style={{ background: TEAL }}
                          >
                            {concluindoOrc === l.id ? '⏳...' : 'Marcar concluído'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── CONVERSAS ── */}
          {aba === 'conversas' && (() => {
            const ativos = chats.filter((c: any) => !['finalizado', 'contrato_assinado'].includes(c.status));
            const encerrados = chats.filter((c: any) => ['finalizado', 'contrato_assinado'].includes(c.status));
            const lista = abaConversas === 'ativos' ? ativos : encerrados;
            return (
              <div className="space-y-3">
                {/* Sub-tabs */}
                <div className="flex gap-2">
                  {(['ativos', 'encerrados'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setAbaConversas(tab)}
                      className="px-4 py-2 rounded-[10px] text-sm font-bold transition-colors"
                      style={abaConversas === tab
                        ? { background: PRIMARY, color: '#fff' }
                        : { background: '#f1f5f9', color: '#64748b' }}
                    >
                      {tab === 'ativos' ? `💬 Ativos (${ativos.length})` : `✓ Encerrados (${encerrados.length})`}
                    </button>
                  ))}
                </div>
                {lista.length === 0 ? (
                  <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-16 text-center text-[#64748b]">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">{abaConversas === 'ativos' ? 'Nenhuma conversa ativa.' : 'Nenhuma conversa encerrada.'}</p>
                  </div>
                ) : lista.map((c: any) => (
                  <div key={c.id} className="bg-white border border-[#e2e8f0] rounded-[16px] p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                    <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background: abaConversas === 'ativos' ? TEAL_LIGHT_BG : '#f1f5f9' }}>
                      {abaConversas === 'ativos' ? '💬' : '✓'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-mono font-bold text-sm text-[#030213]">{c.orcs?.codigo || '—'}</span>
                        <span className="rounded-full text-[10.5px] font-bold px-2 py-0.5"
                          style={abaConversas === 'ativos'
                            ? { background: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT }
                            : { background: '#f1f5f9', color: '#64748b' }}>
                          {c.status === 'contrato_assinado' ? 'Contrato assinado' : c.status === 'finalizado' ? 'Finalizado' : c.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-[#64748b] truncate">{c.orcs?.nome_cliente || 'Cliente'}</p>
                      <p className="text-xs text-[#94a3b8] mt-0.5">{c.orcs?.servicos?.titulo || c.orcs?.servico_nome || ''} · {c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : ''}</p>
                    </div>
                    <Link to={`/chat/${c.link_token}?papel=prestador`}
                      className="text-xs font-bold px-3 py-2 rounded-[10px] border border-[#e2e8f0] text-[#030213] hover:bg-[#f8fafc] transition-colors flex-shrink-0">
                      Abrir
                    </Link>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── CHATS → CONTRATOS ── */}
          {aba === 'chats' && (
            <div className="space-y-3">
              <p className="text-sm text-[#64748b] mb-2">Contratos gerados via chat de negociação</p>
              {contratos.length === 0 ? (
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-16 text-center text-[#64748b]">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm">Nenhum contrato gerado ainda.</p>
                  <p className="text-xs mt-1 text-[#94a3b8]">Os contratos aparecem após finalizar a negociação no chat.</p>
                </div>
              ) : (
                contratos.map((c: any) => {
                  const ambosAssinaram = c.assinado_cliente && c.assinado_prestador;
                  const clienteAssinou = c.assinado_cliente;
                  const prestadorAssinou = c.assinado_prestador;
                  const API_URL = 'https://servi-o-seguro-production.up.railway.app';
                  return (
                    <div
                      key={c.id}
                      className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden"
                      style={{ boxShadow: '0 14px 40px -18px rgba(3,2,19,0.08)' }}
                    >
                      {/* Header strip */}
                      <div
                        className="border-b border-[#e2e8f0] px-5 py-3.5 rounded-t-[16px] flex flex-wrap items-center gap-3 justify-between"
                        style={{ background: '#f8fafc' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-xs" style={{ color: PRIMARY }}>{c.orcs?.codigo || '—'}</span>
                          {c.tipo && (
                            <span
                              className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                              style={{ background: '#EEEDFE', color: '#26215C' }}
                            >
                              {c.tipo === 'carta_aceite' ? 'Carta Aceite' : 'Contrato Seguro'}
                            </span>
                          )}
                          {ambosAssinaram ? (
                            <span
                              className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                              style={{ background: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT }}
                            >
                              Assinado por ambos
                            </span>
                          ) : (
                            <span
                              className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                              style={{ background: '#fffbeb', color: '#b45309' }}
                            >
                              Aguardando assinatura
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#64748b]">
                          {c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                        </span>
                      </div>

                      <div className="p-5">
                        {/* 3-col detail grid */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Cliente</div>
                            <div className="text-sm font-semibold" style={{ color: PRIMARY }}>{c.orcs?.nome_cliente || '—'}</div>
                          </div>
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Valor</div>
                            <div className="text-sm font-semibold" style={{ color: PRIMARY }}>
                              {c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Comissão</div>
                            <div className="text-sm font-semibold" style={{ color: TEAL_DARK_TEXT }}>
                              {c.comissao ? `R$ ${Number(c.comissao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </div>
                          </div>
                        </div>

                        {/* Signature pills */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div
                            className="px-3 py-2 rounded-[10px] text-xs font-semibold"
                            style={
                              clienteAssinou
                                ? { background: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT }
                                : { background: '#f1f5f9', color: '#64748b' }
                            }
                          >
                            👤 Cliente: {clienteAssinou
                              ? `✓ ${c.assinado_cliente_em ? new Date(c.assinado_cliente_em).toLocaleDateString('pt-BR') : 'Assinado'}`
                              : 'Pendente'}
                          </div>
                          <div
                            className="px-3 py-2 rounded-[10px] text-xs font-semibold"
                            style={
                              prestadorAssinou
                                ? { background: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT }
                                : { background: '#fffbeb', color: '#b45309' }
                            }
                          >
                            👷 Você: {prestadorAssinou
                              ? `✓ ${c.assinado_prestador_em ? new Date(c.assinado_prestador_em).toLocaleDateString('pt-BR') : 'Assinado'}`
                              : 'Pendente'}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/contrato?orc=${c.orc_id}&papel=prestador`}
                            className="text-xs font-bold px-4 py-2 rounded-[10px] text-white transition-opacity hover:opacity-90 text-center"
                            style={{ background: PRIMARY }}
                          >
                            {ambosAssinaram ? 'Ver contrato' : 'Assinar'}
                          </a>
                          <a
                            href={`${API_URL}/api/contratos/${c.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold px-4 py-2 rounded-[10px] border border-[#e2e8f0] transition-colors hover:bg-[#f8fafc] text-center"
                            style={{ color: '#64748b' }}
                          >
                            Baixar PDF
                          </a>
                          {ambosAssinaram && c.orcs?.status === 'CONTRATO ASSINADO' && (
                            <button
                              onClick={() => marcarConcluido(c.orc_id, c.orcs?.nome_cliente)}
                              disabled={concluindoOrc === c.orc_id}
                              className="text-xs font-bold px-4 py-2 rounded-[10px] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                              style={{ background: TEAL }}
                            >
                              {concluindoOrc === c.orc_id ? '⏳...' : 'Marcar concluído'}
                            </button>
                          )}
                          {ambosAssinaram && !avaliacoesFeitas.find((a: any) => a.orc_id === c.orc_id) && (
                            <button
                              onClick={() => setModalAvalCliente({ orc_id: c.orc_id, nome_cliente: c.orcs?.nome_cliente || 'Cliente' })}
                              className="text-xs font-bold px-4 py-2 rounded-[10px] text-amber-800 bg-amber-50 border border-amber-300 transition-opacity hover:opacity-90"
                            >
                              ⭐ Avaliar cliente
                            </button>
                          )}
                          {ambosAssinaram && avaliacoesFeitas.find((a: any) => a.orc_id === c.orc_id) && (
                            <span className="inline-flex items-center gap-1 text-xs text-[#94a3b8] px-2">✓ Cliente avaliado</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── SERVIÇOS ── */}
          {aba === 'servicos' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <p className="text-sm text-[#64748b]">{servicos.length} serviço{servicos.length !== 1 ? 's' : ''} cadastrado{servicos.length !== 1 ? 's' : ''}</p>
                <button
                  onClick={() => setModalServico(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-[10px] text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ background: TEAL }}
                >
                  <Plus className="h-4 w-4" /> Novo Serviço
                </button>
              </div>
              {servicos.length === 0 ? (
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-16 text-center text-[#64748b]">
                  <Settings className="h-10 w-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm mb-4">Nenhum serviço cadastrado ainda.</p>
                  <button
                    onClick={() => setModalServico(true)}
                    className="inline-flex items-center gap-2 text-white px-5 py-2.5 rounded-[10px] text-sm font-bold"
                    style={{ background: PRIMARY }}
                  >
                    <Plus className="h-4 w-4" /> Cadastrar primeiro serviço
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {servicos.map((s: any) => (
                    <div
                      key={s.id}
                      className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 transition-shadow hover:shadow-[0_14px_40px_-18px_rgba(3,2,19,0.15)]"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
                            style={{ background: TEAL_LIGHT_BG }}
                          >
                            {s.categorias?.icone || '🔧'}
                          </div>
                          <div>
                            <div className="font-bold text-sm leading-snug" style={{ color: PRIMARY }}>{s.titulo}</div>
                            <div className="text-xs text-[#64748b]">{s.categorias?.nome}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {s.aceita_orcamento_online && (
                            <span
                              className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                              style={{ background: '#E6F1FB', color: '#0C447C' }}
                            >
                              Orça online
                            </span>
                          )}
                          <span
                            className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                            style={
                              s.ativo
                                ? { background: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT }
                                : { background: '#FCEBEB', color: '#501313' }
                            }
                          >
                            {s.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                      {s.descricao && <p className="text-xs text-[#64748b] mb-3 line-clamp-2">{s.descricao}</p>}
                      {s.valor_fixo && (
                        <div className="text-sm font-bold mb-3" style={{ color: TEAL_DARK_TEXT }}>
                          R$ {Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                      <button
                        onClick={() => toggleServico(s.id, s.ativo)}
                        className="text-xs px-3 py-1.5 rounded-[8px] font-bold transition-colors border"
                        style={
                          s.ativo
                            ? { background: '#FCEBEB', color: '#501313', borderColor: '#FCEBEB' }
                            : { background: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT, borderColor: TEAL_LIGHT_BG }
                        }
                      >
                        {s.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AVALIAÇÕES ── */}
          {aba === 'avaliacoes' && (
            <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                <h2 className="font-bold text-sm" style={{ color: PRIMARY }}>Avaliações</h2>
                {avaliacoes.length > 0 && (
                  <div className="text-sm" style={{ color: '#64748b' }}>
                    Média: <strong style={{ color: PRIMARY }}>⭐ {(avaliacoes.reduce((a: number, v: any) => a + v.nota, 0) / avaliacoes.length).toFixed(1)}</strong>
                  </div>
                )}
              </div>
              {/* Sub-tabs */}
              <div className="flex border-b border-[#e2e8f0]">
                {(['recebidas', 'feitas'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAbaAvaliacoes(tab)}
                    className="flex-1 py-3 text-sm font-bold transition-colors"
                    style={abaAvaliacoes === tab
                      ? { color: TEAL_DARK_TEXT, borderBottom: `2px solid ${TEAL}` }
                      : { color: '#94a3b8' }}
                  >
                    {tab === 'recebidas' ? `Recebidas (${avaliacoes.length})` : `Feitas (${avaliacoesFeitas.length})`}
                  </button>
                ))}
              </div>
              {abaAvaliacoes === 'recebidas' && (
                avaliacoes.length === 0 ? (
                  <div className="py-16 text-center text-[#64748b]">
                    <Star className="h-10 w-10 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">Nenhuma avaliação recebida ainda.</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-3">
                    {avaliacoes.map((av: any) => (
                      <div key={av.id} className="border border-[#e2e8f0] rounded-[16px] p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-bold text-sm" style={{ color: PRIMARY }}>{av.avaliador || 'Cliente'}</div>
                            <div className="text-xs text-[#64748b] mt-0.5">Avaliou seu serviço</div>
                          </div>
                          <span className="text-amber-500 text-base flex-shrink-0">{'⭐'.repeat(av.nota)}</span>
                        </div>
                        {av.comentario && <p className="text-sm text-[#64748b]">{av.comentario}</p>}
                        <p className="text-xs text-[#94a3b8] mt-2">
                          {av.criado_em ? new Date(av.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              )}
              {abaAvaliacoes === 'feitas' && (() => {
                const pendentes = contratos.filter((c: any) =>
                  c.assinado_cliente && c.assinado_prestador &&
                  !avaliacoesFeitas.find((a: any) => a.orc_id === c.orc_id)
                );
                const temConteudo = pendentes.length > 0 || avaliacoesFeitas.length > 0;
                if (!temConteudo) {
                  return (
                    <div className="py-16 text-center text-[#64748b]">
                      <Star className="h-10 w-10 mx-auto mb-3 opacity-25" />
                      <p className="text-sm">Nenhuma avaliação feita ainda.</p>
                      <p className="text-xs mt-1 text-[#94a3b8]">Avalie seus clientes nos contratos assinados.</p>
                    </div>
                  );
                }
                return (
                  <div className="p-5 space-y-3">
                    {pendentes.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">⭐ Pendentes de avaliação</p>
                        {pendentes.map((c: any) => (
                          <div key={c.id} className="border-2 border-amber-300 bg-amber-50 rounded-[16px] p-4 flex items-center justify-between gap-4">
                            <div>
                              <div className="font-bold text-sm text-[#030213]">{c.orcs?.nome_cliente || 'Cliente'}</div>
                              <div className="text-xs text-[#64748b] mt-0.5">
                                Contrato assinado em {c.assinado_em ? new Date(c.assinado_em).toLocaleDateString('pt-BR') : new Date(c.criado_em).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                            <button
                              onClick={() => setModalAvalCliente({ orc_id: c.orc_id, nome_cliente: c.orcs?.nome_cliente || 'Cliente' })}
                              className="text-xs font-bold px-4 py-2 rounded-[10px] text-white whitespace-nowrap"
                              style={{ background: TEAL }}
                            >⭐ Avaliar</button>
                          </div>
                        ))}
                      </>
                    )}
                    {avaliacoesFeitas.length > 0 && (
                      <>
                        {pendentes.length > 0 && <p className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mt-4 mb-2">Avaliações realizadas</p>}
                        {avaliacoesFeitas.map((av: any) => (
                          <div key={av.id} className="border border-[#e2e8f0] rounded-[16px] p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-bold text-sm" style={{ color: PRIMARY }}>Cliente avaliado</div>
                                <div className="text-xs text-[#64748b] mt-0.5">Sua avaliação</div>
                              </div>
                              <span className="text-amber-500 text-base flex-shrink-0">{'⭐'.repeat(av.nota)}</span>
                            </div>
                            {av.comentario && <p className="text-sm text-[#64748b]">{av.comentario}</p>}
                            <p className="text-xs text-[#94a3b8] mt-2">
                              {av.criado_em ? new Date(av.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                            </p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── FINANCEIRO ── */}
          {aba === 'financeiro' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5">
                  <p className="text-xs text-[#94a3b8] mb-1">Comissões pendentes</p>
                  <p className="text-2xl font-extrabold text-amber-600">
                    R$ {contratos.filter((c: any) => c.status_comissao === 'pendente' && c.assinado_cliente && c.assinado_prestador).reduce((acc: number, c: any) => acc + (Number(c.comissao) || 0), 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-5">
                  <p className="text-xs text-[#94a3b8] mb-1">Comissões pagas</p>
                  <p className="text-2xl font-extrabold text-green-600">
                    R$ {contratos.filter((c: any) => c.status_comissao === 'pago').reduce((acc: number, c: any) => acc + (Number(c.comissao) || 0), 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#e2e8f0]">
                  <h3 className="font-bold text-[#030213] text-sm">Histórico de comissões</h3>
                </div>
                {!contratos.length ? (
                  <div className="py-12 text-center text-[#94a3b8] text-sm">Nenhum contrato assinado ainda</div>
                ) : (
                  <div className="divide-y divide-[#f1f5f9]">
                    {contratos.filter((c: any) => c.assinado_cliente && c.assinado_prestador).map((c: any) => (
                      <div key={c.id} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[#030213] text-sm">{c.orcs?.codigo || c.id.slice(0, 8)}</p>
                          <p className="text-xs text-[#94a3b8]">{c.orcs?.nome_cliente} · {c.assinado_em ? new Date(c.assinado_em).toLocaleDateString('pt-BR') : new Date(c.criado_em).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#030213] text-sm">{c.comissao ? `R$ ${Number(c.comissao).toFixed(2)}` : '—'}</p>
                          <span className="rounded-full text-[10px] font-bold px-2 py-0.5"
                            style={c.status_comissao === 'pago'
                              ? { background: '#EAF3DE', color: '#173404' }
                              : c.status_comissao === 'isento'
                              ? { background: '#f1f5f9', color: '#64748b' }
                              : { background: '#FEF3C7', color: '#92400E' }}>
                            {c.status_comissao === 'pago' ? '✓ Pago' : c.status_comissao === 'isento' ? 'Isento' : '⏳ Pendente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PERFIL ── */}
          {aba === 'perfil' && perfil && (
            <div className="max-w-2xl space-y-4">
              <div
                className="bg-white border border-[#e2e8f0] rounded-[16px] overflow-hidden"
                style={{ boxShadow: '0 14px 40px -18px rgba(3,2,19,0.10)' }}
              >
                <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                  <h2 className="font-bold text-sm" style={{ color: PRIMARY }}>Meu Perfil</h2>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                      style={perfil.verificado ? { background: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT } : { background: '#fffbeb', color: '#b45309' }}
                    >
                      {perfil.verificado ? '🤳 Verificado' : '⏳ Pendente'}
                    </span>
                    <button
                      onClick={() => { setEditandoPerfil(!editandoPerfil); setFormPerfil({ nome: perfil.nome || '', telefone: perfil.telefone || '', cpf: perfil.cpf || '', bio: perfil.bio || '', cidade: perfil.cidade || '', estado: perfil.estado || '' }); setErroPerfil(''); }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-[8px] border border-[#e2e8f0] transition-colors hover:bg-[#f8fafc]"
                      style={{ color: editandoPerfil ? '#b91c1c' : '#64748b' }}
                    >
                      {editandoPerfil ? '✕ Cancelar' : '✏️ Editar'}
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Profile photo upload */}
                  <div className="flex items-center gap-5 pb-5 border-b border-[#e2e8f0]">
                    {perfil.foto_url ? (
                      <img src={perfil.foto_url} alt={perfil.nome} className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${TEAL_LIGHT_BG}` }} />
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl flex-shrink-0" style={{ background: 'oklch(0.92 0.05 184)', color: TEAL_DARK_TEXT }}>
                        {(formPerfil.nome || perfil.nome)?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm mb-2" style={{ color: PRIMARY }}>{perfil.nome}</div>
                      <label className="cursor-pointer inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-[10px] border border-[#e2e8f0] transition-colors hover:bg-[#f8fafc]" style={{ color: '#64748b' }}>
                        {uploadingFoto ? '⏳ Salvando...' : '📷 Alterar foto'}
                        <input type="file" accept="image/*" className="hidden" onChange={uploadFoto} disabled={uploadingFoto} />
                      </label>
                      <div className="text-xs text-[#94a3b8] mt-1.5">Esta foto aparece para os contratantes</div>
                    </div>
                  </div>

                  {/* ── GALERIA DE FOTOS DO TRABALHO ── */}
                  <div className="border-t border-[#e2e8f0] pt-5">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div>
                        <div className="font-bold text-sm" style={{ color: PRIMARY }}>📷 Fotos do seu trabalho</div>
                        <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                          Aparecem nos cards de busca — mostre a qualidade do seu serviço ({galeria.length}/6)
                        </div>
                      </div>
                      {galeria.length < 6 && (
                        <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-[10px] border border-[#e2e8f0] transition-colors hover:bg-[#f8fafc]"
                          style={{ color: '#64748b' }}>
                          {uploadingGaleria ? '⏳ Enviando...' : '+ Adicionar foto'}
                          <input type="file" accept="image/*" className="hidden" onChange={uploadFotoGaleria} disabled={uploadingGaleria} />
                        </label>
                      )}
                    </div>
                    {galeria.length === 0 ? (
                      <label className="cursor-pointer block border-2 border-dashed border-[#e2e8f0] rounded-[14px] py-12 text-center hover:border-[#030213] transition-colors group">
                        <div className="text-4xl mb-2">📷</div>
                        <div className="text-sm font-semibold text-[#64748b] mb-1">Nenhuma foto ainda</div>
                        <div className="text-xs text-[#94a3b8]">Clique para adicionar fotos do seu trabalho</div>
                        <input type="file" accept="image/*" className="hidden" onChange={uploadFotoGaleria} disabled={uploadingGaleria} />
                      </label>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {galeria.map((url, i) => (
                          <div key={i} className="relative group" style={{ aspectRatio: '1/1' }}>
                            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover rounded-[10px]" />
                            <button
                              onClick={() => removerFotoGaleria(i)}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remover foto"
                            >×</button>
                          </div>
                        ))}
                        {galeria.length < 6 && (
                          <label className="cursor-pointer border-2 border-dashed border-[#e2e8f0] rounded-[10px] flex flex-col items-center justify-center hover:border-[#030213] transition-colors"
                            style={{ aspectRatio: '1/1' }}>
                            <span className="text-2xl text-[#94a3b8]">+</span>
                            <span className="text-[10.5px] text-[#94a3b8] mt-0.5">Adicionar</span>
                            <input type="file" accept="image/*" className="hidden" onChange={uploadFotoGaleria} disabled={uploadingGaleria} />
                          </label>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Formulário de edição */}
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
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1">{l}</div>
                            <input
                              type={type}
                              value={(formPerfil as any)[k]}
                              onChange={e => setFormPerfil(p => ({ ...p, [k]: e.target.value }))}
                              className="w-full px-3 py-2 text-sm outline-none"
                              style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}
                              onFocus={e => (e.target.style.borderColor = PRIMARY)}
                              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                            />
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Bio / Apresentação</div>
                        <textarea
                          rows={3}
                          value={formPerfil.bio}
                          onChange={e => setFormPerfil(p => ({ ...p, bio: e.target.value }))}
                          placeholder="Conte um pouco sobre você e sua experiência..."
                          className="w-full px-3 py-2 text-sm outline-none resize-none"
                          style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}
                          onFocus={e => (e.target.style.borderColor = PRIMARY)}
                          onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                        />
                      </div>
                      {erroPerfil && <p className="text-xs text-red-500">{erroPerfil}</p>}
                      <button
                        onClick={salvarPerfil}
                        disabled={salvandoPerfil}
                        className="px-5 py-2.5 rounded-[10px] text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: PRIMARY }}
                      >
                        {salvandoPerfil ? '⏳ Salvando...' : '💾 Salvar alterações'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { l: 'Nome', v: perfil.nome }, { l: 'Email', v: perfil.email },
                          { l: 'WhatsApp', v: perfil.telefone }, { l: 'CPF', v: perfil.cpf || '—' },
                          { l: 'Cidade', v: perfil.cidade }, { l: 'Estado', v: perfil.estado },
                        ].map(f => (
                          <div key={f.l}>
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1">{f.l}</div>
                            <div className="text-sm font-semibold" style={{ color: PRIMARY }}>{f.v || '—'}</div>
                          </div>
                        ))}
                      </div>
                      {perfil.bio && (
                        <div>
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Sobre</div>
                          <div className="text-sm text-[#374151]">{perfil.bio}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Verificação de Perfil */}
                  <div className="border-t border-[#e2e8f0] pt-5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm" style={{ color: PRIMARY }}>Verificação de Perfil</div>
                      <span className="rounded-full text-[10.5px] font-bold px-2.5 py-0.5"
                        style={perfil.verificado
                          ? { background: TEAL_LIGHT_BG, color: TEAL_DARK_TEXT }
                          : perfil.verificacao_solicitada
                            ? { background: '#fffbeb', color: '#b45309' }
                            : { background: '#f1f5f9', color: '#64748b' }}>
                        {perfil.verificado ? '✓ Perfil Verificado' : perfil.verificacao_solicitada ? '⏳ Em análise' : 'Não verificado'}
                      </span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mb-4">
                      Envie uma selfie e seu RG ou CNH. Nossa equipe analisa e ativa o selo em até 24h.
                    </p>

                    {perfil.verificado ? (
                      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: TEAL_DARK_TEXT }}>
                        <Shield className="h-4 w-4" /> Seu perfil está verificado — o selo aparece para os contratantes.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Selfie */}
                        <div className="flex items-center gap-4 p-3 rounded-[12px] border" style={{ borderColor: perfil.selfie_url ? TEAL_LIGHT_BG : '#e2e8f0', background: perfil.selfie_url ? TEAL_LIGHT_BG : '#f8fafc' }}>
                          {perfil.selfie_url
                            ? <img src={perfil.selfie_url} alt="Selfie" className="w-12 h-12 rounded-[10px] object-cover flex-shrink-0" />
                            : <div className="w-12 h-12 rounded-[10px] bg-[#e2e8f0] flex items-center justify-center text-xl flex-shrink-0">🤳</div>}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold" style={{ color: PRIMARY }}>Selfie</div>
                            <div className="text-[10.5px]" style={{ color: perfil.selfie_url ? TEAL_DARK_TEXT : '#94a3b8' }}>
                              {perfil.selfie_url ? '✓ Enviada' : 'Foto do seu rosto'}
                            </div>
                          </div>
                          <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-[8px] border border-[#e2e8f0] bg-white hover:bg-[#f8fafc] transition-colors flex-shrink-0" style={{ color: '#64748b' }}>
                            {uploadingDoc === 'selfie' ? '⏳' : perfil.selfie_url ? 'Trocar' : 'Enviar'}
                            <input type="file" accept="image/*" className="hidden" onChange={e => uploadDocVerificacao('selfie', e)} disabled={uploadingDoc !== null} />
                          </label>
                        </div>

                        {/* Documento */}
                        <div className="flex items-center gap-4 p-3 rounded-[12px] border" style={{ borderColor: perfil.doc_identidade_url ? TEAL_LIGHT_BG : '#e2e8f0', background: perfil.doc_identidade_url ? TEAL_LIGHT_BG : '#f8fafc' }}>
                          {perfil.doc_identidade_url
                            ? <img src={perfil.doc_identidade_url} alt="Documento" className="w-12 h-12 rounded-[10px] object-cover flex-shrink-0" />
                            : <div className="w-12 h-12 rounded-[10px] bg-[#e2e8f0] flex items-center justify-center text-xl flex-shrink-0">🪪</div>}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold" style={{ color: PRIMARY }}>RG ou CNH</div>
                            <div className="text-[10.5px]" style={{ color: perfil.doc_identidade_url ? TEAL_DARK_TEXT : '#94a3b8' }}>
                              {perfil.doc_identidade_url ? '✓ Enviado' : 'Frente do documento'}
                            </div>
                          </div>
                          <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-[8px] border border-[#e2e8f0] bg-white hover:bg-[#f8fafc] transition-colors flex-shrink-0" style={{ color: '#64748b' }}>
                            {uploadingDoc === 'documento' ? '⏳' : perfil.doc_identidade_url ? 'Trocar' : 'Enviar'}
                            <input type="file" accept="image/*" className="hidden" onChange={e => uploadDocVerificacao('documento', e)} disabled={uploadingDoc !== null} />
                          </label>
                        </div>

                        {/* Botão solicitar */}
                        {perfil.selfie_url && perfil.doc_identidade_url && !perfil.verificacao_solicitada && (
                          <button
                            onClick={solicitarVerificacao}
                            disabled={solicitandoVerif}
                            className="w-full py-2.5 rounded-[10px] text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ background: TEAL }}>
                            {solicitandoVerif ? '⏳ Enviando...' : '🛡️ Solicitar verificação de perfil'}
                          </button>
                        )}

                        {perfil.verificacao_solicitada && (
                          <div className="text-xs text-center py-2 font-semibold" style={{ color: '#b45309' }}>
                            ⏳ Documentos em análise — resposta em até 24h
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MODAL AVALIAR CLIENTE ── */}
      {modalAvalCliente && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] w-full max-w-sm p-6" style={{ boxShadow: '0 14px 40px -18px rgba(3,2,19,0.35)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base" style={{ color: PRIMARY }}>Avaliar {modalAvalCliente.nome_cliente}</h3>
              <button onClick={() => setModalAvalCliente(null)} className="text-[#94a3b8] hover:text-[#64748b]"><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-4">
              <div className="text-sm font-semibold text-[#64748b] mb-2">Nota</div>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    onClick={() => setFormAvalCliente(f => ({ ...f, nota: n }))}
                    className="text-2xl transition-transform hover:scale-110"
                    style={{ opacity: n <= formAvalCliente.nota ? 1 : 0.3 }}
                  >⭐</button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <div className="text-sm font-semibold text-[#64748b] mb-2">Comentário (opcional)</div>
              <textarea
                rows={3}
                value={formAvalCliente.comentario}
                onChange={e => setFormAvalCliente(f => ({ ...f, comentario: e.target.value }))}
                placeholder="Como foi trabalhar com este cliente?"
                className="w-full border border-[#e2e8f0] rounded-[10px] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[oklch(0.6_0.118_184.704)]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setModalAvalCliente(null)}
                className="flex-1 py-2.5 rounded-[10px] text-sm font-bold border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]"
              >Pular</button>
              <button
                onClick={avaliarCliente}
                disabled={enviandoAvalCliente}
                className="flex-1 py-2.5 rounded-[10px] text-sm font-bold text-white disabled:opacity-50"
                style={{ background: TEAL }}
              >{enviandoAvalCliente ? 'Enviando...' : 'Enviar avaliação'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NOVO SERVIÇO ── */}
      {modalServico && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-[16px] w-full max-w-lg"
            style={{ boxShadow: '0 14px 40px -18px rgba(3,2,19,0.35)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <h3 className="font-bold text-sm" style={{ color: PRIMARY }}>Cadastrar novo serviço</h3>
              <button
                onClick={() => { setModalServico(false); setErroForm(''); }}
                className="p-2 rounded-[10px] transition-colors hover:bg-[#f1f5f9]"
                style={{ color: '#64748b' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {erroForm && (
                <div className="rounded-[10px] px-4 py-3 text-sm" style={{ background: '#FCEBEB', color: '#501313' }}>
                  ❌ {erroForm}
                </div>
              )}
              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5 block">Título do serviço *</label>
                <input
                  type="text"
                  value={formServico.titulo}
                  onChange={e => setForm('titulo', e.target.value)}
                  placeholder="Ex: Instalação elétrica residencial"
                  className="w-full border border-[#e2e8f0] rounded-[10px] px-4 py-3 text-sm outline-none transition-colors"
                  style={{ color: PRIMARY }}
                  onFocus={e => (e.target.style.borderColor = TEAL)}
                  onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                />
              </div>
              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5 block">Categoria *</label>
                <div className="relative">
                  <select
                    value={formServico.categoria_id}
                    onChange={e => setForm('categoria_id', e.target.value)}
                    className="w-full border border-[#e2e8f0] rounded-[10px] px-4 py-3 text-sm outline-none appearance-none bg-white"
                    style={{ color: PRIMARY }}
                  >
                    <option value="">Selecione uma categoria</option>
                    {categorias.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b] pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5 block">Descrição</label>
                <textarea
                  value={formServico.descricao}
                  onChange={e => setForm('descricao', e.target.value)}
                  placeholder="Descreva o serviço, sua experiência, diferenciais..."
                  rows={3}
                  className="w-full border border-[#e2e8f0] rounded-[10px] px-4 py-3 text-sm outline-none resize-none"
                  style={{ color: PRIMARY }}
                  onFocus={e => (e.target.style.borderColor = TEAL)}
                  onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5 block">Modalidade</label>
                  <select
                    value={formServico.tipo}
                    onChange={e => setForm('tipo', e.target.value)}
                    className="w-full border border-[#e2e8f0] rounded-[10px] px-4 py-3 text-sm outline-none bg-white"
                    style={{ color: PRIMARY }}
                  >
                    <option value="orcamento">Sob orçamento</option>
                    <option value="fixo">Preço fixo</option>
                  </select>
                </div>
                {formServico.tipo === 'fixo' && (
                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5 block">Valor (R$)</label>
                    <input
                      type="number"
                      value={formServico.valor_fixo}
                      onChange={e => setForm('valor_fixo', e.target.value)}
                      placeholder="0,00"
                      className="w-full border border-[#e2e8f0] rounded-[10px] px-4 py-3 text-sm outline-none"
                      style={{ color: PRIMARY }}
                      onFocus={e => (e.target.style.borderColor = TEAL)}
                      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                    />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formServico.aceita_orcamento_online}
                  onChange={e => setForm('aceita_orcamento_online', e.target.checked)}
                  className="w-4 h-4"
                  style={{ accentColor: TEAL }}
                />
                <div>
                  <div className="text-sm font-semibold" style={{ color: PRIMARY }}>Aceito orçar sem visita</div>
                  <div className="text-xs text-[#64748b]">Com fotos e detalhes, consigo orçar remotamente</div>
                </div>
              </label>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setModalServico(false); setErroForm(''); }}
                className="flex-1 py-3 border border-[#e2e8f0] rounded-[10px] font-semibold text-sm transition-colors hover:bg-[#f8fafc]"
                style={{ color: '#64748b' }}
              >
                Cancelar
              </button>
              <button
                onClick={criarServico}
                disabled={salvando}
                className="flex-1 py-3 text-white rounded-[10px] font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: TEAL }}
              >
                {salvando ? 'Salvando...' : 'Cadastrar serviço'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
