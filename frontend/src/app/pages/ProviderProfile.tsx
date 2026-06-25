import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, MapPin, Shield, Star, MessageCircle, Phone, Bookmark, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const WHATSAPP_NUMERO = '555591598658';
const TEAL = 'oklch(0.6 0.118 184.704)';
const TEAL_BG = 'oklch(0.94 0.04 184)';
const TEAL_TEXT = 'oklch(0.40 0.12 184)';

export function ProviderProfile() {
  const { id } = useParams<{ id: string }>();
  const [prestador, setPrestador] = useState<any>(null);
  const [servicos, setServicos] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicoAtivo, setServicoAtivo] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const compartilhar = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: prestador?.nome, text: `Veja o perfil de ${prestador?.nome} no Serviço Seguro`, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  };

  useEffect(() => {
    if (!id) return;
    carregarPerfil();
  }, [id]);

  async function carregarPerfil() {
    setLoading(true);
    try {
      const { data: p, error: errP } = await supabase
        .from('prestadores')
        .select('*')
        .eq('id', id)
        .single();
      if (errP || !p) { setLoading(false); return; }
      setPrestador(p);

      const { data: pcs } = await supabase
        .from('prestador_categorias')
        .select('categorias(id, nome, icone)')
        .eq('prestador_id', id);
      if (pcs) {
        setPrestador((prev: any) => ({ ...prev, _categorias: pcs.map((r: any) => r.categorias).filter(Boolean) }));
      }

      const { data: svs } = await supabase
        .from('servicos')
        .select('*, categorias(nome, icone)')
        .eq('prestador_id', id)
        .eq('ativo', true)
        .order('criado_em', { ascending: false });
      setServicos(svs || []);

      const { data: avs } = await supabase
        .from('avaliacoes')
        .select('nota, comentario, criado_em, avaliador')
        .eq('avaliado_id', id)
        .eq('avaliado_tipo', 'prestador')
        .order('criado_em', { ascending: false })
        .limit(6);
      setAvaliacoes(avs || []);
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#030213', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!prestador) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="font-bold text-[#030213] mb-2">Perfil não encontrado</h2>
          <Link to="/" className="text-sm text-[#717182] hover:underline">← Voltar ao início</Link>
        </div>
      </div>
    );
  }

  const categorias = prestador._categorias || [];
  const notaArredondada = Number(prestador.nota_media || 0).toFixed(1);
  const totalAvaliacoes = prestador.total_avaliacoes || avaliacoes.length || 0;
  const iniciais = (prestador.nome || '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();

  const stats = [
    { value: totalAvaliacoes > 0 ? notaArredondada : '—', label: 'Nota média' },
    { value: totalAvaliacoes > 0 ? `${totalAvaliacoes}` : '—', label: 'Avaliações' },
    { value: servicos.length > 0 ? `${servicos.length}` : '—', label: 'Serviços' },
    { value: prestador.cidade || 'RS', label: 'Cidade' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#ecebe7', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-[1040px] mx-auto px-4 py-8 sm:py-12">
        <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_20px_60px_-30px_rgba(3,2,19,0.35)]">

          {/* ── COVER ── */}
          <div className="relative">
            <div className="w-full h-[160px] sm:h-[220px]"
              style={{ background: 'linear-gradient(135deg, #030213 0%, #1a1a3a 50%, #0d1f3c 100%)' }}>
              {/* decorative pattern */}
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            {/* Back button */}
            <Link to="/"
              className="absolute top-4 left-4 sm:top-5 sm:left-6 flex items-center gap-2 text-sm font-bold px-3 py-2 rounded-full backdrop-blur-md"
              style={{ background: 'rgba(255,255,255,0.92)', color: '#030213' }}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Link>

            {/* Action buttons */}
            <div className="absolute top-4 right-4 sm:top-5 sm:right-6 flex gap-2">
              <button className="w-10 h-10 rounded-[12px] flex items-center justify-center backdrop-blur-md"
                style={{ background: 'rgba(255,255,255,0.92)' }}>
                <Bookmark className="h-4 w-4 text-[#030213]" />
              </button>
              <div className="relative">
                <button className="w-10 h-10 rounded-[12px] flex items-center justify-center backdrop-blur-md"
                  style={{ background: 'rgba(255,255,255,0.92)' }} onClick={compartilhar}>
                  <Share2 className="h-4 w-4 text-[#030213]" />
                </button>
                {linkCopiado && (
                  <div className="absolute top-12 right-0 px-3 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap text-white shadow-lg"
                    style={{ background: '#030213' }}>
                    Link copiado!
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-10 pb-10">

            {/* ── HEADER: foto + nome + badges ── */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-14 sm:-mt-16 mb-6 relative">

              {/* Foto */}
              <div className="flex-shrink-0">
                {prestador.foto_url ? (
                  <img src={prestador.foto_url} alt={prestador.nome}
                    className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] rounded-[24px] object-cover"
                    style={{ border: '4px solid #fff', boxShadow: '0 8px 24px -10px rgba(3,2,19,0.4)' }} />
                ) : (
                  <div className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] rounded-[24px] flex items-center justify-center text-white font-bold text-3xl sm:text-4xl"
                    style={{ background: '#030213', border: '4px solid #fff', boxShadow: '0 8px 24px -10px rgba(3,2,19,0.4)' }}>
                    {iniciais}
                  </div>
                )}
              </div>

              <div className="flex-1 sm:pb-2">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl sm:text-[28px] font-[800] tracking-tight text-[#030213]">
                    {prestador.nome}
                  </h1>
                  {prestador.verificado && (
                    <>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={TEAL}>
                        <path d="M12 2l2.4 2.1 3.1-.6 1.1 3 2.8 1.4-1 3.1 1 3.1-2.8 1.4-1.1 3-3.1-.6L12 22l-2.4-2.1-3.1.6-1.1-3-2.8-1.4 1-3.1-1-3.1 2.8-1.4 1.1-3 3.1.6z" />
                        <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.2" fill="none" />
                      </svg>
                      <span className="text-[12.5px] font-[700] px-3 py-1 rounded-full"
                        style={{ background: TEAL_BG, color: TEAL_TEXT }}>
                        Perfil Verificado
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-[#717182] font-[500]">
                  {totalAvaliacoes > 0 && (
                    <span className="flex items-center gap-1.5 font-bold text-[#030213]">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      {notaArredondada}
                      <span className="font-normal text-[#717182]">({totalAvaliacoes} avaliações)</span>
                    </span>
                  )}
                  {prestador.cidade && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />{prestador.cidade}{prestador.estado ? `, ${prestador.estado}` : ''}
                    </span>
                  )}
                </div>

                {/* Categoria chips */}
                {categorias.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {categorias.map((cat: any) => (
                      <span key={cat.id} className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(3,2,19,0.06)', color: '#030213' }}>
                        {cat.icone} {cat.nome}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── STATS BAR ── */}
            <div className="grid grid-cols-4 rounded-[16px] overflow-hidden mb-8"
              style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
              {stats.map((s, i) => (
                <div key={s.label}
                  className="py-4 px-3 text-center"
                  style={{ borderRight: i < 3 ? '1px solid rgba(0,0,0,0.07)' : 'none' }}>
                  <div className="text-xl sm:text-[22px] font-[800] tracking-tight text-[#030213]">{s.value}</div>
                  <div className="text-[12px] text-[#717182] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── BODY: 2 colunas desktop ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8">

              {/* ── COLUNA ESQUERDA ── */}
              <div>

                {/* Bio */}
                {prestador.bio && (
                  <div className="mb-8">
                    <h2 className="text-[17px] font-[700] text-[#030213] mb-3">Sobre</h2>
                    <p className="text-[14.5px] leading-[1.65] text-[#45454f]">{prestador.bio}</p>
                  </div>
                )}

                {/* Portfólio / Galeria */}
                {Array.isArray(prestador.fotos_urls) && prestador.fotos_urls.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-[17px] font-[700] text-[#030213] mb-3">Portfólio</h2>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                      {(prestador.fotos_urls as string[]).map((url: string, i: number) => (
                        <div key={i} className="rounded-[12px] overflow-hidden" style={{ aspectRatio: '1/1' }}>
                          <img src={url} alt={`Foto ${i + 1}`} loading="lazy"
                            className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Serviços */}
                {servicos.length > 0 && (
                  <div>
                    <h2 className="text-[17px] font-[700] text-[#030213] mb-4">Serviços</h2>
                    <div className="space-y-3">
                      {servicos.map(s => (
                        <div key={s.id}>
                          <div
                            className="rounded-[14px] border p-4 cursor-pointer transition-all"
                            style={{
                              borderColor: servicoAtivo === s.id ? '#030213' : 'rgba(0,0,0,0.09)',
                              background: servicoAtivo === s.id ? 'rgba(3,2,19,0.03)' : '#fff',
                            }}
                            onClick={() => setServicoAtivo(servicoAtivo === s.id ? null : s.id)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-sm">{s.categorias?.icone}</span>
                                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8]">
                                    {s.categorias?.nome}
                                  </span>
                                  {s.aceita_orcamento_online && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                      style={{ background: 'oklch(0.95 0.03 184)', color: TEAL_TEXT }}>
                                      💬 Orça online
                                    </span>
                                  )}
                                </div>
                                <span className="font-[600] text-[14.5px] text-[#030213]">{s.titulo}</span>
                                {s.descricao && (
                                  <p className="text-xs text-[#717182] mt-1 leading-relaxed line-clamp-2">{s.descricao}</p>
                                )}
                              </div>
                              <span className="text-xs font-[600] text-[#717182] flex-shrink-0">
                                {servicoAtivo === s.id ? '▲' : 'Ver →'}
                              </span>
                            </div>

                            {/* Botões expandidos */}
                            {servicoAtivo === s.id && (
                              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
                                <a
                                  href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                                    '#SERVICO:' + s.id + '|#PRESTADOR:' + prestador.id + '|#CAT:' + (s.categorias?.nome || '') +
                                    '\n\nOlá! 👋 Vim pelo site do *Serviço Seguro* e tenho interesse em:\n\n🔧 *' + s.titulo + '*\n\nPode me ajudar?'
                                  )}`}
                                  target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="flex items-center justify-center gap-2 py-3 rounded-[10px] font-bold text-sm text-white transition-opacity hover:opacity-90"
                                  style={{ background: '#25D366' }}>
                                  <Phone className="h-4 w-4" /> WhatsApp
                                </a>
                                <Link
                                  to={`/orcamento?servico=${s.id}&nome=${encodeURIComponent(s.titulo)}&cat=${encodeURIComponent(s.categorias?.nome || '')}`}
                                  onClick={e => e.stopPropagation()}
                                  className="flex items-center justify-center gap-2 py-3 rounded-[10px] font-bold text-sm text-white transition-opacity hover:opacity-90"
                                  style={{ background: '#030213' }}>
                                  <MessageCircle className="h-4 w-4" /> Chat
                                </Link>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── COLUNA DIREITA ── */}
              <div>

                {/* Box de orçamento */}
                <div className="rounded-[18px] p-5 mb-6" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="text-sm font-[700] text-[#030213] mb-2">Pedir orçamento</div>
                  <p className="text-[13px] text-[#717182] leading-relaxed mb-4">
                    Nosso sistema coleta os detalhes do pedido e o profissional recebe tudo para enviar a proposta.
                  </p>
                  {servicos.length > 0 ? (
                    <button
                      onClick={() => {
                        const el = document.getElementById('servicos-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                        setServicoAtivo(servicos[0].id);
                      }}
                      className="w-full py-3.5 rounded-[12px] font-bold text-[15px] text-white transition-opacity hover:opacity-90"
                      style={{ background: '#030213' }}>
                      Escolher serviço
                    </button>
                  ) : (
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                        '#PRESTADOR:' + prestador.id + '\n\nOlá! Vim pelo Serviço Seguro e gostaria de um orçamento com ' + prestador.nome + '.'
                      )}`}
                      target="_blank" rel="noopener noreferrer"
                      className="block w-full py-3.5 rounded-[12px] font-bold text-[15px] text-white text-center transition-opacity hover:opacity-90"
                      style={{ background: '#030213' }}>
                      Entrar em contato
                    </a>
                  )}
                  <div className="flex items-start gap-2 mt-3">
                    <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: TEAL }} />
                    <p className="text-[12px] text-[#717182] leading-relaxed">
                      Ao fechar, geramos um contrato digital assinado pelas duas partes.
                    </p>
                  </div>
                </div>

                {/* Avaliações */}
                {avaliacoes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[17px] font-[700] text-[#030213]">Avaliações</h2>
                      {totalAvaliacoes > 0 && (
                        <span className="flex items-center gap-1 font-bold text-sm text-[#030213]">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          {notaArredondada}
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {avaliacoes.map((av: any, i: number) => {
                        const ini = (av.avaliador || 'C').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
                        return (
                          <div key={i} className="rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-9 h-9 rounded-[11px] flex items-center justify-center text-xs font-bold"
                                style={{ background: 'oklch(0.95 0.006 264)', color: '#030213' }}>
                                {ini}
                              </div>
                              <div>
                                <div className="text-[13.5px] font-[700] text-[#030213]">{av.avaliador || 'Cliente'}</div>
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map(n => (
                                    <Star key={n} className="h-3 w-3"
                                      style={{ color: n <= av.nota ? '#f59e0b' : '#e2e8f0', fill: n <= av.nota ? '#f59e0b' : '#e2e8f0' }} />
                                  ))}
                                  <span className="text-[11px] text-[#94a3b8] ml-1">
                                    {new Date(av.criado_em).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {av.comentario && (
                              <p className="text-[13.5px] leading-relaxed text-[#45454f]">{av.comentario}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
