import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { Shield, Star, Share2, Calendar, Briefcase, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TEAL = 'oklch(0.6 0.118 184.704)';
const TEAL_BG = 'oklch(0.94 0.04 184)';
const TEAL_TEXT = 'oklch(0.38 0.1 184)';

const ICON_COLORS = [
  { bg: '#FFF3E0' }, { bg: '#E8F5E9' }, { bg: '#E3F2FD' },
  { bg: '#F3E5F5' }, { bg: '#FFF8E1' }, { bg: '#E0F2F1' },
];

function StarRow({ nota, size = 14 }: { nota: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24"
          fill={n <= nota ? '#f59e0b' : '#e2e8f0'} stroke="none">
          <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" />
        </svg>
      ))}
    </span>
  );
}

export function ProviderProfile() {
  const { id } = useParams<{ id: string }>();
  const [prestador, setPrestador] = useState<any>(null);
  const [servicos, setServicos] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [servicosFeitos, setServicosFeitos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const compartilhar = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: prestador?.nome, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  };

  useEffect(() => { if (id) carregarPerfil(); }, [id]);

  async function carregarPerfil() {
    setLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id!);
      const query = supabase.from('prestadores').select('*');
      const { data: p } = isUuid ? await query.eq('id', id).single() : await query.eq('slug', id).single();

      if (!p) { setLoading(false); return; }
      setPrestador(p);

      const [pcsRes, svsRes, avsRes, orcsRes] = await Promise.all([
        supabase.from('prestador_categorias').select('categorias(id, nome, icone)').eq('prestador_id', p.id),
        supabase.from('servicos').select('*, categorias(nome, icone)').eq('prestador_id', p.id).eq('ativo', true).order('criado_em', { ascending: false }),
        supabase.from('avaliacoes').select('nota, comentario, criado_em, avaliador, servico_nome').eq('avaliado_id', p.id).eq('avaliado_tipo', 'prestador').order('criado_em', { ascending: false }).limit(10),
        supabase.from('orcs').select('id', { count: 'exact', head: true }).eq('prestador_id', p.id).eq('status', 'SERVIÇO CONCLUÍDO'),
      ]);

      setPrestador((prev: any) => ({
        ...prev,
        _categorias: pcsRes.data?.map((r: any) => r.categorias).filter(Boolean) || []
      }));
      setServicos(svsRes.data || []);
      setAvaliacoes(avsRes.data || []);
      setServicosFeitos(orcsRes.count || 0);
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f1f0ee' }}>
        <div className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: '#030213', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!prestador) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f1f0ee' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="font-bold text-[#030213] mb-2">Perfil não encontrado</h2>
          <Link to="/" className="text-sm text-[#717182] hover:underline">← Voltar ao início</Link>
        </div>
      </div>
    );
  }

  const categorias = prestador._categorias || [];
  const notaNum = Number(prestador.nota_media || 0);
  const notaStr = notaNum > 0 ? notaNum.toFixed(1) : null;
  const totalAv = prestador.total_avaliacoes || avaliacoes.length || 0;
  const iniciais = (prestador.nome || '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
  const tagline = prestador.bio_curta || (prestador.bio ? prestador.bio.slice(0, 90) + (prestador.bio.length > 90 ? '…' : '') : null);
  const profissao = categorias.map((c: any) => c.nome).join(' · ') || null;
  const dataCadastro = prestador.criado_em
    ? new Date(prestador.criado_em).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

  // Stats em linha para o hero card (desktop e mobile abaixo do nome)
  const StatsInline = () => (
    <div className="flex items-center gap-3 flex-wrap">
      {notaStr && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" /></svg>
          <span className="text-[13px] font-extrabold text-[#92400e]">{notaStr}</span>
          {totalAv > 0 && <span className="text-[11.5px] text-[#b45309]">({totalAv})</span>}
        </div>
      )}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{ background: 'oklch(0.95 0.03 184)', border: '1px solid oklch(0.85 0.06 184)' }}>
        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: TEAL_TEXT }} />
        <span className="text-[13px] font-extrabold" style={{ color: TEAL_TEXT }}>{servicosFeitos}</span>
        <span className="text-[11.5px]" style={{ color: TEAL_TEXT }}>concluídos</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{ background: '#f0f0ff', border: '1px solid #c7c7f9' }}>
        <Briefcase className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#4338ca' }} />
        <span className="text-[13px] font-extrabold" style={{ color: '#3730a3' }}>{servicos.length}</span>
        <span className="text-[11.5px]" style={{ color: '#4338ca' }}>oferecidos</span>
      </div>
      {dataCadastro && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-[#94a3b8]" />
          <span className="text-[11.5px] text-[#64748b]">Desde {dataCadastro}</span>
        </div>
      )}
    </div>
  );

  // Bloco de KPI cards para sidebar/card de informações
  const StatsGrid = () => (
    <div className="grid grid-cols-2 gap-2">
      {notaStr && (
        <div className="rounded-[14px] p-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div className="flex items-center gap-1 mb-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" /></svg>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#b45309]">Avaliação</span>
          </div>
          <div className="text-[22px] font-extrabold text-[#92400e] leading-none">{notaStr}</div>
          <div className="text-[10.5px] text-[#b45309] mt-0.5">{totalAv} avaliações</div>
        </div>
      )}
      <div className="rounded-[14px] p-3" style={{ background: 'oklch(0.95 0.03 184)', border: '1px solid oklch(0.85 0.06 184)' }}>
        <div className="flex items-center gap-1 mb-1">
          <CheckCircle className="h-3 w-3" style={{ color: TEAL_TEXT }} />
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: TEAL_TEXT }}>Concluídos</span>
        </div>
        <div className="text-[22px] font-extrabold leading-none" style={{ color: TEAL_TEXT }}>{servicosFeitos}</div>
        <div className="text-[10.5px] mt-0.5" style={{ color: TEAL_TEXT }}>serviços feitos</div>
      </div>
      <div className="rounded-[14px] p-3" style={{ background: '#f0f0ff', border: '1px solid #c7c7f9' }}>
        <div className="flex items-center gap-1 mb-1">
          <Briefcase className="h-3 w-3" style={{ color: '#4338ca' }} />
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#4338ca' }}>Oferecidos</span>
        </div>
        <div className="text-[22px] font-extrabold text-[#3730a3] leading-none">{servicos.length}</div>
        <div className="text-[10.5px] text-[#4338ca] mt-0.5">serviços disponíveis</div>
      </div>
      {dataCadastro && (
        <div className="rounded-[14px] p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div className="flex items-center gap-1 mb-1">
            <Calendar className="h-3 w-3 text-[#94a3b8]" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">Membro</span>
          </div>
          <div className="text-[13px] font-extrabold text-[#334155] leading-tight mt-1">{dataCadastro}</div>
        </div>
      )}
    </div>
  );

  // ── MOBILE ────────────────────────────────────────────────────
  const MobileView = () => (
    <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", background: '#f1f0ee', minHeight: '100vh' }}>

      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: '#030213' }}>{iniciais}</div>
          <span className="font-bold text-[14px] text-[#030213] truncate">{prestador.nome}</span>
          {prestador.verificado && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill={TEAL} className="flex-shrink-0">
              <path d="M12 2l2.4 2.1 3.1-.6 1.1 3 2.8 1.4-1 3.1 1 3.1-2.8 1.4-1.1 3-3.1-.6L12 22l-2.4-2.1-3.1.6-1.1-3-2.8-1.4 1-3.1-1-3.1 2.8-1.4 1.1-3 3.1.6z" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.2" fill="none" />
            </svg>
          )}
        </div>
        <div className="relative">
          <button onClick={compartilhar} className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(3,2,19,0.06)' }}>
            <Share2 className="h-4 w-4 text-[#030213]" />
          </button>
          {linkCopiado && (
            <div className="absolute top-11 right-0 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-white shadow-lg whitespace-nowrap"
              style={{ background: '#030213' }}>Link copiado!</div>
          )}
        </div>
      </div>

      {/* Banner */}
      <div className="relative w-full" style={{ height: 200 }}>
        {prestador.banner_url
          ? <img src={prestador.banner_url} alt="Banner" className="w-full h-full object-cover" />
          : <div className="w-full h-full" style={{ background: 'linear-gradient(160deg, #d4d0c8 0%, #e8e5de 60%, #c8c4bc 100%)' }} />
        }
        {tagline && (
          <div className="absolute bottom-3 left-4 right-4 text-[13px] font-semibold text-[#030213]/70 leading-snug">{tagline}</div>
        )}
      </div>

      {/* Profile photo + info */}
      <div className="flex flex-col items-center -mt-14 px-4 pb-5" style={{ background: '#f1f0ee' }}>
        <div className="relative mb-3">
          {prestador.foto_url
            ? <img src={prestador.foto_url} alt={prestador.nome}
                className="w-28 h-28 rounded-full object-cover"
                style={{ border: '4px solid #fff', boxShadow: '0 8px 24px -8px rgba(3,2,19,0.35)' }} />
            : <div className="w-28 h-28 rounded-full flex items-center justify-center text-white font-bold text-3xl"
                style={{ background: '#030213', border: '4px solid #fff', boxShadow: '0 8px 24px -8px rgba(3,2,19,0.35)' }}>
                {iniciais}
              </div>
          }
          {prestador.verificado && (
            <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: TEAL, border: '3px solid #f1f0ee' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        <h1 className="text-[22px] font-extrabold text-[#030213] mb-0.5">{prestador.nome}</h1>
        <p className="text-[13.5px] text-[#717182] text-center mb-3">
          {[profissao, prestador.cidade && `${prestador.cidade}${prestador.estado ? ', ' + prestador.estado : ''}`].filter(Boolean).join(' · ')}
        </p>

        {prestador.verificado && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-3"
            style={{ background: TEAL_BG, border: `1px solid ${TEAL}22` }}>
            <Shield className="h-3.5 w-3.5" style={{ color: TEAL }} />
            <span className="text-[12px] font-semibold" style={{ color: TEAL_TEXT }}>Identidade verificada pelo Serviço Seguro</span>
          </div>
        )}

        {/* Stats resumidos inline */}
        <div className="flex items-center gap-2 text-[12.5px] text-[#717182] flex-wrap justify-center">
          <StatsInline />
        </div>
      </div>

      {/* Sobre */}
      {prestador.bio && (
        <div className="mx-4 mb-3 p-4 rounded-[18px] bg-white">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2">SOBRE</p>
          <p className="text-[14px] text-[#45454f] leading-relaxed">{prestador.bio}</p>
        </div>
      )}

      {/* Info card — detalhado */}
      <div className="mx-4 mb-3 p-4 rounded-[18px] bg-white">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">INFORMAÇÕES</p>
        <StatsGrid />
      </div>

      {/* Serviços */}
      {servicos.length > 0 && (
        <div className="mx-4 mb-3 p-4 rounded-[18px] bg-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8]">SERVIÇOS OFERECIDOS</p>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(3,2,19,0.06)', color: '#717182' }}>{servicos.length}</span>
          </div>
          <div className="space-y-1">
            {servicos.map((s, idx) => {
              const col = ICON_COLORS[idx % ICON_COLORS.length];
              const preco = s.tipo === 'fixo' && s.valor_fixo
                ? `R$ ${Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                : 'Sob orçamento';
              return (
                <div key={s.id} className="flex items-center gap-3 py-3 px-1">
                  <div className="w-10 h-10 rounded-[12px] flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: col.bg }}>
                    {s.categorias?.icone || '🔧'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[14px] text-[#030213] truncate">{s.titulo}</span>
                      {s.aceita_orcamento_online && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: TEAL_BG, color: TEAL_TEXT }}>online</span>
                      )}
                    </div>
                    {Array.isArray(s.tags) && s.tags.length > 0 && (
                      <p className="text-[11.5px] text-[#94a3b8] truncate">{s.tags.join(' · ')}</p>
                    )}
                  </div>
                  <span className="text-[13px] font-bold text-[#030213] flex-shrink-0">{preco}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trabalhos recentes */}
      {Array.isArray(prestador.fotos_urls) && prestador.fotos_urls.length > 0 && (
        <div className="mx-4 mb-3 p-4 rounded-[18px] bg-white">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">TRABALHOS RECENTES</p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {(prestador.fotos_urls as string[]).map((url: string, i: number) => (
              <div key={i} className="flex-shrink-0 w-28 h-28 rounded-[14px] overflow-hidden">
                <img src={url} alt={`Trabalho ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avaliações */}
      {avaliacoes.length > 0 && (
        <div className="mx-4 mb-4 p-4 rounded-[18px] bg-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8]">AVALIAÇÕES</p>
            {notaStr && (
              <span className="flex items-center gap-1 font-bold text-sm text-[#030213]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" /></svg>
                {notaStr} ({totalAv})
              </span>
            )}
          </div>
          <div className="space-y-3">
            {avaliacoes.slice(0, 5).map((av: any, i: number) => {
              const ini = (av.avaliador || 'C').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
              return (
                <div key={i}>
                  {i > 0 && <div className="border-t border-[rgba(0,0,0,0.06)] mb-3" />}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: '#030213' }}>{ini}</div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[#030213]">{av.avaliador || 'Cliente'}</div>
                      <div className="flex items-center gap-2">
                        <StarRow nota={av.nota} size={11} />
                        <span className="text-[11px] text-[#94a3b8]">
                          {av.servico_nome ? `${av.servico_nome} · ` : ''}{new Date(av.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {av.comentario && <p className="text-[13px] text-[#45454f] leading-relaxed">{av.comentario}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[#94a3b8]">
        <Shield className="h-3.5 w-3.5" />
        <span>Perfil oficial no Serviço Seguro</span>
      </div>
    </div>
  );

  // ── DESKTOP ───────────────────────────────────────────────────
  const DesktopView = () => (
    <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", background: '#f1f0ee', minHeight: '100vh' }}>

      {/* Nav */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
        style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo-escudo.png" alt="Serviço Seguro" style={{ height: 28 }} />
          <span className="font-bold text-[15px] text-[#030213]">Serviço Seguro</span>
        </Link>
        <div className="relative">
          <button onClick={compartilhar} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#f1f5f9]"
            style={{ border: '1.5px solid rgba(0,0,0,0.12)' }}>
            <Share2 className="h-4 w-4 text-[#030213]" />
          </button>
          {linkCopiado && (
            <div className="absolute top-12 right-0 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-white shadow-lg whitespace-nowrap"
              style={{ background: '#030213' }}>Link copiado!</div>
          )}
        </div>
      </nav>

      {/* Banner */}
      <div className="relative w-full" style={{ height: 220 }}>
        {prestador.banner_url
          ? <img src={prestador.banner_url} alt="Banner" className="w-full h-full object-cover" />
          : <div className="w-full h-full" style={{ background: 'linear-gradient(160deg, #d4d0c8 0%, #e8e5de 60%, #c8c4bc 100%)' }} />
        }
        {tagline && (
          <div className="absolute bottom-5 left-10 text-[15px] font-semibold text-[#030213]/65 max-w-xl leading-snug">{tagline}</div>
        )}
      </div>

      {/* Profile card */}
      <div className="max-w-[980px] mx-auto px-6">
        <div className="relative -mt-16 mb-6 bg-white rounded-[20px] px-7 py-5"
          style={{ boxShadow: '0 8px 32px -16px rgba(3,2,19,0.15)', border: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="flex items-end gap-5">
            {/* Photo */}
            <div className="relative flex-shrink-0 -mt-10">
              {prestador.foto_url
                ? <img src={prestador.foto_url} alt={prestador.nome}
                    className="w-[112px] h-[112px] rounded-[20px] object-cover"
                    style={{ border: '4px solid #fff', boxShadow: '0 8px 24px -10px rgba(3,2,19,0.4)' }} />
                : <div className="w-[112px] h-[112px] rounded-[20px] flex items-center justify-center text-white font-bold text-4xl"
                    style={{ background: '#030213', border: '4px solid #fff', boxShadow: '0 8px 24px -10px rgba(3,2,19,0.4)' }}>
                    {iniciais}
                  </div>
              }
              {prestador.verificado && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: TEAL, border: '3px solid #fff' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
                <h1 className="text-[24px] font-extrabold text-[#030213]">{prestador.nome}</h1>
                {prestador.verificado && (
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: TEAL_BG, color: TEAL_TEXT }}>
                    <Shield className="h-3 w-3" /> Verificado pelo Serviço Seguro
                  </span>
                )}
              </div>
              <p className="text-[13.5px] text-[#717182] mb-3">
                {[profissao, prestador.cidade && `${prestador.cidade}${prestador.estado ? ', ' + prestador.estado : ''}`].filter(Boolean).join(' · ')}
              </p>
              <StatsInline />
            </div>
          </div>
        </div>

        {/* Body 2-col */}
        <div className="grid grid-cols-[1fr_300px] gap-5 pb-10">

          {/* Left */}
          <div className="space-y-4">

            {/* Sobre */}
            {prestador.bio && (
              <div className="bg-white rounded-[20px] p-6" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2">SOBRE</p>
                <p className="text-[14.5px] text-[#45454f] leading-[1.7]">{prestador.bio}</p>
              </div>
            )}

            {/* Serviços */}
            {servicos.length > 0 && (
              <div className="bg-white rounded-[20px] p-6" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8]">SERVIÇOS OFERECIDOS</p>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(3,2,19,0.06)', color: '#717182' }}>{servicos.length} serviços</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {servicos.map((s, idx) => {
                    const col = ICON_COLORS[idx % ICON_COLORS.length];
                    const preco = s.tipo === 'fixo' && s.valor_fixo
                      ? `R$ ${Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                      : 'Sob orçamento';
                    return (
                      <div key={s.id}
                        className="flex items-center gap-3 p-3 rounded-[14px]"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: col.bg }}>
                          {s.categorias?.icone || '🔧'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13.5px] text-[#030213] leading-tight truncate">{s.titulo}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[12.5px] font-bold" style={{ color: s.tipo === 'fixo' ? TEAL_TEXT : '#717182' }}>{preco}</span>
                            {s.aceita_orcamento_online && (
                              <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: TEAL_BG, color: TEAL_TEXT }}>online</span>
                            )}
                          </div>
                          {Array.isArray(s.tags) && s.tags.length > 0 && (
                            <p className="text-[11px] text-[#94a3b8] truncate mt-0.5">{s.tags.join(' · ')}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trabalhos recentes */}
            {Array.isArray(prestador.fotos_urls) && prestador.fotos_urls.length > 0 && (
              <div className="bg-white rounded-[20px] p-6" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8] mb-4">TRABALHOS RECENTES</p>
                <div className="grid grid-cols-3 gap-2">
                  {(prestador.fotos_urls as string[]).map((url: string, i: number) => (
                    <div key={i} className="rounded-[14px] overflow-hidden" style={{ aspectRatio: '1/1' }}>
                      <img src={url} alt={`Trabalho ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="space-y-4">

            {/* Informações card */}
            <div className="bg-white rounded-[20px] p-5 sticky top-[80px]" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8] mb-4">INFORMAÇÕES</p>
              <StatsGrid />
            </div>

            {/* Avaliações */}
            {avaliacoes.length > 0 && (
              <div className="bg-white rounded-[20px] p-5" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8]">AVALIAÇÕES</p>
                  {notaStr && (
                    <span className="flex items-center gap-1 font-bold text-sm text-[#030213]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" /></svg>
                      {notaStr} · {totalAv}
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                  {avaliacoes.slice(0, 5).map((av: any, i: number) => {
                    const ini = (av.avaliador || 'C').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
                    return (
                      <div key={i}>
                        {i > 0 && <div className="border-t border-[rgba(0,0,0,0.06)] mb-4" />}
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: '#030213' }}>{ini}</div>
                          <div>
                            <div className="text-[13px] font-bold text-[#030213]">{av.avaliador || 'Cliente'}</div>
                            <div className="flex items-center gap-2">
                              <StarRow nota={av.nota} size={11} />
                              <span className="text-[11px] text-[#94a3b8]">
                                {av.servico_nome ? `${av.servico_nome} · ` : ''}{new Date(av.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          </div>
                        </div>
                        {av.comentario && <p className="text-[13px] text-[#45454f] leading-relaxed">{av.comentario}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[#94a3b8]">
          <Shield className="h-3.5 w-3.5" />
          <span>Perfil oficial no Serviço Seguro</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden"><MobileView /></div>
      <div className="hidden lg:block"><DesktopView /></div>
    </>
  );
}
