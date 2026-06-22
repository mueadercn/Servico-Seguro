import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { MapPin, Shield, Star, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const CIDADES = ['Todas', 'Santa Maria', 'Passo Fundo', 'Porto Alegre', 'Pelotas', 'Caxias do Sul'];
const TEAL = 'oklch(0.6 0.118 184.704)';

export function Profissionais() {
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState('Santa Maria');
  const [categoriaId, setCategoriaId] = useState('');

  useEffect(() => {
    supabase.from('categorias').select('id, nome, icone').eq('ativa', true).order('nome')
      .then(({ data }) => { if (data) setCategorias(data); });
  }, []);

  useEffect(() => {
    carregar();
  }, [cidade, categoriaId]);

  async function carregar() {
    setLoading(true);
    try {
      let q = supabase
        .from('prestadores')
        .select('id, nome, foto_url, verificado, nota_media, total_avaliacoes, cidade, estado, bio, aceita_orcamento_online')
        .eq('ativo', true)
        .order('verificado', { ascending: false })
        .order('nota_media', { ascending: false })
        .limit(60);

      if (cidade !== 'Todas') q = q.eq('cidade', cidade);

      const { data } = await q;
      let lista = data || [];

      if (categoriaId) {
        const { data: pcs } = await supabase
          .from('prestador_categorias')
          .select('prestador_id')
          .eq('categoria_id', categoriaId);
        const ids = new Set((pcs || []).map((r: any) => r.prestador_id));
        lista = lista.filter((p: any) => ids.has(p.id));
      }

      setProfissionais(lista);
    } catch (e) { console.warn(e); }
    setLoading(false);
  }

  const filtrados = profissionais.filter(p =>
    !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.bio?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Hero */}
      <div className="bg-[#030213] text-white py-12 px-4">
        <div className="max-w-[900px] mx-auto">
          <h1 className="text-3xl font-extrabold mb-2">Profissionais</h1>
          <p className="text-white/60 text-sm mb-6">Encontre o profissional certo para o seu serviço</p>

          {/* Busca */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou especialidade..."
              className="w-full pl-11 pr-4 py-3.5 rounded-[14px] text-sm outline-none text-[#030213] font-medium"
              style={{ background: 'rgba(255,255,255,0.95)' }}
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative">
              <select
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 rounded-[10px] text-sm font-semibold outline-none cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
                {CIDADES.map(c => <option key={c} value={c} style={{ color: '#030213', background: '#fff' }}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={categoriaId}
                onChange={e => setCategoriaId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 rounded-[10px] text-sm font-semibold outline-none cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
                <option value="" style={{ color: '#030213', background: '#fff' }}>Todas as categorias</option>
                {categorias.map((c: any) => (
                  <option key={c.id} value={c.id} style={{ color: '#030213', background: '#fff' }}>
                    {c.icone} {c.nome}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="max-w-[900px] mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#030213', borderTopColor: 'transparent' }} />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-[#94a3b8]">
            <div className="text-4xl mb-3">👷</div>
            <p className="font-semibold">Nenhum profissional encontrado</p>
            <p className="text-sm mt-1">Tente mudar a cidade ou categoria</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#94a3b8] mb-5">
              {filtrados.length} profissional{filtrados.length !== 1 ? 'is' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtrados.map((p: any) => (
                <Link key={p.id} to={`/perfil/${p.id}`}
                  className="bg-white rounded-[18px] p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
                  style={{ border: '1px solid rgba(0,0,0,0.08)' }}>

                  {/* Foto + verificado */}
                  <div className="flex items-start gap-3 mb-3">
                    {p.foto_url ? (
                      <img src={p.foto_url} alt={p.nome}
                        className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                        style={{ border: '2px solid rgba(3,2,19,0.08)' }} />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                        style={{ background: '#030213' }}>
                        {p.nome?.charAt(0) || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-[#030213] truncate">{p.nome}</h3>
                      {p.verificado && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
                          style={{ background: '#f0fdf4', color: '#166534' }}>
                          <Shield className="h-2.5 w-2.5" /> Verificado
                        </span>
                      )}
                      {p.cidade && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-[#94a3b8]">
                          <MapPin className="h-3 w-3" />{p.cidade}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nota */}
                  {(p.total_avaliacoes || 0) > 0 && (
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-xs text-[#030213]">{Number(p.nota_media || 0).toFixed(1)}</span>
                      <span className="text-xs text-[#94a3b8]">({p.total_avaliacoes})</span>
                    </div>
                  )}

                  {/* Bio */}
                  {p.bio && (
                    <p className="text-xs text-[#717182] leading-relaxed line-clamp-2">{p.bio}</p>
                  )}

                  {/* Badge orçamento online */}
                  {p.aceita_orcamento_online && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
                        style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                        💬 Orçamento sem visita
                      </span>
                    </div>
                  )}

                  <div className="mt-3 text-[11px] font-bold" style={{ color: TEAL }}>
                    Ver perfil →
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
