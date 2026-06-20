import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Search, Star, Shield, MapPin, X, ChevronRight, MessageSquare } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase } from '../../lib/supabase';

const NOTAS = [3, 3.5, 4, 4.5, 5];
const WHATSAPP_NUMERO = '555597127811';

export function Busca() {
  const [urlParams] = useSearchParams();

  const [busca, setBusca] = useState(urlParams.get('q') || '');
  const [cidade] = useState(urlParams.get('cidade') || 'Santa Maria');
  const [catAtiva, setCatAtiva] = useState(urlParams.get('cat') || '');
  const [servicos, setServicos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicoAberto, setServicoAberto] = useState<any>(null);

  // Filtros
  const [soVerificados, setSoVerificados] = useState(false);
  const [notaMin, setNotaMin] = useState(0);
  const [aceitaOnline, setAceitaOnline] = useState(false);
  const [modalidade, setModalidade] = useState('');

  useEffect(() => {
    supabase.from('categorias').select('id,nome,icone').eq('ativa', true).order('nome')
      .then(({ data }) => { if (data?.length) setCategorias(data); });
  }, []);

  useEffect(() => { buscarServicos(); }, [busca, catAtiva, soVerificados, notaMin, aceitaOnline, modalidade]);

  async function buscarServicos() {
    setLoading(true);
    try {
      // ── Busca TODOS os serviços ativos com dados do prestador ──
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, titulo, descricao, tipo, valor_fixo, aceita_orcamento_online, criado_em,
          categorias(id, nome, icone),
          prestadores(id, nome, foto_url, bio, verificado, cidade, aceita_orcamento_online),
          avaliacoes(id, nota, comentario, criado_em)
        `)
        .eq('ativo', true)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      // Filtrar cidade no JS (não no Supabase — join filter não funciona bem)
      let lista = (data || []).filter((s: any) =>
        !s.prestadores || // sem prestador vinculado, inclui
        !s.prestadores.cidade || // sem cidade definida, inclui
        s.prestadores.cidade === cidade // cidade bate
      );

      // Filtro: apenas verificados
      if (soVerificados) {
        lista = lista.filter((s: any) => s.prestadores?.verificado === true);
      }

      // Filtro: aceita orçamento online
      if (aceitaOnline) {
        lista = lista.filter((s: any) =>
          s.aceita_orcamento_online === true ||
          s.prestadores?.aceita_orcamento_online === true
        );
      }

      // Filtro: modalidade
      if (modalidade) {
        lista = lista.filter((s: any) => s.tipo === modalidade);
      }

      // Filtro: nota mínima do serviço
      if (notaMin > 0) {
        lista = lista.filter((s: any) => {
          const avs = s.avaliacoes || [];
          if (!avs.length) return false;
          const media = avs.reduce((a: number, v: any) => a + v.nota, 0) / avs.length;
          return media >= notaMin;
        });
      }

      // Filtro: categoria
      if (catAtiva) {
        lista = lista.filter((s: any) => s.categorias?.nome === catAtiva);
      }

      // Filtro: texto livre (por título e categoria — não por nome do prestador)
      if (busca.trim()) {
        const q = busca.toLowerCase().trim();
        lista = lista.filter((s: any) =>
          s.titulo?.toLowerCase().includes(q) ||
          s.descricao?.toLowerCase().includes(q) ||
          s.categorias?.nome?.toLowerCase().includes(q)
        );
      }

      // Ordenar: verificados primeiro, depois por nota
      lista.sort((a: any, b: any) => {
        if (a.prestadores?.verificado && !b.prestadores?.verificado) return -1;
        if (!a.prestadores?.verificado && b.prestadores?.verificado) return 1;
        return calcNota(b.avaliacoes) - calcNota(a.avaliacoes);
      });

      setServicos(lista);
    } catch (e) {
      console.warn('Erro busca:', e);
      setServicos([]);
    }
    setLoading(false);
  }

  function calcNota(avs: any[]) {
    if (!avs?.length) return 0;
    return avs.reduce((a: number, v: any) => a + v.nota, 0) / avs.length;
  }

  function limparFiltros() {
    setBusca(''); setCatAtiva(''); setSoVerificados(false);
    setNotaMin(0); setAceitaOnline(false); setModalidade('');
  }

  const filtrosCount = [soVerificados, notaMin > 0, aceitaOnline, !!modalidade, !!catAtiva].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">

          <div className="flex items-center gap-3 mb-3">
            <Link to="/"><Logo className="h-7 flex-shrink-0" /></Link>
            <form onSubmit={e => { e.preventDefault(); buscarServicos(); }}
              className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar serviço... ex: elétrica, pintura, encanamento"
                className="flex-1 text-sm outline-none bg-transparent" />
              {busca && <button type="button" onClick={() => setBusca('')}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
            </form>
            <Link to="/auth" className="text-sm bg-primary text-white px-4 py-2 rounded-xl font-medium flex-shrink-0">Entrar</Link>
          </div>

          {/* FILTROS */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setSoVerificados(!soVerificados)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${soVerificados ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-slate-200 hover:border-primary/40'}`}>
              🤳 Verificados
            </button>

            {NOTAS.map(n => (
              <button key={n} onClick={() => setNotaMin(notaMin === n ? 0 : n)}
                className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${notaMin === n ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-muted-foreground border-slate-200 hover:border-amber-300'}`}>
                ⭐ {n}+
              </button>
            ))}

            <button onClick={() => setAceitaOnline(!aceitaOnline)}
              className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${aceitaOnline ? 'bg-success text-white border-success' : 'bg-white text-muted-foreground border-slate-200 hover:border-success/40'}`}>
              💬 Orça online
            </button>

            <select value={modalidade} onChange={e => setModalidade(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white font-semibold text-muted-foreground outline-none cursor-pointer">
              <option value="">Tipo de preço</option>
              <option value="orcamento">Sob orçamento</option>
              <option value="fixo">Preço fixo</option>
            </select>

            {categorias.length > 0 && <div className="w-px h-4 bg-slate-200 mx-1" />}

            {categorias.map((c: any) => (
              <button key={c.id} onClick={() => setCatAtiva(catAtiva === c.nome ? '' : c.nome)}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${catAtiva === c.nome ? 'bg-primary/10 text-primary border-primary/40' : 'bg-white text-muted-foreground border-slate-200 hover:border-primary/30'}`}>
                <span>{c.icone}</span> {c.nome}
              </button>
            ))}

            {filtrosCount > 0 && (
              <button onClick={limparFiltros} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 ml-1">
                <X className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* RESULTADOS */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {loading ? 'Buscando...' : (
              <><strong className="text-foreground">{servicos.length}</strong> serviço{servicos.length !== 1 ? 's' : ''} em <strong className="text-foreground">{cidade}</strong></>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />{cidade}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && servicos.length === 0 && (
          <div className="bg-white rounded-2xl border py-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-bold text-primary mb-2">Nenhum serviço encontrado</h3>
            <p className="text-muted-foreground text-sm mb-4">Tente ajustar os filtros ou buscar outra categoria.</p>
            <button onClick={limparFiltros} className="text-sm text-primary hover:underline">Limpar filtros</button>
          </div>
        )}

        {!loading && servicos.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servicos.map((s: any) => {
              const nota = calcNota(s.avaliacoes);
              const totalAv = s.avaliacoes?.length || 0;
              return (
                <div key={s.id} onClick={() => setServicoAberto(s)}
                  className="bg-white rounded-2xl border hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer">
                  <div className="p-5">
                    {/* Categoria + badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{s.categorias?.icone || '🔧'}</span>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{s.categorias?.nome}</span>
                      </div>
                      {(s.aceita_orcamento_online || s.prestadores?.aceita_orcamento_online) && (
                        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">💬 Online</span>
                      )}
                    </div>

                    {/* Título */}
                    <h3 className="font-bold text-primary mb-1 leading-tight line-clamp-2">{s.titulo}</h3>
                    {s.descricao && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.descricao}</p>}

                    {/* Nota do serviço */}
                    {totalAv > 0 ? (
                      <div className="flex items-center gap-1.5 mb-3">
                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-bold">{nota.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">({totalAv} avaliação{totalAv !== 1 ? 'ões' : ''})</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mb-3 italic">Sem avaliações ainda</div>
                    )}

                    {/* Valor */}
                    {s.tipo === 'fixo' && s.valor_fixo ? (
                      <div className="text-base font-bold text-success">R$ {Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Valor sob orçamento</div>
                    )}
                  </div>

                  {/* Footer — sem nome do prestador */}
                  <div className="px-5 py-3 bg-slate-50 border-t flex items-center justify-between">
                    {s.prestadores?.verificado ? (
                      <span className="flex items-center gap-1 text-xs text-success font-semibold">
                        <Shield className="h-3.5 w-3.5" /> Profissional verificado
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Profissional cadastrado</span>
                    )}
                    <span className="text-xs text-primary font-semibold flex items-center gap-1">
                      Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DETALHE — profissional aparece aqui */}
      {servicoAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setServicoAberto(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span>{servicoAberto.categorias?.icone}</span>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{servicoAberto.categorias?.nome}</span>
                </div>
                <h3 className="font-bold text-primary">{servicoAberto.titulo}</h3>
              </div>
              <button onClick={() => setServicoAberto(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {(servicoAberto.aceita_orcamento_online || servicoAberto.prestadores?.aceita_orcamento_online) && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                  💬 <strong>Orçamento sem visita</strong> — com fotos e detalhes, o profissional orça remotamente.
                </div>
              )}

              {servicoAberto.descricao && (
                <p className="text-sm text-muted-foreground leading-relaxed">{servicoAberto.descricao}</p>
              )}

              {servicoAberto.avaliacoes?.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-sm">{calcNota(servicoAberto.avaliacoes).toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">({servicoAberto.avaliacoes.length} avaliação{servicoAberto.avaliacoes.length !== 1 ? 'ões' : ''} deste serviço)</span>
                  </div>
                  {servicoAberto.avaliacoes.slice(0, 3).map((av: any, i: number) => (
                    <div key={i} className="text-xs">
                      <span className="text-amber-500">{'⭐'.repeat(av.nota)}</span>
                      {av.comentario && <span className="text-muted-foreground ml-2">"{av.comentario}"</span>}
                    </div>
                  ))}
                </div>
              )}

              {servicoAberto.tipo === 'fixo' && servicoAberto.valor_fixo ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-1">Valor do serviço</div>
                  <div className="text-2xl font-bold text-success">R$ {Number(servicoAberto.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-border rounded-xl p-4">
                  <div className="text-sm text-muted-foreground">💬 Valor sob orçamento — o profissional avalia e envia a proposta.</div>
                </div>
              )}

              {/* PROFISSIONAL — apenas no modal */}
              <div className="border border-border rounded-xl p-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Profissional responsável</div>
                <div className="flex items-center gap-3">
                  {servicoAberto.prestadores?.foto_url ? (
                    <img src={servicoAberto.prestadores.foto_url} alt={servicoAberto.prestadores.nome}
                      className="w-14 h-14 rounded-full object-cover border-2 border-primary/10" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                      {servicoAberto.prestadores?.nome?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-bold text-primary">{servicoAberto.prestadores?.nome}</div>
                    {servicoAberto.prestadores?.cidade && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />{servicoAberto.prestadores.cidade}
                      </div>
                    )}
                    {servicoAberto.prestadores?.verificado && (
                      <span className="inline-flex items-center gap-1 text-xs bg-success/10 text-success font-bold px-2 py-0.5 rounded-full mt-2">
                        <Shield className="h-3 w-3" /> Identidade verificada
                      </span>
                    )}
                  </div>
                </div>
                {servicoAberto.prestadores?.bio && (
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{servicoAberto.prestadores.bio}</p>
                )}
              </div>

              {/* DOIS BOTÕES */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                    `#SERVICO:${servicoAberto.id}|#PRESTADOR:${servicoAberto.prestadores?.id || ''}|#CAT:${servicoAberto.categorias?.nome || ''}\n\nOlá! 👋 Vim pelo site do *Serviço Seguro* e tenho interesse em:\n\n🔧 *${servicoAberto.titulo}*\n📂 Categoria: ${servicoAberto.categorias?.nome || ''}\n\nPode me ajudar com um orçamento?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 bg-[#25D366] hover:bg-[#20c05c] text-white py-4 rounded-xl font-bold transition-colors text-center">
                  <span className="text-xl">📱</span>
                  <span className="text-sm">Via WhatsApp</span>
                  <span className="text-xs opacity-80">Atendimento imediato</span>
                </a>
                <Link
                  to={`/orcamento?servico=${servicoAberto.id}&nome=${encodeURIComponent(servicoAberto.titulo)}&cat=${encodeURIComponent(servicoAberto.categorias?.nome || '')}`}
                  className="flex flex-col items-center gap-1.5 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-bold transition-colors text-center">
                  <span className="text-xl">💬</span>
                  <span className="text-sm">Via Chat</span>
                  <span className="text-xs opacity-80">IA coleta os detalhes</span>
                </Link>
              </div>
              <p className="text-xs text-center text-muted-foreground">Ambos atendidos pela nossa IA 🤖</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
