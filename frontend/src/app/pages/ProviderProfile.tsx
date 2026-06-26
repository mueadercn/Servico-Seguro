import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { Shield, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TEAL = 'oklch(0.6 0.118 184.704)';
const TEAL_BG = 'oklch(0.94 0.04 184)';
const TEAL_TEXT = 'oklch(0.38 0.1 184)';

const ICON_COLORS = [
  '#FFF3E0','#E8F5E9','#E3F2FD','#F3E5F5','#FFF8E1','#E0F2F1',
  '#FCE4EC','#E8EAF6','#F1F8E9','#FBE9E7',
];

// Iniciais coloridas para avaliadores
const AVATAR_COLORS = [
  '#0C447C','#26215C','#065f46','#7c2d12','#1e3a5f','#4a1942',
];

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

export function ProviderProfile() {
  const { id } = useParams<{ id: string }>();
  const [prestador, setPrestador] = useState<any>(null);
  const [servicos, setServicos]   = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [servicosFeitos, setServicosFeitos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [linkCopiado, setLinkCopiado] = useState(false);

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
        supabase.from('avaliacoes').select('nota,comentario,criado_em,avaliador,servico_nome').eq('avaliado_id', p.id).eq('avaliado_tipo', 'prestador').order('criado_em', { ascending: false }).limit(10),
        supabase.from('orcs').select('id', { count: 'exact', head: true }).eq('prestador_id', p.id).eq('status', 'SERVIÇO CONCLUÍDO'),
      ]);

      setPrestador({ ...p, _cats: pcsRes.data?.map((r: any) => r.categorias).filter(Boolean) || [] });
      setServicos(svsRes.data || []);
      setAvaliacoes(avsRes.data || []);
      setServicosFeitos(orcsRes.count || 0);
    } catch {}
    setLoading(false);
  }

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
  const notaNum  = Number(prestador.nota_media || 0);
  const notaStr  = notaNum > 0 ? notaNum.toFixed(1).replace('.', ',') : null;
  const totalAv  = prestador.total_avaliacoes || avaliacoes.length || 0;
  const iniciais = (prestador.nome || '?').split(' ').map((x: string) => x[0]).slice(0,2).join('').toUpperCase();
  const tagline  = prestador.bio_curta || (prestador.bio ? prestador.bio.slice(0,100) + (prestador.bio.length > 100 ? '…' : '') : '');
  const profissao = cats.map((c: any) => c.nome).join(' · ') || null;
  const localStr  = [profissao, prestador.cidade && `${prestador.cidade}${prestador.estado ? ', ' + prestador.estado : ''}`].filter(Boolean).join(' · ');

  // ── DESKTOP ───────────────────────────────────────────────────
  const Desktop = () => (
    <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", background: '#f5f4f0', minHeight: '100vh' }}>

      {/* NAV */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-8 py-3.5"
        style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo-escudo.png" alt="Serviço Seguro" style={{ height: 26 }}/>
          <span className="font-bold text-[14px] text-[#030213]">Serviço Seguro</span>
        </Link>
        <div className="relative">
          <button onClick={compartilhar}
            className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors hover:bg-[#f8fafc]"
            style={{ borderColor: 'rgba(0,0,0,0.13)' }}>
            <Share2 className="h-4 w-4 text-[#030213]"/>
          </button>
          {linkCopiado && (
            <div className="absolute top-11 right-0 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-white shadow-lg whitespace-nowrap"
              style={{ background: '#030213' }}>Link copiado!</div>
          )}
        </div>
      </nav>

      {/* BANNER */}
      <div className="relative w-full" style={{ height: 210 }}>
        {prestador.banner_url
          ? <img src={prestador.banner_url} alt="Banner" className="w-full h-full object-cover"/>
          : <div className="w-full h-full flex items-center justify-center flex-col gap-2"
              style={{ background: 'linear-gradient(140deg,#dbd8d0 0%,#eae7df 60%,#d0cdc5 100%)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa8a0" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span className="text-[12px] text-[#aaa8a0]">Foto de capa</span>
            </div>
        }
        {tagline && (
          <div className="absolute bottom-5 left-8 text-[15px] font-semibold leading-snug max-w-lg"
            style={{ color: prestador.banner_url ? 'rgba(255,255,255,0.9)' : 'rgba(3,2,19,0.55)',
              textShadow: prestador.banner_url ? '0 1px 3px rgba(0,0,0,0.4)' : 'none' }}>
            {tagline}
          </div>
        )}
      </div>

      {/* PROFILE CARD */}
      <div className="max-w-[960px] mx-auto px-5">
        <div className="relative bg-white rounded-[18px] px-6 pt-4 pb-5 -mt-14 mb-5"
          style={{ boxShadow: '0 4px 24px -8px rgba(3,2,19,0.12)', border: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="flex items-end gap-5">

            {/* Foto quadrada sobrepondo o banner */}
            <div className="relative flex-shrink-0" style={{ marginTop: -56 }}>
              {prestador.foto_url
                ? <img src={prestador.foto_url} alt={prestador.nome}
                    className="w-28 h-28 rounded-[16px] object-cover"
                    style={{ border: '4px solid #fff', boxShadow: '0 8px 20px -8px rgba(3,2,19,0.38)' }}/>
                : <div className="w-28 h-28 rounded-[16px] flex items-center justify-center text-white font-extrabold text-3xl"
                    style={{ background: '#030213', border: '4px solid #fff', boxShadow: '0 8px 20px -8px rgba(3,2,19,0.38)' }}>
                    {iniciais}
                  </div>
              }
              {prestador.verificado && (
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: TEAL, border: '2.5px solid #fff' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
                <h1 className="text-[22px] font-extrabold text-[#030213]">{prestador.nome}</h1>
                {prestador.verificado && (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: TEAL_BG, color: TEAL_TEXT, border: `1px solid ${TEAL}30` }}>
                    <Shield className="h-3 w-3"/> Verificado pelo Serviço Seguro
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[#64748b] mb-2">{localStr}</p>

              {/* Stats inline — igual à referência */}
              <div className="flex items-center gap-2 text-[13px] flex-wrap">
                {notaStr && (
                  <>
                    <span className="flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b">
                        <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
                      </svg>
                      <strong className="text-[#030213]">{notaStr}</strong>
                      <span className="text-[#64748b]">({totalAv} avaliações)</span>
                    </span>
                    <span className="text-[#cbd5e1]">•</span>
                  </>
                )}
                {servicosFeitos > 0 && (
                  <>
                    <span className="text-[#64748b]">
                      <strong className="text-[#030213]">{servicosFeitos}+</strong> serviços feitos
                    </span>
                    <span className="text-[#cbd5e1]">•</span>
                  </>
                )}
                {servicos.length > 0 && (
                  <span className="text-[#64748b]">
                    <strong className="text-[#030213]">{servicos.length}</strong> serviços oferecidos
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BODY 2-COL */}
        <div className="grid gap-5 pb-10" style={{ gridTemplateColumns: '1fr 300px' }}>

          {/* LEFT */}
          <div className="space-y-4">

            {/* SOBRE */}
            {prestador.bio && (
              <div className="bg-white rounded-[16px] p-5" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">SOBRE</p>
                <p className="text-[14px] text-[#374151] leading-[1.7]">{prestador.bio}</p>
              </div>
            )}

            {/* SERVIÇOS */}
            {servicos.length > 0 && (
              <div className="bg-white rounded-[16px] p-5" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8]">SERVIÇOS OFERECIDOS</p>
                  <span className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: '#f1f5f9', color: '#64748b' }}>{servicos.length} serviços</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {servicos.map((s, i) => {
                    const preco = s.tipo === 'fixo' && s.valor_fixo
                      ? `R$ ${Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                      : 'Sob orçamento';
                    return (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-[12px]"
                        style={{ border: '1px solid rgba(0,0,0,0.07)', background: '#fafafa' }}>
                        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: ICON_COLORS[i % ICON_COLORS.length] }}>
                          {s.categorias?.icone || '🔧'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13px] text-[#030213] leading-tight">{s.titulo}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[12.5px] font-bold"
                              style={{ color: s.tipo === 'fixo' ? TEAL_TEXT : '#94a3b8' }}>{preco}</span>
                            {s.aceita_orcamento_online && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: TEAL_BG, color: TEAL_TEXT }}>💬 online</span>
                            )}
                          </div>
                          {Array.isArray(s.tags) && s.tags.length > 0 && (
                            <p className="text-[10.5px] text-[#94a3b8] truncate mt-0.5">{s.tags.join(' · ')}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TRABALHOS RECENTES */}
            {Array.isArray(prestador.fotos_urls) && prestador.fotos_urls.length > 0 && (
              <div className="bg-white rounded-[16px] p-5" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8]">TRABALHOS RECENTES</p>
                  <span className="text-[12px] font-semibold" style={{ color: TEAL_TEXT }}>Ver todos</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(prestador.fotos_urls as string[]).slice(0, 6).map((url: string, i: number) => (
                    <div key={i} className="rounded-[10px] overflow-hidden bg-[#f1f5f9]" style={{ aspectRatio: '1/1' }}>
                      <img src={url} alt={`Foto ${i+1}`} loading="lazy" className="w-full h-full object-cover"/>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-4">

            {/* AVALIAÇÕES */}
            {avaliacoes.length > 0 && (
              <div className="bg-white rounded-[16px] p-5 sticky top-[72px]" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8]">AVALIAÇÕES</p>
                  {notaStr && (
                    <span className="flex items-center gap-1 text-[13px] font-bold text-[#030213]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b">
                        <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
                      </svg>
                      {notaStr}
                      <span className="font-normal text-[#94a3b8]">· {totalAv}</span>
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                  {avaliacoes.slice(0, 5).map((av: any, i: number) => {
                    const ini = (av.avaliador || 'C').split(' ').map((x: string) => x[0]).slice(0,2).join('').toUpperCase();
                    const cor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    return (
                      <div key={i}>
                        {i > 0 && <div className="border-t border-[rgba(0,0,0,0.06)] mb-4"/>}
                        <div className="flex items-start gap-2.5">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: cor }}>{ini}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-[13px] font-bold text-[#030213]">{av.avaliador || 'Cliente'}</span>
                              <StarsFilled nota={av.nota} size={12}/>
                            </div>
                            <p className="text-[11px] text-[#94a3b8] mb-1.5">
                              {av.servico_nome ? `${av.servico_nome} · ` : ''}
                              {new Date(av.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })}
                            </p>
                            {av.comentario && <p className="text-[13px] text-[#374151] leading-relaxed">{av.comentario}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[#94a3b8]">
          <Shield className="h-3.5 w-3.5"/>
          <span>Perfil oficial no Serviço Seguro</span>
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
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: '#030213' }}>{iniciais}</div>
          <span className="font-bold text-[14px] text-[#030213] truncate">{prestador.nome}</span>
        </div>
        <div className="relative">
          <button onClick={compartilhar} className="w-8 h-8 rounded-full flex items-center justify-center border"
            style={{ borderColor: 'rgba(0,0,0,0.13)' }}>
            <Share2 className="h-3.5 w-3.5 text-[#030213]"/>
          </button>
          {linkCopiado && (
            <div className="absolute top-10 right-0 px-3 py-1.5 rounded-[10px] text-xs font-semibold text-white shadow-lg whitespace-nowrap"
              style={{ background: '#030213' }}>Link copiado!</div>
          )}
        </div>
      </div>

      {/* BANNER */}
      <div className="relative w-full" style={{ height: 180 }}>
        {prestador.banner_url
          ? <img src={prestador.banner_url} alt="Banner" className="w-full h-full object-cover"/>
          : <div className="w-full h-full flex items-center justify-center flex-col gap-2"
              style={{ background: 'linear-gradient(140deg,#dbd8d0 0%,#eae7df 60%,#d0cdc5 100%)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#aaa8a0" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span className="text-[11px] text-[#aaa8a0]">Foto de capa</span>
            </div>
        }
        {tagline && (
          <div className="absolute bottom-3 left-4 right-4 text-[12.5px] font-semibold leading-snug"
            style={{ color: prestador.banner_url ? 'rgba(255,255,255,0.88)' : 'rgba(3,2,19,0.5)',
              textShadow: prestador.banner_url ? '0 1px 3px rgba(0,0,0,0.4)' : 'none' }}>
            {tagline}
          </div>
        )}
      </div>

      {/* PROFILE CARD */}
      <div className="mx-3 -mt-12 mb-4 bg-white rounded-[16px] p-4"
        style={{ boxShadow: '0 4px 20px -8px rgba(3,2,19,0.14)', border: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="flex gap-3 items-end">
          <div className="relative flex-shrink-0" style={{ marginTop: -40 }}>
            {prestador.foto_url
              ? <img src={prestador.foto_url} alt={prestador.nome}
                  className="w-20 h-20 rounded-[14px] object-cover"
                  style={{ border: '3px solid #fff', boxShadow: '0 6px 16px -6px rgba(3,2,19,0.35)' }}/>
              : <div className="w-20 h-20 rounded-[14px] flex items-center justify-center font-extrabold text-2xl text-white"
                  style={{ background: '#030213', border: '3px solid #fff' }}>
                  {iniciais}
                </div>
            }
            {prestador.verificado && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: TEAL, border: '2px solid #fff' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-0.5">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <h1 className="text-[18px] font-extrabold text-[#030213] leading-tight">{prestador.nome}</h1>
            </div>
            {prestador.verificado && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full mb-1"
                style={{ background: TEAL_BG, color: TEAL_TEXT }}>
                <Shield className="h-2.5 w-2.5"/> Verificado
              </span>
            )}
            <p className="text-[12px] text-[#64748b] leading-tight">{localStr}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-3 text-[12.5px]">
          {notaStr && (
            <>
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b">
                  <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
                </svg>
                <strong className="text-[#030213]">{notaStr}</strong>
                <span className="text-[#94a3b8]">({totalAv})</span>
              </span>
              <span className="text-[#cbd5e1]">•</span>
            </>
          )}
          {servicosFeitos > 0 && (
            <>
              <span className="text-[#64748b]"><strong className="text-[#030213]">{servicosFeitos}+</strong> feitos</span>
              <span className="text-[#cbd5e1]">•</span>
            </>
          )}
          <span className="text-[#64748b]"><strong className="text-[#030213]">{servicos.length}</strong> serviços</span>
        </div>
      </div>

      {/* SOBRE */}
      {prestador.bio && (
        <div className="mx-3 mb-3 bg-white rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2">SOBRE</p>
          <p className="text-[13.5px] text-[#374151] leading-relaxed">{prestador.bio}</p>
        </div>
      )}

      {/* SERVIÇOS */}
      {servicos.length > 0 && (
        <div className="mx-3 mb-3 bg-white rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">SERVIÇOS OFERECIDOS</p>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#f1f5f9', color: '#64748b' }}>{servicos.length}</span>
          </div>
          <div className="space-y-2">
            {servicos.map((s, i) => {
              const preco = s.tipo === 'fixo' && s.valor_fixo
                ? `R$ ${Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                : 'Sob orçamento';
              return (
                <div key={s.id} className="flex items-center gap-3 py-2.5 border-b last:border-b-0"
                  style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: ICON_COLORS[i % ICON_COLORS.length] }}>
                    {s.categorias?.icone || '🔧'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] text-[#030213]">{s.titulo}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[12px] font-bold" style={{ color: s.tipo === 'fixo' ? TEAL_TEXT : '#94a3b8' }}>{preco}</span>
                      {s.aceita_orcamento_online && (
                        <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: TEAL_BG, color: TEAL_TEXT }}>💬 online</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TRABALHOS */}
      {Array.isArray(prestador.fotos_urls) && prestador.fotos_urls.length > 0 && (
        <div className="mx-3 mb-3 bg-white rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">TRABALHOS RECENTES</p>
            <span className="text-[12px] font-semibold" style={{ color: TEAL_TEXT }}>Ver todos</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(prestador.fotos_urls as string[]).slice(0,6).map((url: string, i: number) => (
              <div key={i} className="rounded-[8px] overflow-hidden bg-[#f1f5f9]" style={{ aspectRatio:'1/1' }}>
                <img src={url} alt={`Foto ${i+1}`} loading="lazy" className="w-full h-full object-cover"/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AVALIAÇÕES */}
      {avaliacoes.length > 0 && (
        <div className="mx-3 mb-4 bg-white rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">AVALIAÇÕES</p>
            {notaStr && (
              <span className="flex items-center gap-1 text-[13px] font-bold text-[#030213]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b">
                  <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
                </svg>
                {notaStr} <span className="font-normal text-[#94a3b8]">· {totalAv}</span>
              </span>
            )}
          </div>
          <div className="space-y-4">
            {avaliacoes.slice(0,4).map((av: any, i: number) => {
              const ini = (av.avaliador || 'C').split(' ').map((x: string) => x[0]).slice(0,2).join('').toUpperCase();
              return (
                <div key={i}>
                  {i > 0 && <div className="border-t border-[rgba(0,0,0,0.06)] mb-4"/>}
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{ini}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[13px] font-bold text-[#030213]">{av.avaliador || 'Cliente'}</span>
                        <StarsFilled nota={av.nota} size={11}/>
                      </div>
                      <p className="text-[10.5px] text-[#94a3b8] mb-1">
                        {av.servico_nome ? `${av.servico_nome} · ` : ''}
                        {new Date(av.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })}
                      </p>
                      {av.comentario && <p className="text-[13px] text-[#374151] leading-relaxed">{av.comentario}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="flex items-center justify-center gap-2 py-6 text-[11.5px] text-[#94a3b8]">
        <Shield className="h-3.5 w-3.5"/>
        <span>Perfil oficial no Serviço Seguro</span>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden"><Mobile /></div>
      <div className="hidden lg:block"><Desktop /></div>
    </>
  );
}
