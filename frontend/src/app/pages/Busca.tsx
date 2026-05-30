import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router';
import { Search, Filter, Star, Shield, Smartphone, MapPin, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase } from '../../lib/supabase';

export function Busca() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [busca, setBusca] = useState(params.get('q') || '');
  const [cidade] = useState(params.get('cidade') || 'Santa Maria');
  const [catAtiva, setCatAtiva] = useState(params.get('cat') || '');
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [soVerificados, setSoVerificados] = useState(true);
  const [notaMin, setNotaMin] = useState(0);
  const [telefoneValidado, setTelefoneValidado] = useState(false);
  const [aceitaOnline, setAceitaOnline] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  useEffect(() => { buscarPrestadores(); }, [busca, catAtiva, soVerificados, notaMin, telefoneValidado, aceitaOnline]);

  async function buscarPrestadores() {
    setLoading(true);
    try {
      let query = supabase
        .from('prestadores')
        .select('*, servicos(titulo, categorias(nome))')
        .eq('ativo', true)
        .eq('cidade', cidade)
        .order('nota_media', { ascending: false });

      if (soVerificados) query = query.eq('verificado', true);
      if (notaMin > 0) query = query.gte('nota_media', notaMin);
      if (aceitaOnline) query = query.eq('aceita_orcamento_online', true);

      const { data } = await query;
      let resultado = data || [];

      // Filtro por busca ou categoria
      if (busca) {
        const q = busca.toLowerCase();
        resultado = resultado.filter((p: any) =>
          p.nome?.toLowerCase().includes(q) ||
          p.bio?.toLowerCase().includes(q) ||
          p.servicos?.some((s: any) =>
            s.titulo?.toLowerCase().includes(q) ||
            s.categorias?.nome?.toLowerCase().includes(q)
          )
        );
      }
      if (catAtiva) {
        resultado = resultado.filter((p: any) =>
          p.servicos?.some((s: any) => s.categorias?.nome === catAtiva)
        );
      }

      setPrestadores(resultado);
    } catch (e) { console.warn(e); }
    setLoading(false);
  }

  const filtrosAtivos = [
    soVerificados && 'Verificados',
    notaMin > 0 && `⭐ ${notaMin}+`,
    telefoneValidado && 'Telefone validado',
    aceitaOnline && 'Orça online',
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HEADER COM BUSCA */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/"><Logo className="h-7" /></Link>
            <form onSubmit={e => { e.preventDefault(); buscarPrestadores(); }} className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar profissional ou serviço..."
                className="flex-1 text-sm outline-none bg-transparent" />
              {busca && <button type="button" onClick={() => setBusca('')}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
            </form>
          </div>

          {/* CHIPS DE FILTRO */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setSoVerificados(!soVerificados)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${soVerificados ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-slate-200 hover:border-primary/40'}`}>
              🤳 Verificados
            </button>
            {[4, 4.5, 5].map(n => (
              <button key={n} onClick={() => setNotaMin(notaMin === n ? 0 : n)}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${notaMin === n ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-muted-foreground border-slate-200 hover:border-amber-300'}`}>
                ⭐ {n}+
              </button>
            ))}
            <button onClick={() => setAceitaOnline(!aceitaOnline)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${aceitaOnline ? 'bg-success text-white border-success' : 'bg-white text-muted-foreground border-slate-200 hover:border-success/40'}`}>
              💬 Orça online
            </button>
            {catAtiva && (
              <button onClick={() => setCatAtiva('')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
                {catAtiva} <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* RESULTADOS */}
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* CABEÇALHO */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {loading ? 'Buscando...' : (
              <><strong className="text-foreground">{prestadores.length}</strong> profissional{prestadores.length !== 1 ? 'is' : ''} em <strong className="text-foreground">{cidade}</strong></>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />{cidade}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : prestadores.length === 0 ? (
          <div className="bg-white rounded-2xl border py-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-bold text-primary mb-2">Nenhum profissional encontrado</h3>
            <p className="text-muted-foreground text-sm mb-4">Tente ajustar os filtros ou buscar outro serviço.</p>
            <button onClick={() => { setBusca(''); setSoVerificados(false); setNotaMin(0); setCatAtiva(''); }}
              className="text-sm text-primary hover:underline">Limpar filtros</button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {prestadores.map((p: any) => (
              <div key={p.id} className="bg-white rounded-2xl border hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                      {p.nome?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-primary">{p.nome}</h3>
                        {p.verificado && (
                          <span className="inline-flex items-center gap-1 text-xs bg-success/10 text-success font-bold px-2 py-0.5 rounded-full">
                            <Shield className="h-3 w-3" /> Verificado
                          </span>
                        )}
                      </div>
                      {p.nota_media > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-sm font-semibold">{Number(p.nota_media).toFixed(1)}</span>
                          {p.total_avaliacoes > 0 && (
                            <span className="text-xs text-muted-foreground">({p.total_avaliacoes})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  {p.bio && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.bio}</p>}

                  {/* Selos */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {p.verificado && (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">
                        🤳 Biometria verificada
                      </span>
                    )}
                    {p.aceita_orcamento_online && (
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                        💬 Orça sem visita
                      </span>
                    )}
                    {p.telefone && (
                      <span className="text-xs bg-slate-50 text-slate-600 border border-slate-100 px-2 py-0.5 rounded-full font-medium">
                        📱 Telefone validado
                      </span>
                    )}
                  </div>

                  {/* Serviços */}
                  {p.servicos?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.servicos.slice(0, 3).map((s: any, i: number) => (
                        <span key={i} className="text-xs bg-primary/5 text-primary px-2.5 py-1 rounded-full">
                          {s.categorias?.nome || s.titulo}
                        </span>
                      ))}
                      {p.servicos.length > 3 && (
                        <span className="text-xs text-muted-foreground px-2 py-1">+{p.servicos.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{p.cidade}
                  </span>
                  <Link to={`/orcamento?prestador=${p.id}&nome=${encodeURIComponent(p.nome)}`}
                    className="inline-flex items-center gap-1.5 text-xs bg-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-primary/90 transition-colors">
                    Solicitar orçamento <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
