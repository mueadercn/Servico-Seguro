import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Search, X, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ServiceCard } from '../components/ServiceCard';

const NOTAS = [3, 3.5, 4, 4.5, 5];
const WHATSAPP_NUMERO = '555591598658';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getInitials(nome: string): string {
  if (!nome) return '?';
  const parts = nome.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const CIDADES = ['Santa Maria', 'Passo Fundo', 'Porto Alegre', 'Pelotas', 'Caxias do Sul'];

export function Busca() {
  const [urlParams] = useSearchParams();

  const [busca, setBusca] = useState(urlParams.get('q') || '');
  const [cidade, setCidade] = useState(urlParams.get('cidade') || 'Santa Maria');
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

  // Re-busca quando qualquer filtro ou cidade muda
  useEffect(() => { buscarServicos(); }, [busca, catAtiva, cidade, soVerificados, notaMin, aceitaOnline, modalidade]);

  async function buscarServicos() {
    setLoading(true);
    try {
      // IMPORTANTE: avaliacoes não tem FK para servicos — join pela tabela prestadores via nota_media
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, titulo, descricao, tipo, valor_fixo, aceita_orcamento_online, criado_em, tags,
          categorias(id, nome, icone),
          prestadores(id, nome, foto_url, bio, verificado, cidade, nota_media, aceita_orcamento_online, fotos_urls)
        `)
        .eq('ativo', true)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      // Filtro de cidade — inclui prestadores sem cidade cadastrada
      let lista = (data || []).filter((s: any) =>
        !s.prestadores?.cidade || s.prestadores.cidade === cidade
      );

      if (soVerificados) {
        lista = lista.filter((s: any) => s.prestadores?.verificado === true);
      }

      if (aceitaOnline) {
        lista = lista.filter((s: any) =>
          s.aceita_orcamento_online === true ||
          s.prestadores?.aceita_orcamento_online === true
        );
      }

      if (modalidade) {
        lista = lista.filter((s: any) => s.tipo === modalidade);
      }

      if (notaMin > 0) {
        lista = lista.filter((s: any) => (s.prestadores?.nota_media || 0) >= notaMin);
      }

      if (catAtiva) {
        lista = lista.filter((s: any) => s.categorias?.nome === catAtiva);
      }

      if (busca.trim()) {
        const q = busca.toLowerCase().trim();
        lista = lista.filter((s: any) =>
          s.titulo?.toLowerCase().includes(q) ||
          s.descricao?.toLowerCase().includes(q) ||
          s.categorias?.nome?.toLowerCase().includes(q) ||
          s.prestadores?.nome?.toLowerCase().includes(q)
        );
      }

      // Ordenação: verificados primeiro, depois por nota
      lista.sort((a: any, b: any) => {
        if (a.prestadores?.verificado && !b.prestadores?.verificado) return -1;
        if (!a.prestadores?.verificado && b.prestadores?.verificado) return 1;
        return (b.prestadores?.nota_media || 0) - (a.prestadores?.nota_media || 0);
      });

      setServicos(lista);
    } catch (e) {
      console.warn('Erro busca:', e);
      setServicos([]);
    }
    setLoading(false);
  }

  function calcNota(s: any): number {
    return Number(s.prestadores?.nota_media || 0);
  }

  function limparFiltros() {
    setBusca(''); setCatAtiva(''); setSoVerificados(false);
    setNotaMin(0); setAceitaOnline(false); setModalidade('');
  }

  const filtrosCount = [soVerificados, notaMin > 0, aceitaOnline, !!modalidade, !!catAtiva].filter(Boolean).length;

  // pill base classes
  const pillBase = 'rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold border cursor-pointer transition-all';
  const pillInactive = `${pillBase} border-[rgba(0,0,0,0.12)] bg-white text-[#45454f]`;
  const pillActiveDark = `${pillBase} bg-[#030213] text-white border-[#030213]`;
  const pillActiveTeal = `${pillBase} bg-[oklch(0.95_0.03_184)] border-[#030213] text-[#030213]`;

  return (
    <div className="min-h-screen bg-[#f8f8fb]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── HEADER ROW 1 ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[rgba(0,0,0,0.07)]">
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Logo mark */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img src="/logo-escudo.png" alt="Serviço Seguro" style={{ height: 34, width: 'auto', display: 'block', flexShrink: 0 }} />
            <span className="font-extrabold text-sm text-[#030213] hidden sm:block">Serviço Seguro</span>
          </Link>

          {/* Search bar */}
          <form
            onSubmit={e => { e.preventDefault(); buscarServicos(); }}
            className="flex-1 max-w-[560px] flex items-center border border-[rgba(0,0,0,0.12)] rounded-[12px] px-3 py-2 gap-2 bg-white"
          >
            <Search className="h-4 w-4 text-[#94a3b8] flex-shrink-0" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar serviço… ex: elétrica, pintura, encanamento"
              className="flex-1 text-sm outline-none bg-transparent text-[#030213] placeholder-[#94a3b8]"
            />
            {busca && (
              <button type="button" onClick={() => setBusca('')}>
                <X className="h-3.5 w-3.5 text-[#94a3b8]" />
              </button>
            )}
          </form>

          <div className="ml-auto flex-shrink-0">
            <Link to="/auth" className="text-sm font-semibold text-[#030213] hover:underline">
              Entrar
            </Link>
          </div>
        </div>

        {/* ── ROW 1.5 — cidade + categoria ── */}
        <div className="px-4 py-[9px] flex items-center gap-0 border-t-2 border-[rgba(0,0,0,0.09)] overflow-x-auto"
          style={{ background: 'oklch(0.975 0.003 240)', scrollbarWidth: 'none' }}>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <MapPin className="h-3.5 w-3.5 text-[#5b6070] flex-shrink-0" />
            <span className="text-[12.5px] font-semibold text-[#5b6070]">Cidade</span>
            <select
              value={cidade}
              onChange={e => setCidade(e.target.value)}
              className="text-[12.5px] font-bold text-[#030213] bg-transparent outline-none cursor-pointer max-w-[120px]"
            >
              {CIDADES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="w-px h-5 bg-black/15 flex-shrink-0 mx-3" />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[12.5px] font-semibold text-[#5b6070]">Categoria</span>
            <select
              value={catAtiva}
              onChange={e => setCatAtiva(e.target.value)}
              className="text-[12.5px] font-bold text-[#030213] bg-transparent outline-none cursor-pointer max-w-[140px]"
            >
              <option value="">Todas</option>
              {categorias.map((c: any) => (
                <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── ROW 2 — filtros ── */}
        <div className="px-4 pt-2 pb-1 flex flex-wrap gap-2 border-t border-[rgba(0,0,0,0.06)]">
          <button onClick={() => setSoVerificados(!soVerificados)} className={soVerificados ? pillActiveTeal : pillInactive}>
            🤳 Verificados
          </button>
          <button onClick={() => setAceitaOnline(!aceitaOnline)} className={aceitaOnline ? pillActiveTeal : pillInactive}>
            ⚡ Orça online
          </button>
          {NOTAS.map(n => (
            <button key={n} onClick={() => setNotaMin(notaMin === n ? 0 : n)} className={notaMin === n ? pillActiveDark : pillInactive}>
              ⭐ {n}+
            </button>
          ))}
          <button onClick={() => setModalidade(modalidade === 'fixo' ? '' : 'fixo')} className={modalidade === 'fixo' ? pillActiveDark : pillInactive}>
            💰 Preço fixo
          </button>
          <button onClick={() => setModalidade(modalidade === 'orcamento' ? '' : 'orcamento')} className={modalidade === 'orcamento' ? pillActiveDark : pillInactive}>
            📋 Sob orçamento
          </button>
          {filtrosCount > 0 && (
            <button onClick={limparFiltros} className="flex items-center gap-1 text-[12.5px] font-semibold text-red-500 hover:text-red-700 px-2">
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
      </header>

      {/* ── RESULTS ── */}
      <div className="max-w-[1100px] mx-auto px-4 py-6">

        {/* Count + location */}
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm text-[#717182]">
            {loading ? (
              'Buscando…'
            ) : (
              <>
                <span className="font-bold text-[#030213]">{servicos.length}</span>{' '}
                serviço{servicos.length !== 1 ? 's' : ''} em{' '}
                <span className="font-bold text-[#030213]">{cidade}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-[#94a3b8]">
            <MapPin className="h-3.5 w-3.5" />
            {cidade}
          </div>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-[3px] border-[#030213] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && servicos.length === 0 && (
          <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.08)] py-20 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-bold text-[#030213] mb-2 text-lg">Nenhum serviço encontrado</h3>
            <p className="text-[#717182] text-sm mb-5">Tente ajustar os filtros ou buscar outra categoria.</p>
            <button
              onClick={limparFiltros}
              className="text-sm font-semibold text-[#030213] hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && servicos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {servicos.map((s: any) => (
              <ServiceCard key={s.id} s={s} onClick={() => setServicoAberto(s)} />
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL DETALHE ── */}
      {servicoAberto && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setServicoAberto(null); }}
        >
          <div className="bg-white rounded-[20px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-[rgba(0,0,0,0.08)] px-5 py-4 flex items-center justify-between rounded-t-[20px]">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span>{servicoAberto.categorias?.icone}</span>
                  <span className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">
                    {servicoAberto.categorias?.nome}
                  </span>
                </div>
                <h3 className="font-bold text-[#030213]">{servicoAberto.titulo}</h3>
              </div>
              <button
                onClick={() => setServicoAberto(null)}
                className="p-2 hover:bg-[#f1f1f5] rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-[#717182]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Online badge */}
              {(servicoAberto.aceita_orcamento_online || servicoAberto.prestadores?.aceita_orcamento_online) && (
                <div
                  className="rounded-[12px] px-4 py-3 text-sm font-semibold"
                  style={{ background: 'oklch(0.95 0.03 184)', color: 'oklch(0.35 0.1 184)' }}
                >
                  ⚡ <strong>Orçamento sem visita</strong> — com fotos e detalhes, o profissional orça remotamente.
                </div>
              )}

              {/* Description */}
              {servicoAberto.descricao && (
                <p className="text-sm text-[#717182] leading-relaxed">{servicoAberto.descricao}</p>
              )}

              {/* Ratings */}
              {(servicoAberto.prestadores?.nota_media > 0) && (
                <div className="bg-amber-50 border border-amber-100 rounded-[12px] p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500">⭐</span>
                    <span className="font-bold text-sm text-[#030213]">
                      {Number(servicoAberto.prestadores.nota_media).toFixed(1)}
                    </span>
                    <span className="text-xs text-[#94a3b8]">nota média do profissional</span>
                  </div>
                </div>
              )}

              {/* Price */}
              {servicoAberto.tipo === 'fixo' && servicoAberto.valor_fixo ? (
                <div className="rounded-[12px] p-4 border border-[rgba(0,0,0,0.08)] bg-white">
                  <div className="text-xs text-[#94a3b8] mb-1">Valor do serviço</div>
                  <div className="text-2xl font-extrabold" style={{ color: 'oklch(0.45 0.1 184)' }}>
                    {formatCurrency(Number(servicoAberto.valor_fixo))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[12px] p-4 border border-[rgba(0,0,0,0.08)] bg-[#f8f8fb]">
                  <div className="text-sm text-[#717182]">
                    💬 Valor sob orçamento — o profissional avalia e envia a proposta.
                  </div>
                </div>
              )}

              {/* Provider */}
              <div className="border border-[rgba(0,0,0,0.08)] rounded-[12px] p-4">
                <div className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-3">
                  Profissional responsável
                </div>
                <div className="flex items-center gap-3">
                  {servicoAberto.prestadores?.foto_url ? (
                    <img
                      src={servicoAberto.prestadores.foto_url}
                      alt={servicoAberto.prestadores.nome}
                      className="w-14 h-14 rounded-[14px] object-cover border-2 border-[rgba(0,0,0,0.06)] flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-[14px] bg-[#030213] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {getInitials(servicoAberto.prestadores?.nome || '')}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-bold text-[#030213]">{servicoAberto.prestadores?.nome}</div>
                    {servicoAberto.prestadores?.cidade && (
                      <div className="text-xs text-[#94a3b8] flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />{servicoAberto.prestadores.cidade}
                      </div>
                    )}
                    {servicoAberto.prestadores?.verificado && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-2"
                        style={{ background: 'oklch(0.95 0.03 184)', color: 'oklch(0.35 0.1 184)' }}
                      >
                        ✓ Identidade verificada
                      </span>
                    )}
                  </div>
                </div>
                {servicoAberto.prestadores?.bio && (
                  <p className="text-xs text-[#717182] mt-3 leading-relaxed">{servicoAberto.prestadores.bio}</p>
                )}
              </div>

              {/* CTA buttons */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                    `#SERVICO:${servicoAberto.id}|#PRESTADOR:${servicoAberto.prestadores?.id || ''}|#CAT:${servicoAberto.categorias?.nome || ''}\n\nOlá! 👋 Vim pelo site do *Serviço Seguro* e tenho interesse em:\n\n🔧 *${servicoAberto.titulo}*\n📂 Categoria: ${servicoAberto.categorias?.nome || ''}\n\nPode me ajudar com um orçamento?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 bg-[#25D366] hover:bg-[#20c05c] text-white py-4 rounded-[14px] font-bold transition-colors text-center"
                >
                  <span className="text-xl">📱</span>
                  <span className="text-sm">Orçamento WhatsApp</span>
                  <span className="text-xs opacity-80">Atendimento imediato</span>
                </a>
                <Link
                  to={`/orcamento?servico=${servicoAberto.id}&nome=${encodeURIComponent(servicoAberto.titulo)}&cat=${encodeURIComponent(servicoAberto.categorias?.nome || '')}`}
                  className="flex flex-col items-center gap-1.5 bg-[#030213] hover:bg-[#1a1a2e] text-white py-4 rounded-[14px] font-bold transition-colors text-center"
                >
                  <span className="text-xl">💬</span>
                  <span className="text-sm">Via Chat</span>
                  <span className="text-xs opacity-80">Sistema coleta os detalhes</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
