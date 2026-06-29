import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import {
  Shield, Share2, Heart, ArrowLeft, MessageCircle, ChevronLeft, ChevronRight,
  ClipboardList, ClipboardCheck, Star as StarIcon, X, Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const WHATSAPP_NUMERO = '555591598658';
const TEAL = 'oklch(0.6 0.118 184.704)';
const TEAL_BG = 'oklch(0.94 0.04 184)';
const TEAL_TEXT = 'oklch(0.38 0.1 184)';
const AZUL = '#1f5fae';

const ICON_COLORS = [
  '#FFF3E0','#E8F5E9','#E3F2FD','#F3E5F5','#FFF8E1','#E0F2F1',
  '#FCE4EC','#E8EAF6','#F1F8E9','#FBE9E7',
];

const AVATAR_COLORS = [
  '#0C447C','#26215C','#065f46','#7c2d12','#1e3a5f','#4a1942',
];

// Garantias institucionais (estáticas)
const GARANTIAS = [
  { titulo: 'Conversa registrada', desc: 'Todo o atendimento fica registrado na plataforma.' },
  { titulo: 'Orçamento documentado', desc: 'Orçamento gerado e salvo com todos os detalhes.' },
  { titulo: 'Contrato digital', desc: 'Contrato com validade jurídica e cláusulas de garantia.' },
  { titulo: 'Assinatura eletrônica', desc: 'Ambas as partes assinam digitalmente.' },
  { titulo: 'Histórico protegido', desc: 'Tudo armazenado com segurança e criptografia.' },
];

const SOBRE_CHECKS = [
  'Atendimento responsável',
  'Serviço com garantia',
  'Materiais de qualidade',
  'Orçamento justo e transparente',
];

// ── NÍVEIS (Bronze / Prata / Ouro) ──
// Faixas iguais às do banco (calc_nivel_prestador): OURO>=30, PRATA>=10, senão BRONZE.
const NIVEIS: Record<string, any> = {
  BRONZE: {
    label: 'BRONZE', titulo: 'Nível Bronze', sub: 'Em crescimento',
    grad: 'linear-gradient(135deg,#cd7f32,#9c5a23)', border: '#cd7f32', soft: '#cd7f3222', text: '#a05a2c',
  },
  PRATA: {
    label: 'PRATA', titulo: 'Nível Prata', sub: 'Profissional em destaque',
    grad: 'linear-gradient(135deg,#c4c8d0,#8b9099)', border: '#9aa0aa', soft: '#9aa0aa22', text: '#5b6470',
  },
  OURO: {
    label: 'OURO', titulo: 'Nível Ouro', sub: 'Referência na plataforma',
    grad: 'linear-gradient(135deg,#f3cd54,#d4a017)', border: '#e0b400', soft: '#e0b40022', text: '#b8860b',
  },
};
function getNivel(qtd: number): string {
  return qtd >= 30 ? 'OURO' : qtd >= 10 ? 'PRATA' : 'BRONZE';
}

function StarsFilled({ nota, size = 13 }: { nota: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24"
          fill={n <= nota ? '#f59e0b' : '#e2e8f0'} stroke="none">
          <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
        </svg>
      ))}
    </span>
  );
}

// Ícone WhatsApp (glifo)
function WhatsIcon({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.477-.917zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  );
}

export function ProviderProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [prestador, setPrestador] = useState<any>(null);
  const [servicos, setServicos]   = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [servicosFeitos, setServicosFeitos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [favorito, setFavorito] = useState(false);
  const [fotoIdx, setFotoIdx] = useState<number | null>(null);
  const [garantiaAberta, setGarantiaAberta] = useState<number | null>(null);
  const [avPag, setAvPag] = useState(0);

  const voltar = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const compartilhar = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: prestador?.nome, url }); return; } catch {} }
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  };

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id!);
      const q = supabase.from('prestadores').select('*');
      const { data: p } = isUuid ? await q.eq('id', id).single() : await q.eq('slug', id).single();
      if (!p) { setLoading(false); return; }

      const [pcsRes, svsRes, avsRes, orcsRes] = await Promise.all([
        supabase.from('prestador_categorias').select('categorias(id,nome,icone)').eq('prestador_id', p.id),
        supabase.from('servicos').select('*,categorias(nome,icone)').eq('prestador_id', p.id).eq('ativo', true).order('criado_em', { ascending: false }),
        supabase.from('avaliacoes').select('*').eq('avaliado_id', p.id).order('criado_em', { ascending: false }).limit(10),
        supabase.from('orcs').select('id', { count: 'exact', head: true }).eq('prestador_id', p.id).eq('status', 'SERVIÇO CONCLUÍDO'),
      ]);

      setPrestador({ ...p, _cats: pcsRes.data?.map((r: any) => r.categorias).filter(Boolean) || [] });
      setServicos(svsRes.data || []);
      setAvaliacoes(avsRes.data || []);
      setServicosFeitos(orcsRes.count || 0);
    } catch {}
    setLoading(false);
  }

  // ── Lightbox: teclado ──
  useEffect(() => {
    if (fotoIdx === null) return;
    const fotos: string[] = Array.isArray(prestador?.fotos_urls) ? prestador.fotos_urls : [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFotoIdx(null);
      else if (e.key === 'ArrowLeft') setFotoIdx(i => i === null ? i : (i - 1 + fotos.length) % fotos.length);
      else if (e.key === 'ArrowRight') setFotoIdx(i => i === null ? i : (i + 1) % fotos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fotoIdx, prestador]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f4f0' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor:'#030213', borderTopColor:'transparent' }}/>
    </div>
  );

  if (!prestador) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f4f0' }}>
      <div className="text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h2 className="font-bold text-[#030213] mb-2">Perfil não encontrado</h2>
        <Link to="/" className="text-sm text-[#717182] hover:underline">← Voltar ao início</Link>
      </div>
    </div>
  );

  const cats     = prestador._cats || [];
  const avgLista = avaliacoes.length ? avaliacoes.reduce((a: number, x: any) => a + (Number(x.nota) || 0), 0) / avaliacoes.length : 0;
  const notaNum  = Number(prestador.nota_media || 0) || avgLista;
  const notaStr  = notaNum > 0 ? notaNum.toFixed(1).replace('.', ',') : null;
  const totalAv  = prestador.total_avaliacoes || avaliacoes.length || 0;
  const iniciais = (prestador.nome || '?').split(' ').map((x: string) => x[0]).slice(0,2).join('').toUpperCase();
  const profissao = cats.map((c: any) => c.nome).join(' · ') || null;
  const cidadeStr = prestador.cidade ? `${prestador.cidade}${prestador.estado ? ', ' + prestador.estado : ''}` : null;
  const anoDesde  = prestador.criado_em ? new Date(prestador.criado_em).getFullYear() : null;
  const fotos: string[] = Array.isArray(prestador.fotos_urls) ? prestador.fotos_urls : [];

  // Nível: usa a coluna do banco se existir, senão deriva da contagem de serviços concluídos
  const nivelKey = (prestador.nivel && NIVEIS[prestador.nivel]) ? prestador.nivel : getNivel(servicosFeitos);
  const nv = NIVEIS[nivelKey];
  // Contorno colorido nos cards do perfil (ênfase no nível)
  const secStyle = { border: `1.5px solid ${nv.border}`, boxShadow: `0 6px 22px -14px ${nv.border}` };

  // ── Helpers de link por serviço ──
  const waLink = (s: any) => `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
    '#SERVICO:' + s.id +
    '|#PRESTADOR:' + (prestador.id || '') +
    '|#CAT:' + (s.categorias?.nome || '') +
    '\n\nOlá! 👋 Vim pelo site do *Serviço Seguro* e tenho interesse em:\n\n🔧 ' + s.titulo +
    '\n📂 Categoria: ' + (s.categorias?.nome || '') +
    '\n\nPode me ajudar com um orçamento?'
  )}`;
  const chatLink = (s: any) =>
    `/orcamento?servico=${s.id}&nome=${encodeURIComponent(s.titulo)}&cat=${encodeURIComponent(s.categorias?.nome || '')}&prestador=${prestador.id || ''}`;

  const precoStr = (s: any) => s.tipo === 'fixo' && s.valor_fixo
    ? `R$ ${Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
    : 'Sob orçamento';

  // ── Indicador "Solicitar orçamento" (NÃO clicável) ──
  const IndicadorOrcamento = ({ compact = false }: { compact?: boolean }) => (
    <div className={`inline-flex items-center gap-2.5 ${compact ? '' : 'flex-col'}`}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: AZUL, boxShadow: '0 6px 16px -6px rgba(31,95,174,0.6)' }}>
        <WhatsIcon size={20}/>
      </div>
      <div className={`text-[12px] leading-tight ${compact ? 'text-left' : 'text-center'}`} style={{ color: '#64748b' }}>
        Solicitar orçamento<br/>via WhatsApp ou Chat
      </div>
    </div>
  );

  // ── Botões de ação por serviço ──
  const AcoesServico = ({ s, compact = false }: { s: any; compact?: boolean }) => (
    <div className="flex items-center gap-2 flex-shrink-0">
      <a href={waLink(s)} target="_blank" rel="noopener noreferrer"
        title="Orçamento via WhatsApp"
        className={`flex items-center justify-center gap-1.5 rounded-[10px] font-semibold text-white hover:opacity-90 transition-opacity ${compact ? 'w-9 h-9' : 'px-3 h-9 text-[12.5px]'}`}
        style={{ background: '#25D366' }}>
        <WhatsIcon size={15}/>{!compact && <span>WhatsApp</span>}
      </a>
      <a href={chatLink(s)} title="Orçamento via Chat"
        className={`flex items-center justify-center gap-1.5 rounded-[10px] font-semibold hover:opacity-90 transition-opacity ${compact ? 'w-9 h-9' : 'px-3 h-9 text-[12.5px]'}`}
        style={{ background: '#030213', color: '#fff' }}>
        <MessageCircle size={15}/>{!compact && <span>Chat</span>}
      </a>
    </div>
  );

  // ── Badge de nível (escudo + ★) ──
  const NivelBadge = ({ size = 'md' }: { size?: 'md' | 'sm' }) => {
    const big = size === 'md';
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full text-white font-extrabold tracking-wide ${big ? 'pl-1.5 pr-3.5 py-1 text-[13px]' : 'pl-1 pr-2.5 py-0.5 text-[11px]'}`}
        style={{ background: nv.grad, boxShadow: `0 4px 14px -4px ${nv.border}` }}>
        <span className={`rounded-full flex items-center justify-center ${big ? 'w-6 h-6' : 'w-5 h-5'}`}
          style={{ background: 'rgba(255,255,255,0.28)' }}>
          <StarIcon className={big ? 'h-3.5 w-3.5' : 'h-3 w-3'} fill="#fff" stroke="#fff"/>
        </span>
        {nv.label}
      </div>
    );
  };

  // ── Texto "Nível X / subtítulo" + info ──
  const NivelTag = ({ align = 'right' }: { align?: 'right' | 'left' }) => (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <div className="flex items-center gap-1 justify-end" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <span className="text-[13px] font-extrabold" style={{ color: nv.text }}>{nv.titulo}</span>
        <Info className="h-3.5 w-3.5" style={{ color: '#94a3b8' }}/>
      </div>
      <div className="text-[12px] text-[#64748b] leading-tight">{nv.sub}</div>
    </div>
  );

  // ── DESKTOP ───────────────────────────────────────────────────
  const Desktop = () => (
    <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", background: '#f5f4f0', minHeight: '100vh' }}>

      {/* NAV */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-8 py-3.5"
        style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-4">
          <button onClick={voltar}
            className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors hover:bg-[#f8fafc]"
            style={{ borderColor: 'rgba(0,0,0,0.13)' }} title="Voltar">
            <ArrowLeft className="h-4 w-4 text-[#030213]"/>
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-escudo.png" alt="Serviço Seguro" style={{ height: 26 }}/>
            <span className="font-bold text-[14px] text-[#030213]">Serviço Seguro</span>
          </Link>
        </div>
        <div className="flex items-center gap-2 relative">
          <button onClick={compartilhar}
            className="flex items-center gap-2 px-3.5 h-9 rounded-full border text-[13px] font-semibold text-[#030213] transition-colors hover:bg-[#f8fafc]"
            style={{ borderColor: 'rgba(0,0,0,0.13)' }}>
            <Share2 className="h-4 w-4"/> Compartilhar
          </button>
          <button onClick={() => setFavorito(v => !v)}
            className="flex items-center gap-2 px-3.5 h-9 rounded-full border text-[13px] font-semibold transition-colors hover:bg-[#f8fafc]"
            style={{ borderColor: 'rgba(0,0,0,0.13)', color: favorito ? '#e11d48' : '#030213' }}>
            <Heart className="h-4 w-4" fill={favorito ? '#e11d48' : 'none'}/> Favoritar
          </button>
          {linkCopiado && (
            <div className="absolute top-11 right-0 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-white shadow-lg whitespace-nowrap z-10"
              style={{ background: '#030213' }}>Link copiado!</div>
          )}
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-5">

        {/* HEADER CARD */}
        <div className="bg-white rounded-[18px] p-6" style={secStyle}>
          {/* Faixa de nível */}
          <div className="flex items-center justify-between mb-5">
            <NivelBadge/>
            <NivelTag/>
          </div>
          <div className="flex gap-7">
            {/* Foto grande */}
            <div className="relative flex-shrink-0 rounded-[16px] overflow-hidden" style={{ width: 230, height: 260 }}>
              {prestador.foto_url
                ? <img src={prestador.foto_url} alt={prestador.nome} className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-white font-extrabold text-5xl" style={{ background: '#030213' }}>{iniciais}</div>}
              {prestador.verificado && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px]"
                  style={{ background: 'rgba(3,2,19,0.78)', backdropFilter: 'blur(4px)' }}>
                  <Shield className="h-3.5 w-3.5 text-white" fill="rgba(255,255,255,0.18)"/>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wide leading-tight">Verificado pela<br/>plataforma</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col">
              <h1 className="text-[28px] font-extrabold text-[#030213] leading-tight">{prestador.nome}</h1>
              {profissao && <p className="text-[15px] font-semibold mb-2" style={{ color: AZUL }}>{profissao}</p>}
              {notaStr && (
                <div className="flex items-center gap-2 mb-3">
                  <StarsFilled nota={Math.round(notaNum)} size={16}/>
                  <strong className="text-[16px] text-[#030213]">{notaStr}</strong>
                  <span className="text-[13px] text-[#64748b]">({totalAv} avaliações)</span>
                </div>
              )}
              {prestador.bio && <p className="text-[14px] text-[#4b5563] leading-[1.65] max-w-xl">{prestador.bio}</p>}
            </div>

            {/* Indicador orçamento (não clicável) */}
            <div className="flex-shrink-0 flex flex-col items-center justify-start pt-1">
              <IndicadorOrcamento/>
            </div>
          </div>

          {/* Stats — 3 boxes */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { label: 'Na plataforma desde', valor: anoDesde || '—' },
              { label: 'Serviços finalizados', valor: servicosFeitos },
              { label: 'Avaliações recebidas', valor: totalAv },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 rounded-[12px]" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: '#f1f5f9' }}>
                  {i === 0 ? <ClipboardList className="h-4 w-4" style={{ color: AZUL }}/>
                    : i === 1 ? <ClipboardCheck className="h-4 w-4" style={{ color: '#16a34a' }}/>
                    : <StarIcon className="h-4 w-4" style={{ color: '#f59e0b' }} fill="#f59e0b"/>}
                </div>
                <div>
                  <div className="text-[11.5px] text-[#64748b] leading-tight">{b.label}</div>
                  <div className="text-[18px] font-extrabold text-[#030213] leading-tight">{b.valor}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TRABALHOS REALIZADOS */}
        {fotos.length > 0 && (
          <div className="bg-white rounded-[18px] p-6" style={secStyle}>
            <p className="text-[15px] font-extrabold text-[#030213] mb-4">Trabalhos realizados</p>
            <div className="grid grid-cols-4 gap-3">
              {fotos.slice(0, 8).map((url, i) => (
                <button key={i} onClick={() => setFotoIdx(i)}
                  className="relative rounded-[12px] overflow-hidden bg-[#f1f5f9] group" style={{ aspectRatio: '1/1' }}>
                  <img src={url} alt={`Trabalho ${i+1}`} loading="lazy"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"/>
                  <div className="absolute inset-0 transition-colors group-hover:bg-black/10"/>
                </button>
              ))}
            </div>
            {fotos.length > 8 && (
              <div className="flex justify-center mt-4">
                <button onClick={() => setFotoIdx(0)}
                  className="px-5 h-9 rounded-[10px] text-[13px] font-semibold border hover:bg-[#f8fafc]"
                  style={{ borderColor: 'rgba(0,0,0,0.13)', color: AZUL }}>Ver mais trabalhos</button>
              </div>
            )}
          </div>
        )}

        {/* 3 COLUNAS: Serviços | Sobre | Garantias */}
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.1fr 1fr 1fr' }}>

          {/* SERVIÇOS */}
          <div className="bg-white rounded-[18px] p-5" style={secStyle}>
            <p className="text-[15px] font-extrabold text-[#030213] mb-4">Serviços que ofereço</p>
            {servicos.length > 0 ? (
              <div className="space-y-2.5">
                {servicos.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-[12px]" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: ICON_COLORS[i % ICON_COLORS.length] }}>{s.categorias?.icone || '🔧'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-[#030213] leading-tight truncate">{s.titulo}</div>
                      <div className="text-[12px] font-bold mt-0.5" style={{ color: s.tipo === 'fixo' ? TEAL_TEXT : '#94a3b8' }}>{precoStr(s)}</div>
                    </div>
                    <AcoesServico s={s} compact/>
                  </div>
                ))}
              </div>
            ) : <p className="text-[13px] text-[#94a3b8]">Nenhum serviço cadastrado ainda.</p>}
          </div>

          {/* SOBRE MIM */}
          <div className="bg-white rounded-[18px] p-5" style={secStyle}>
            <p className="text-[15px] font-extrabold text-[#030213] mb-3">Sobre mim</p>
            {prestador.bio
              ? <p className="text-[13.5px] text-[#4b5563] leading-[1.7] mb-4">{prestador.bio}</p>
              : <p className="text-[13px] text-[#94a3b8] mb-4">Profissional cadastrado no Serviço Seguro.</p>}
            <div className="pt-4 space-y-2.5" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              {SOBRE_CHECKS.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5" className="flex-shrink-0"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>
                  <span className="text-[13px] text-[#374151]">{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GARANTIAS */}
          <div className="bg-white rounded-[18px] p-5" style={secStyle}>
            <p className="text-[15px] font-extrabold text-[#030213] mb-4 leading-tight">Garantias da contratação<br/>pelo Serviço Seguro</p>
            <div className="space-y-3.5">
              {GARANTIAS.map((g, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ background: TEAL_BG }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEAL_TEXT} strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[#030213] leading-tight">{g.titulo}</div>
                    <div className="text-[11.5px] text-[#64748b] leading-snug mt-0.5">{g.desc}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                <Shield className="h-4 w-4 flex-shrink-0" style={{ color: TEAL_TEXT }}/>
                <span className="text-[12px] font-semibold text-[#030213]">Segurança para cliente e prestador.</span>
              </div>
            </div>
          </div>
        </div>

        {/* AVALIAÇÕES */}
        <div className="bg-white rounded-[18px] p-6" style={secStyle}>
          <p className="text-[15px] font-extrabold text-[#030213] mb-4">Avaliações de clientes</p>
          {avaliacoes.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                {avaliacoes.slice(avPag * 3, avPag * 3 + 3).map((av: any, i: number) => {
                  const nomeReal = (av.avaliador && !['cliente','prestador'].includes(av.avaliador.toLowerCase())) ? av.avaliador : 'Cliente';
                  const ini = nomeReal.split(' ').map((x: string) => x[0]).slice(0,2).join('').toUpperCase();
                  return (
                    <div key={i} className="rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)', background: '#fafafa' }}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: AVATAR_COLORS[(avPag * 3 + i) % AVATAR_COLORS.length] }}>{ini}</div>
                        <div>
                          <div className="text-[13px] font-bold text-[#030213]">{nomeReal}</div>
                          <StarsFilled nota={av.nota} size={12}/>
                        </div>
                      </div>
                      {av.comentario && <p className="text-[13px] text-[#374151] leading-relaxed mb-2">{av.comentario}</p>}
                      <p className="text-[11px] text-[#94a3b8]">{new Date(av.criado_em).toLocaleDateString('pt-BR')}</p>
                    </div>
                  );
                })}
              </div>
              {avaliacoes.length > 3 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  {Array.from({ length: Math.ceil(avaliacoes.length / 3) }).map((_, p) => (
                    <button key={p} onClick={() => setAvPag(p)}
                      className="rounded-full transition-all"
                      style={{ width: p === avPag ? 22 : 8, height: 8, background: p === avPag ? AZUL : '#cbd5e1' }}/>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">⭐</div>
              <p className="text-[13px] text-[#94a3b8]">Nenhuma avaliação recebida ainda.</p>
            </div>
          )}
        </div>

        {/* BANNER INFERIOR (institucional, não clicável) */}
        <div className="rounded-[18px] px-7 py-5 flex items-center justify-between gap-4" style={{ background: '#0d1b3e' }}>
          <div className="flex items-center gap-4">
            <Shield className="h-9 w-9 flex-shrink-0" style={{ color: '#f59e0b' }} fill="rgba(245,158,11,0.18)"/>
            <div>
              <div className="text-white font-bold text-[16px]">Contrate com segurança e tranquilidade</div>
              <div className="text-white/70 text-[13px] mt-0.5">Todo o processo é documentado e protegido pela plataforma para garantir segurança para você e para o profissional.</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: AZUL }}><WhatsIcon size={18}/></div>
            <div className="text-white text-[13px] font-semibold leading-tight">Solicitar orçamento<br/>via WhatsApp ou Chat</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── MOBILE ────────────────────────────────────────────────────
  const Mobile = () => (
    <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", background: '#f5f4f0', minHeight: '100vh' }}>

      {/* NAV */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <button onClick={voltar} className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center" title="Voltar">
          <ArrowLeft className="h-5 w-5 text-[#030213]"/>
        </button>
        <Link to="/" className="flex items-center gap-1.5">
          <img src="/logo-escudo.png" alt="Serviço Seguro" style={{ height: 22 }}/>
          <span className="font-bold text-[13px] text-[#030213]">Serviço Seguro</span>
        </Link>
        <div className="flex items-center gap-1 relative">
          <button onClick={compartilhar} className="w-9 h-9 rounded-full flex items-center justify-center">
            <Share2 className="h-4 w-4 text-[#030213]"/>
          </button>
          <button onClick={() => setFavorito(v => !v)} className="w-9 h-9 rounded-full flex items-center justify-center">
            <Heart className="h-4 w-4" style={{ color: favorito ? '#e11d48' : '#030213' }} fill={favorito ? '#e11d48' : 'none'}/>
          </button>
          {linkCopiado && (
            <div className="absolute top-10 right-0 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-white shadow-lg whitespace-nowrap z-10"
              style={{ background: '#030213' }}>Link copiado!</div>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">

        {/* FOTO GRANDE */}
        <div className="relative w-full rounded-[16px] overflow-hidden bg-[#030213]" style={{ border: `1.5px solid ${nv.border}`, height: 260 }}>
          {prestador.foto_url
            ? <img src={prestador.foto_url} alt={prestador.nome} className="w-full h-full object-cover"/>
            : <div className="w-full h-full flex items-center justify-center text-white font-extrabold text-5xl">{iniciais}</div>}
          {/* Badge de nível — topo direito sobre a foto */}
          <div className="absolute top-3 right-3"><NivelBadge/></div>
          {prestador.verificado && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px]"
              style={{ background: 'rgba(3,2,19,0.78)', backdropFilter: 'blur(4px)' }}>
              <Shield className="h-3.5 w-3.5 text-white" fill="rgba(255,255,255,0.18)"/>
              <span className="text-[10px] font-bold text-white uppercase tracking-wide leading-tight">Verificado pela<br/>plataforma</span>
            </div>
          )}
        </div>

        {/* HEADER INFO */}
        <div className="bg-white rounded-[16px] p-4" style={secStyle}>
          {/* Dizeres do nível */}
          <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: `1px solid ${nv.soft}` }}>
            <span className="text-[13px] font-extrabold" style={{ color: nv.text }}>{nv.titulo}</span>
            <span className="flex items-center gap-1 text-[12px] text-[#64748b]">{nv.sub}<Info className="h-3.5 w-3.5" style={{ color: '#94a3b8' }}/></span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[21px] font-extrabold text-[#030213] leading-tight">{prestador.nome}</h1>
              {profissao && <p className="text-[14px] font-semibold" style={{ color: AZUL }}>{profissao}</p>}
            </div>
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: AZUL, boxShadow: '0 6px 16px -6px rgba(31,95,174,0.6)' }}>
              <WhatsIcon size={19}/>
            </div>
          </div>
          {notaStr && (
            <div className="flex items-center gap-2 mt-2">
              <StarsFilled nota={Math.round(notaNum)} size={15}/>
              <strong className="text-[15px] text-[#030213]">{notaStr}</strong>
              <span className="text-[12px] text-[#64748b]">({totalAv} avaliações)</span>
            </div>
          )}

          {/* Stats em lista */}
          <div className="mt-3 pt-3 space-y-2.5" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            {[
              { Icon: ClipboardList, color: AZUL, label: 'Na plataforma desde', valor: anoDesde || '—' },
              { Icon: ClipboardCheck, color: '#16a34a', label: 'Serviços finalizados', valor: servicosFeitos },
              { Icon: StarIcon, color: '#f59e0b', label: 'Avaliações recebidas', valor: totalAv },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <b.Icon className="h-4 w-4 flex-shrink-0" style={{ color: b.color }} fill={i === 2 ? '#f59e0b' : 'none'}/>
                <span className="text-[13px] text-[#374151] flex-1">{b.label}</span>
                <strong className="text-[14px] text-[#030213]">{b.valor}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* SOBRE */}
        {prestador.bio && (
          <div className="bg-white rounded-[16px] p-4" style={secStyle}>
            <p className="text-[15px] font-extrabold text-[#030213] mb-2">Sobre mim</p>
            <p className="text-[13.5px] text-[#4b5563] leading-relaxed">{prestador.bio}</p>
          </div>
        )}

        {/* TRABALHOS — scroll horizontal */}
        {fotos.length > 0 && (
          <div className="bg-white rounded-[16px] p-4" style={secStyle}>
            <p className="text-[15px] font-extrabold text-[#030213] mb-3">Trabalhos realizados</p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {fotos.map((url, i) => (
                <button key={i} onClick={() => setFotoIdx(i)}
                  className="flex-shrink-0 rounded-[12px] overflow-hidden bg-[#f1f5f9]" style={{ width: 130, height: 130 }}>
                  <img src={url} alt={`Trabalho ${i+1}`} loading="lazy" className="w-full h-full object-cover"/>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SERVIÇOS */}
        {servicos.length > 0 && (
          <div className="bg-white rounded-[16px] p-4" style={secStyle}>
            <p className="text-[15px] font-extrabold text-[#030213] mb-3">Serviços que ofereço</p>
            <div className="space-y-2.5">
              {servicos.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2.5 py-2 border-b last:border-b-0" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: ICON_COLORS[i % ICON_COLORS.length] }}>{s.categorias?.icone || '🔧'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] text-[#030213] leading-tight">{s.titulo}</div>
                    <div className="text-[12px] font-bold mt-0.5" style={{ color: s.tipo === 'fixo' ? TEAL_TEXT : '#94a3b8' }}>{precoStr(s)}</div>
                  </div>
                  <AcoesServico s={s} compact/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GARANTIAS — acordeão */}
        <div className="bg-white rounded-[16px] p-4" style={secStyle}>
          <p className="text-[15px] font-extrabold text-[#030213] mb-3 leading-tight">Garantias da contratação<br/>pelo Serviço Seguro</p>
          <div className="space-y-1">
            {GARANTIAS.map((g, i) => {
              const aberta = garantiaAberta === i;
              return (
                <div key={i} className="border-b last:border-b-0" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <button onClick={() => setGarantiaAberta(aberta ? null : i)}
                    className="w-full flex items-center gap-2.5 py-3 text-left">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEAL_TEXT} strokeWidth="2" className="flex-shrink-0"><path d="M20 6L9 17l-5-5"/></svg>
                    <span className="text-[13.5px] font-semibold text-[#030213] flex-1">{g.titulo}</span>
                    <ChevronRight className="h-4 w-4 text-[#94a3b8] transition-transform flex-shrink-0" style={{ transform: aberta ? 'rotate(90deg)' : 'none' }}/>
                  </button>
                  {aberta && <p className="text-[12.5px] text-[#64748b] leading-snug pb-3 pl-[26px]">{g.desc}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* AVALIAÇÕES — scroll horizontal */}
        <div className="bg-white rounded-[16px] p-4" style={secStyle}>
          <p className="text-[15px] font-extrabold text-[#030213] mb-3">Avaliações de clientes</p>
          {avaliacoes.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {avaliacoes.map((av: any, i: number) => {
                const nomeReal = (av.avaliador && !['cliente','prestador'].includes(av.avaliador.toLowerCase())) ? av.avaliador : 'Cliente';
                const ini = nomeReal.split(' ').map((x: string) => x[0]).slice(0,2).join('').toUpperCase();
                return (
                  <div key={i} className="flex-shrink-0 rounded-[14px] p-3.5" style={{ width: 250, border: '1px solid rgba(0,0,0,0.07)', background: '#fafafa' }}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{ini}</div>
                      <div>
                        <div className="text-[13px] font-bold text-[#030213]">{nomeReal}</div>
                        <StarsFilled nota={av.nota} size={11}/>
                      </div>
                    </div>
                    {av.comentario && <p className="text-[12.5px] text-[#374151] leading-relaxed mb-1.5">{av.comentario}</p>}
                    <p className="text-[10.5px] text-[#94a3b8]">{new Date(av.criado_em).toLocaleDateString('pt-BR')}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-2xl mb-1.5">⭐</div>
              <p className="text-[12.5px] text-[#94a3b8]">Nenhuma avaliação ainda.</p>
            </div>
          )}
        </div>

        {/* BANNER INFERIOR (não clicável) */}
        <div className="rounded-[16px] p-4" style={{ background: '#0d1b3e' }}>
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-7 w-7 flex-shrink-0" style={{ color: '#f59e0b' }} fill="rgba(245,158,11,0.18)"/>
            <div className="text-white font-bold text-[14px] leading-tight">Contrate com segurança e tranquilidade</div>
          </div>
          <p className="text-white/70 text-[12px] leading-snug mb-3">Todo o processo é documentado e protegido pela plataforma.</p>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: AZUL }}><WhatsIcon size={17}/></div>
            <div className="text-white text-[12.5px] font-semibold leading-tight">Solicitar orçamento via WhatsApp ou Chat</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden"><Mobile /></div>
      <div className="hidden lg:block"><Desktop /></div>

      {/* LIGHTBOX de trabalhos */}
      {fotoIdx !== null && fotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(3,2,19,0.92)' }}
          onClick={e => { if (e.target === e.currentTarget) setFotoIdx(null); }}>

          <button onClick={() => setFotoIdx(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ background: 'rgba(255,255,255,0.12)' }}>
            <X className="h-5 w-5"/>
          </button>

          {fotos.length > 1 && (
            <button onClick={() => setFotoIdx(i => i === null ? i : (i - 1 + fotos.length) % fotos.length)}
              className="absolute left-3 sm:left-6 w-11 h-11 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <ChevronLeft className="h-6 w-6"/>
            </button>
          )}

          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3">
            <img src={fotos[fotoIdx]} alt={`Trabalho ${fotoIdx + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-[12px]"/>
            {fotos.length > 1 && (
              <span className="text-white/70 text-[13px] font-semibold">{fotoIdx + 1} / {fotos.length}</span>
            )}
          </div>

          {fotos.length > 1 && (
            <button onClick={() => setFotoIdx(i => i === null ? i : (i + 1) % fotos.length)}
              className="absolute right-3 sm:right-6 w-11 h-11 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <ChevronRight className="h-6 w-6"/>
            </button>
          )}
        </div>
      )}
    </>
  );
}
