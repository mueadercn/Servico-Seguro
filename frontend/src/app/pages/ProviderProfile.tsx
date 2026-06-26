import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { Shield, Share2, X, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const WHATSAPP_NUMERO = '555591598658';
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
  const [servicoSel, setServicoSel] = useState<any>(null);

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
        supabase.from('avaliacoes').select('nota,comentario,criado_em,avaliador,servico_nome').eq('avaliado_id', p.id).order('criado_em', { ascending: false }).limit(10),
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
  const avgLista = avaliacoes.length ? avaliacoes.reduce((a: number, x: any) => a + (Number(x.nota) || 0), 0) / avaliacoes.length : 0;
  const notaNum  = Number(prestador.nota_media || 0) || avgLista;
  const notaStr  = notaNum > 0 ? notaNum.toFixed(1).replace('.', ',') : null;
  const totalAv  = prestador.total_avaliacoes || avaliacoes.length || 0;
  const iniciais = (prestador.nome || '?').split(' ').map((x: string) => x[0]).slice(0,2).join('').toUpperCase();
  const tagline  = prestador.bio_curta || (prestador.bio ? prestador.bio.slice(0,100) + (prestador.bio.length > 100 ? '…' : '') : '');
  const profissao = cats.map((c: any) => c.nome).join(' · ') || null;
  const localStr  = [profissao, prestador.cidade && `${prestador.cidade}${prestador.estado ? ', ' + prestador.estado : ''}`].filter(Boolean).join(' · ');
  const cidadeStr = prestador.cidade ? `${prestador.cidade}${prestador.estado ? ', ' + prestador.estado : ''}` : null;
  const desde     = prestador.criado_em
    ? new Date(prestador.criado_em).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

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

      {/* CONTEÚDO — banner contido + perfil + corpo */}
      <div className="max-w-[1040px] mx-auto px-6 pt-6">

        {/* BANNER — card arredondado contido (não cobre a página toda) */}
        <div className="relative w-full rounded-[20px] overflow-hidden" style={{ height: 230 }}>
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
            <div className="absolute bottom-5 left-7 text-[15px] font-semibold leading-snug max-w-lg"
              style={{ color: prestador.banner_url ? 'rgba(255,255,255,0.92)' : 'rgba(3,2,19,0.55)',
                textShadow: prestador.banner_url ? '0 1px 3px rgba(0,0,0,0.4)' : 'none' }}>
              {tagline}
            </div>
          )}
        </div>

        {/* PROFILE CARD — sobrepõe a base do banner */}
        <div className="relative bg-white rounded-[18px] px-6 pt-4 pb-5 -mt-14 mb-5 mx-1"
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
                      <div key={s.id} onClick={() => setServicoSel(s)}
                        className="flex items-center gap-3 p-3 rounded-[12px] cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
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

            {/* GARANTIAS / SEGURANÇA — substitui o antigo bloco de CTA */}
            <div className="bg-white rounded-[16px] p-5" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                  style={{ background: TEAL_BG }}>
                  <Shield className="h-4 w-4" style={{ color: TEAL_TEXT }}/>
                </div>
                <p className="text-[13px] font-bold text-[#030213]">Contratação protegida</p>
              </div>
              <div className="space-y-2.5">
                {[
                  prestador.verificado && 'Identidade verificada pelo Serviço Seguro',
                  'Contrato digital assinado pelas duas partes',
                  'Histórico e acordos registrados (Lei 14.063/2020)',
                  'Mediação da plataforma em caso de disputa',
                ].filter(Boolean).map((txt, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5"
                      className="flex-shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5"/></svg>
                    <span className="text-[12.5px] text-[#374151] leading-snug">{txt}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                {servicosFeitos > 0 && (
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[#94a3b8]">Serviços concluídos</span>
                    <strong className="text-[#030213]">{servicosFeitos}+</strong>
                  </div>
                )}
                {cidadeStr && (
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[#94a3b8]">Atende em</span>
                    <strong className="text-[#030213]">{cidadeStr}</strong>
                  </div>
                )}
                {desde && (
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[#94a3b8]">Na plataforma desde</span>
                    <strong className="text-[#030213] capitalize">{desde}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* AVALIAÇÕES — sempre visível */}
            <div className="bg-white rounded-[16px] p-5" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8]">AVALIAÇÕES</p>
                {notaStr ? (
                  <span className="flex items-center gap-1 text-[13px] font-bold text-[#030213]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b">
                      <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
                    </svg>
                    {notaStr}
                    <span className="font-normal text-[#94a3b8]">· {totalAv}</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-[#94a3b8]">Sem avaliações ainda</span>
                )}
              </div>
              {avaliacoes.length > 0 ? (
                <div className="space-y-4">
                  {avaliacoes.slice(0, 5).map((av: any, i: number) => {
                    // nome real: pode vir como avaliador (nome) ou como 'cliente'/'prestador' (tipo)
                    const nomeReal = (av.avaliador && !['cliente','prestador'].includes(av.avaliador.toLowerCase()))
                      ? av.avaliador : 'Cliente';
                    const ini = nomeReal.split(' ').map((x: string) => x[0]).slice(0,2).join('').toUpperCase();
                    const cor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    return (
                      <div key={i}>
                        {i > 0 && <div className="border-t border-[rgba(0,0,0,0.06)] mb-4"/>}
                        <div className="flex items-start gap-2.5">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: cor }}>{ini}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-[13px] font-bold text-[#030213]">{nomeReal}</span>
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
              ) : (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">⭐</div>
                  <p className="text-[12.5px] text-[#94a3b8]">Nenhuma avaliação recebida ainda.</p>
                  <p className="text-[11.5px] text-[#cbd5e1] mt-1">As avaliações aparecem após serviços concluídos.</p>
                </div>
              )}
            </div>
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
      <div className="relative w-full" style={{ height: 160 }}>
        {prestador.banner_url
          ? <img src={prestador.banner_url} alt="Banner" className="w-full h-full object-cover"/>
          : <div className="w-full h-full flex items-center justify-center flex-col gap-1.5"
              style={{ background: 'linear-gradient(140deg,#dbd8d0 0%,#eae7df 60%,#d0cdc5 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#aaa8a0" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span className="text-[10px] text-[#aaa8a0]">Foto de capa</span>
            </div>
        }
      </div>

      {/* PROFILE CARD */}
      <div className="mx-3 -mt-10 mb-4 bg-white rounded-[16px] px-4 pt-3 pb-4"
        style={{ boxShadow: '0 4px 20px -8px rgba(3,2,19,0.14)', border: '1px solid rgba(0,0,0,0.07)' }}>

        {/* Foto + nome lado a lado */}
        <div className="flex gap-3 items-start">
          <div className="relative flex-shrink-0" style={{ marginTop: -38 }}>
            {prestador.foto_url
              ? <img src={prestador.foto_url} alt={prestador.nome}
                  className="w-[72px] h-[72px] rounded-[12px] object-cover"
                  style={{ border: '3px solid #fff', boxShadow: '0 4px 14px -4px rgba(3,2,19,0.35)' }}/>
              : <div className="w-[72px] h-[72px] rounded-[12px] flex items-center justify-center font-extrabold text-2xl text-white"
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

          {/* Nome + verificado (ao lado da foto) */}
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-[17px] font-extrabold text-[#030213] leading-tight">{prestador.nome}</h1>
            {prestador.verificado && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1"
                style={{ background: TEAL_BG, color: TEAL_TEXT }}>
                <Shield className="h-2.5 w-2.5"/> Verificado
              </span>
            )}
          </div>
        </div>

        {/* Cidade + serviços — bem dentro do card, abaixo da foto */}
        <div className="flex items-center gap-1.5 mt-3 text-[12px] flex-wrap">
          {cidadeStr && <strong className="text-[#030213]">{cidadeStr}</strong>}
          {cidadeStr && servicos.length > 0 && <span className="text-[#cbd5e1]">·</span>}
          {servicos.length > 0 && (
            <span className="text-[#64748b]"><strong className="text-[#030213]">{servicos.length}</strong> serviços oferecidos</span>
          )}
        </div>

        {/* Stats — avaliação + serviços feitos */}
        {(notaStr || servicosFeitos > 0) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2 text-[12px] pt-2"
            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            {notaStr && (
              <>
                <span className="flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b">
                    <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
                  </svg>
                  <strong className="text-[#030213]">{notaStr}</strong>
                  <span className="text-[#94a3b8]">({totalAv} avaliações)</span>
                </span>
                {servicosFeitos > 0 && <span className="text-[#cbd5e1]">·</span>}
              </>
            )}
            {servicosFeitos > 0 && (
              <span className="text-[#64748b]"><strong className="text-[#030213]">{servicosFeitos}+</strong> serviços feitos</span>
            )}
          </div>
        )}
      </div>

      {/* SOBRE */}
      {prestador.bio && (
        <div className="mx-3 mb-3 bg-white rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#030213] mb-2">SOBRE</p>
          <p className="text-[13.5px] text-[#374151] leading-relaxed">{prestador.bio}</p>
        </div>
      )}

      {/* SERVIÇOS */}
      {servicos.length > 0 && (
        <div className="mx-3 mb-3 bg-white rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#030213]">SERVIÇOS OFERECIDOS</p>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#f1f5f9', color: '#64748b' }}>{servicos.length}</span>
          </div>
          <div className="space-y-2">
            {servicos.map((s, i) => {
              const preco = s.tipo === 'fixo' && s.valor_fixo
                ? `R$ ${Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                : 'Sob orçamento';
              return (
                <div key={s.id} onClick={() => setServicoSel(s)}
                  className="flex items-center gap-3 py-2.5 border-b last:border-b-0 cursor-pointer active:opacity-70"
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

      {/* GARANTIAS / SEGURANÇA */}
      <div className="mx-3 mb-3 bg-white rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-[9px] flex items-center justify-center" style={{ background: TEAL_BG }}>
            <Shield className="h-3.5 w-3.5" style={{ color: TEAL_TEXT }}/>
          </div>
          <p className="text-[12.5px] font-bold text-[#030213]">Contratação protegida</p>
        </div>
        <div className="space-y-2">
          {[
            prestador.verificado && 'Identidade verificada pelo Serviço Seguro',
            'Contrato digital assinado pelas duas partes',
            'Mediação da plataforma em caso de disputa',
          ].filter(Boolean).map((txt, i) => (
            <div key={i} className="flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5"
                className="flex-shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5"/></svg>
              <span className="text-[12px] text-[#374151] leading-snug">{txt}</span>
            </div>
          ))}
        </div>
        {(cidadeStr || desde) && (
          <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            {cidadeStr && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#94a3b8]">Atende em</span><strong className="text-[#030213]">{cidadeStr}</strong>
              </div>
            )}
            {desde && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#94a3b8]">Na plataforma desde</span><strong className="text-[#030213] capitalize">{desde}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AVALIAÇÕES — sempre visível */}
      <div className="mx-3 mb-4 bg-white rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">AVALIAÇÕES</p>
          {notaStr ? (
            <span className="flex items-center gap-1 text-[13px] font-bold text-[#030213]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b">
                <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
              </svg>
              {notaStr} <span className="font-normal text-[#94a3b8]">· {totalAv}</span>
            </span>
          ) : (
            <span className="text-[11px] text-[#94a3b8]">Sem avaliações</span>
          )}
        </div>
        {avaliacoes.length > 0 ? (
          <div className="space-y-4">
            {avaliacoes.slice(0,4).map((av: any, i: number) => {
              const nomeReal = (av.avaliador && !['cliente','prestador'].includes(av.avaliador.toLowerCase()))
                ? av.avaliador : 'Cliente';
              const ini = nomeReal.split(' ').map((x: string) => x[0]).slice(0,2).join('').toUpperCase();
              return (
                <div key={i}>
                  {i > 0 && <div className="border-t border-[rgba(0,0,0,0.06)] mb-4"/>}
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{ini}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[13px] font-bold text-[#030213]">{nomeReal}</span>
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
        ) : (
          <div className="text-center py-5">
            <div className="text-2xl mb-1.5">⭐</div>
            <p className="text-[12px] text-[#94a3b8]">Nenhuma avaliação ainda.</p>
          </div>
        )}
      </div>

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

      {/* MODAL DE SERVIÇO — WhatsApp ou Chat */}
      {servicoSel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(3,2,19,0.55)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          onClick={e => { if (e.target === e.currentTarget) setServicoSel(null); }}>
          <div className="bg-white w-full max-w-lg flex flex-col"
            style={{ borderRadius: 20, maxHeight: '90vh', boxShadow: '0 24px 60px -24px rgba(3,2,19,0.45)' }}>

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b flex-shrink-0"
              style={{ borderColor: 'rgba(0,0,0,0.07)', borderRadius: '20px 20px 0 0' }}>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-base">{servicoSel.categorias?.icone || '🔧'}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                    {servicoSel.categorias?.nome}
                  </span>
                </div>
                <h3 className="font-bold text-base" style={{ color: '#030213' }}>{servicoSel.titulo}</h3>
              </div>
              <button onClick={() => setServicoSel(null)} className="p-2 rounded-[10px]" style={{ color: '#717182' }}>
                <X className="h-5 w-5"/>
              </button>
            </div>

            {/* Conteúdo */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {servicoSel.descricao && (
                <p className="text-sm leading-relaxed" style={{ color: '#717182' }}>{servicoSel.descricao}</p>
              )}
              {servicoSel.tipo === 'fixo' && servicoSel.valor_fixo ? (
                <div className="rounded-[12px] p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div className="text-xs mb-1" style={{ color: '#717182' }}>Valor do serviço</div>
                  <div className="text-2xl font-bold" style={{ color: 'oklch(0.45 0.1 184)' }}>
                    R$ {Number(servicoSel.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ) : (
                <div className="rounded-[12px] p-4 text-sm" style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.08)', color: '#717182' }}>
                  💬 Valor sob orçamento — o profissional avalia e envia a proposta.
                </div>
              )}

              {/* Profissional */}
              <div className="rounded-[12px] p-4" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>
                  Profissional responsável
                </div>
                <div className="flex items-center gap-3">
                  {prestador.foto_url
                    ? <img src={prestador.foto_url} className="w-12 h-12 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid rgba(3,2,19,0.08)' }}/>
                    : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ background: '#030213' }}>{iniciais}</div>}
                  <div>
                    <div className="font-bold" style={{ color: '#030213' }}>{prestador.nome}</div>
                    {prestador.cidade && (
                      <div className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#717182' }}>
                        <MapPin className="h-3 w-3"/>{prestador.cidade}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex-shrink-0 p-4 border-t grid grid-cols-2 gap-3"
              style={{ borderColor: 'rgba(0,0,0,0.07)', borderRadius: '0 0 20px 20px', background: '#fff' }}>
              <a href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                  '#SERVICO:' + servicoSel.id +
                  '|#PRESTADOR:' + (prestador.id || '') +
                  '|#CAT:' + (servicoSel.categorias?.nome || '') +
                  '\n\nOlá! 👋 Vim pelo site do *Serviço Seguro* e tenho interesse em:\n\n🔧 ' + servicoSel.titulo +
                  '\n📂 Categoria: ' + (servicoSel.categorias?.nome || '') +
                  '\n\nPode me ajudar com um orçamento?'
                )}`}
                target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 py-4 rounded-[12px] font-bold text-white text-center hover:opacity-90"
                style={{ background: '#030213' }}>
                <span className="text-xl">📱</span>
                <span className="text-sm">Via WhatsApp</span>
                <span className="text-xs" style={{ opacity: 0.7 }}>Atendimento imediato</span>
              </a>
              <a href={`/orcamento?servico=${servicoSel.id}&nome=${encodeURIComponent(servicoSel.titulo)}&cat=${encodeURIComponent(servicoSel.categorias?.nome || '')}&prestador=${prestador.id || ''}`}
                className="flex flex-col items-center gap-1.5 py-4 rounded-[12px] font-bold text-center"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', color: '#030213' }}>
                <span className="text-xl">💬</span>
                <span className="text-sm">Via Chat</span>
                <span className="text-xs" style={{ color: '#94a3b8' }}>IA coleta os detalhes</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
