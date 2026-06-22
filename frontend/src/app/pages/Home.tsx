import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Shield, MapPin, ChevronRight, Star, CheckCircle2, X } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase } from '../../lib/supabase';

const CIDADE_PADRAO = 'Santa Maria';
const WHATSAPP_NUMERO = '555591598658';
const CIDADES = ['Santa Maria', 'Passo Fundo', 'Porto Alegre', 'Pelotas'];

const CATEGORIAS_FIXAS = [
  { nome: 'Elétrica', icone: '⚡' },
  { nome: 'Encanamento', icone: '🚿' },
  { nome: 'Gesso', icone: '🪨' },
  { nome: 'Pintura', icone: '🎨' },
  { nome: 'Reforma', icone: '🏗️' },
  { nome: 'Limpeza', icone: '🧹' },
  { nome: 'Marcenaria', icone: '🪚' },
  { nome: 'Tecnologia', icone: '💻' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Elétrica': '#f59e0b',
  'Encanamento': '#3b82f6',
  'Gesso': '#8b5cf6',
  'Pintura': '#ec4899',
  'Reforma': '#f97316',
  'Limpeza': '#06b6d4',
  'Marcenaria': '#a16207',
  'Tecnologia': '#6366f1',
};

function getCategoryColor(nome: string): string {
  return CATEGORY_COLORS[nome] ?? '#030213';
}

export function Home() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState(CIDADE_PADRAO);
  const [servicos, setServicos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [stats, setStats] = useState({ prestadores: 0, servicos: 0 });
  const [loading, setLoading] = useState(true);
  const [servicoSelecionado, setServicoSelecionado] = useState<any>(null);

  useEffect(() => {
    carregarDados();
  }, [cidade]);

  async function carregarDados() {
    setLoading(true);
    try {
      const { data: cats } = await supabase
        .from('categorias').select('id,nome,icone').eq('ativa', true).order('nome');
      if (cats?.length) setCategorias(cats);

      const { data: svcs } = await supabase
        .from('servicos')
        .select(`
          id, titulo, descricao, tipo, valor_fixo, aceita_orcamento_online,
          categorias(nome, icone),
          prestadores(id, nome, foto_url, verificado, nota_media, cidade)
        `)
        .eq('ativo', true)
        .order('criado_em', { ascending: false })
        .limit(20);

      const todos = svcs || [];
      const filtrados = todos.filter((s: any) =>
        !s.prestadores?.cidade || s.prestadores.cidade === cidade
      );
      setServicos(filtrados.length > 0 ? filtrados.slice(0, 6) : todos.slice(0, 6));

      const { count: countP } = await supabase
        .from('prestadores').select('id', { count: 'exact', head: true })
        .eq('ativo', true).eq('verificado', true);
      const { count: countS } = await supabase
        .from('servicos').select('id', { count: 'exact', head: true }).eq('ativo', true);

      setStats({ prestadores: countP || 0, servicos: countS || 0 });
    } catch (e) { console.warn(e); }
    setLoading(false);
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/busca?q=${encodeURIComponent(busca)}&cidade=${encodeURIComponent(cidade)}`);
  }

  const cats = categorias.length > 0 ? categorias : CATEGORIAS_FIXAS;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ─── HEADER ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(0,0,0,0.07)',
        }}>
        <div className="max-w-[1080px] mx-auto px-5 flex items-center justify-between"
          style={{ height: 62 }}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black select-none"
              style={{ background: '#030213' }}>S</div>
            <span className="text-[15px] font-[800] tracking-tight" style={{ color: '#030213' }}>
              Serviço Seguro
            </span>
          </Link>

          {/* Nav */}
          <div className="flex items-center gap-1">
            <Link to="/como-funciona"
              className="hidden md:block text-sm px-3 py-2 rounded-[10px] transition-colors"
              style={{ color: '#717182' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#030213')}
              onMouseLeave={e => (e.currentTarget.style.color = '#717182')}>
              Como funciona
            </Link>
            <Link to="/auth?tipo=prestador"
              className="hidden md:block text-sm px-3 py-2 rounded-[10px] transition-colors"
              style={{ color: '#717182' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#030213')}
              onMouseLeave={e => (e.currentTarget.style.color = '#717182')}>
              Sou profissional
            </Link>
            <Link to="/auth"
              className="ml-2 text-sm font-bold px-4 py-2 rounded-[12px] text-white transition-opacity hover:opacity-90"
              style={{ background: '#030213' }}>
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="pt-32 pb-14 px-4">
        <div className="max-w-2xl mx-auto text-center">

          {/* Animated badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6 text-sm font-semibold"
            style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            {stats.prestadores > 0 ? `${stats.prestadores}+` : '+'} profissionais verificados em {cidade}
          </div>

          <h1 className="text-4xl md:text-[52px] font-[800] tracking-tight leading-[1.1] mb-4"
            style={{ color: '#030213' }}>
            Encontre profissionais<br />
            <span style={{ color: 'oklch(0.6 0.118 184.704)' }}>verificados</span> perto de você
          </h1>
          <p className="text-base mb-10" style={{ color: '#717182' }}>
            Contrato digital, IA no atendimento e segurança jurídica em cada serviço.
          </p>

          {/* Search card */}
          <form onSubmit={buscar}
            className="flex flex-col sm:flex-row items-center rounded-[16px] p-2 gap-2"
            style={{ background: '#fff', boxShadow: '0 14px 40px -18px rgba(3,2,19,0.25)' }}>
            {/* City picker */}
            <div className="flex items-center gap-2 px-3 py-3 rounded-[12px] sm:w-48 flex-shrink-0 w-full"
              style={{ background: 'oklch(0.985 0.001 0)' }}>
              <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: '#94a3b8' }} />
              <select value={cidade} onChange={e => setCidade(e.target.value)}
                className="bg-transparent text-sm outline-none w-full font-medium"
                style={{ color: '#030213' }}>
                {CIDADES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="hidden sm:block w-px self-stretch my-1" style={{ background: 'rgba(0,0,0,0.08)' }} />

            {/* Search input */}
            <div className="flex items-center gap-2 flex-1 px-3 w-full">
              <Search className="h-4 w-4 flex-shrink-0" style={{ color: '#94a3b8' }} />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="O que você precisa? Ex: eletricista, pintura"
                className="flex-1 py-3 text-sm outline-none bg-transparent"
                style={{ color: '#030213' }}
              />
            </div>

            <button type="submit"
              className="px-6 py-3 rounded-[12px] text-sm font-bold text-white flex-shrink-0 w-full sm:w-auto transition-opacity hover:opacity-90"
              style={{ background: '#030213' }}>
              Buscar
            </button>
          </form>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-6 overflow-x-auto">
            {cats.slice(0, 8).map((c: any) => (
              <button
                key={c.nome || c.id}
                onClick={() => navigate(`/busca?cat=${encodeURIComponent(c.nome)}&cidade=${encodeURIComponent(cidade)}`)}
                className="flex items-center gap-1.5 text-[13.5px] rounded-full px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.1)',
                  color: '#030213',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#030213')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)')}>
                <span>{c.icone}</span>
                <span>{c.nome}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TRUST SEALS ─── */}
      <section className="py-6 border-y" style={{ background: 'oklch(0.985 0.001 0)', borderColor: 'rgba(0,0,0,0.07)' }}>
        <div className="max-w-[1080px] mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { ic: '✅', t: 'Verificados', s: 'Identidade confirmada' },
              { ic: '🛡️', t: 'Contrato Digital', s: 'Validade jurídica' },
              { ic: '⚡', t: 'IA no Atendimento', s: 'Orçamento rápido' },
              { ic: '⭐', t: 'Avaliações Reais', s: 'Por serviço executado' },
            ].map(seal => (
              <div key={seal.t}
                className="flex items-center gap-3 rounded-[12px] p-4"
                style={{ background: '#fff' }}>
                <span className="text-xl flex-shrink-0">{seal.ic}</span>
                <div>
                  <div className="text-[13px] font-[700]" style={{ color: '#030213' }}>{seal.t}</div>
                  <div className="text-[12px]" style={{ color: '#717182' }}>{seal.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMO FUNCIONA ─── */}
      <section className="py-16 px-4">
        <div className="max-w-[1080px] mx-auto">
          <h2 className="text-3xl font-[800] tracking-tight text-center mb-10" style={{ color: '#030213' }}>
            Como funciona
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: '1', title: 'Descreva o que precisa', desc: 'Nossa IA coleta os detalhes do serviço via WhatsApp ou chat — sem formulários chatos.' },
              { n: '2', title: 'Receba proposta qualificada', desc: 'O profissional já recebe tudo que precisa para enviar um orçamento preciso.' },
              { n: '3', title: 'Assine e contrate com segurança', desc: 'Contrato digital com validade jurídica, biometria opcional e hash SHA-256.' },
            ].map(step => (
              <div key={step.n}
                className="p-6 rounded-[18px]"
                style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center font-bold text-sm text-white mb-4"
                  style={{ background: '#030213' }}>
                  {step.n}
                </div>
                <h3 className="font-[700] mb-2" style={{ color: '#030213' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#717182' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SERVIÇOS ─── */}
      <section className="py-12 px-4" style={{ background: 'oklch(0.985 0.001 0)' }}>
        <div className="max-w-[1080px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-[800] tracking-tight" style={{ color: '#030213' }}>
                Serviços em {cidade}
              </h2>
              <p className="text-sm mt-1" style={{ color: '#717182' }}>
                {loading ? 'Carregando...' : `${stats.servicos} serviços disponíveis · profissionais verificados`}
              </p>
            </div>
            <Link to={`/busca?cidade=${encodeURIComponent(cidade)}`}
              className="hidden md:flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: '#030213' }}>
              Ver todos <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-[16px] h-48 animate-pulse" style={{ background: '#e2e8f0' }} />
              ))}
            </div>
          ) : servicos.length === 0 ? (
            <div className="rounded-[16px] py-16 text-center border border-dashed" style={{ borderColor: 'rgba(0,0,0,0.12)' }}>
              <div className="text-4xl mb-3">🔧</div>
              <p className="text-sm mb-3" style={{ color: '#717182' }}>
                Nenhum serviço cadastrado em {cidade} ainda.
              </p>
              <Link to="/auth?tipo=prestador"
                className="text-sm font-semibold hover:underline" style={{ color: '#030213' }}>
                Cadastre-se como profissional →
              </Link>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-5">
                {servicos.map((s: any) => {
                  const catColor = getCategoryColor(s.categorias?.nome || '');
                  return (
                    <button
                      key={s.id}
                      onClick={() => setServicoSelecionado(s)}
                      className="text-left w-full overflow-hidden rounded-[16px] transition-all duration-200 cursor-pointer flex flex-col"
                      style={{
                        background: '#fff',
                        border: '1px solid rgba(0,0,0,0.08)',
                        boxShadow: 'none',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 40px -18px rgba(3,2,19,0.25)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      }}>
                      {/* Category color bar */}
                      <div className="h-1.5 w-full flex-shrink-0" style={{ background: catColor }} />

                      {/* Body */}
                      <div className="p-4 flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>
                          {s.categorias?.icone} {s.categorias?.nome}
                        </div>
                        <h3 className="font-[700] text-sm leading-snug mb-1.5 line-clamp-2" style={{ color: '#030213' }}>
                          {s.titulo}
                        </h3>
                        {s.descricao && (
                          <p className="text-xs line-clamp-2 mb-3" style={{ color: '#717182' }}>{s.descricao}</p>
                        )}

                        {s.prestadores?.nota_media > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-semibold" style={{ color: '#030213' }}>
                              {Number(s.prestadores.nota_media).toFixed(1)}
                            </span>
                          </div>
                        )}

                        {s.tipo === 'fixo' && s.valor_fixo ? (
                          <div className="text-sm font-bold" style={{ color: 'oklch(0.45 0.1 184)' }}>
                            R$ {Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        ) : (
                          <div className="text-sm" style={{ color: '#94a3b8' }}>Sob orçamento</div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="px-4 py-2.5 flex items-center gap-2 border-t"
                        style={{ background: 'oklch(0.985 0.001 0)', borderColor: 'rgba(0,0,0,0.07)' }}>
                        {s.prestadores?.foto_url ? (
                          <img src={s.prestadores.foto_url} alt={s.prestadores.nome}
                            className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                            style={{ background: '#030213' }}>
                            {s.prestadores?.nome?.charAt(0) || '?'}
                          </div>
                        )}
                        <span className="text-xs truncate flex-1" style={{ color: '#717182' }}>
                          {s.prestadores?.nome}
                        </span>
                        {s.prestadores?.verificado && (
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'oklch(0.6 0.118 184.704)' }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="text-center mt-8">
                <Link to={`/busca?cidade=${encodeURIComponent(cidade)}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-[12px] transition-all"
                  style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', color: '#030213' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#030213')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)')}>
                  Ver todos os serviços em {cidade} <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── DUAL CTA ─── */}
      <section className="py-16 px-4">
        <div className="max-w-[1080px] mx-auto grid md:grid-cols-2 gap-5">
          {/* Dark card */}
          <div className="rounded-[20px] p-8 relative overflow-hidden text-white"
            style={{ background: '#030213' }}>
            <div className="absolute right-4 bottom-[-20px] text-[130px] leading-none select-none pointer-events-none"
              style={{ opacity: 0.06 }}>🔧</div>
            <div className="relative z-10">
              <div className="text-3xl mb-4">👤</div>
              <h3 className="text-xl font-[800] tracking-tight mb-2">Precisa de um serviço?</h3>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Encontre profissionais verificados com contrato e segurança jurídica em Santa Maria.
              </p>
              <Link to={`/busca?cidade=${encodeURIComponent(cidade)}`}
                className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-[12px] transition-colors"
                style={{ background: '#fff', color: '#030213' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                Buscar profissional <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Light card */}
          <div className="rounded-[20px] p-8 relative overflow-hidden"
            style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }}>
            <div className="absolute right-4 bottom-[-20px] text-[130px] leading-none select-none pointer-events-none"
              style={{ opacity: 0.06 }}>📋</div>
            <div className="relative z-10">
              <div className="text-3xl mb-4">👷</div>
              <h3 className="text-xl font-[800] tracking-tight mb-2" style={{ color: '#030213' }}>É profissional?</h3>
              <p className="text-sm mb-6" style={{ color: '#717182' }}>
                Receba orçamentos qualificados pela IA e formalize seus serviços com contrato digital.
              </p>
              <Link to="/auth?tipo=prestador"
                className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-[12px] text-white transition-opacity hover:opacity-90"
                style={{ background: '#030213' }}>
                Cadastrar grátis <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t py-6 px-4 text-center" style={{ borderColor: 'rgba(0,0,0,0.07)', fontSize: 12.5, color: '#94a3b8' }}>
        © 2026 Serviço Seguro · {cidade} ·{' '}
        <Link to="/como-funciona" className="hover:underline ml-1" style={{ color: '#94a3b8' }}>Como funciona</Link> ·{' '}
        <Link to="/admin" className="hover:underline ml-1" style={{ color: '#94a3b8' }}>Admin</Link>
      </footer>

      {/* ─── MODAL ─── */}
      {servicoSelecionado && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(3,2,19,0.55)' }}
          onClick={e => { if (e.target === e.currentTarget) setServicoSelecionado(null); }}>
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ borderRadius: 20, boxShadow: '0 24px 60px -24px rgba(3,2,19,0.45)' }}>

            {/* Modal header */}
            <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b"
              style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-base">{servicoSelecionado.categorias?.icone || '🔧'}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                    {servicoSelecionado.categorias?.nome}
                  </span>
                </div>
                <h3 className="font-[700] text-base" style={{ color: '#030213' }}>{servicoSelecionado.titulo}</h3>
              </div>
              <button
                onClick={() => setServicoSelecionado(null)}
                className="p-2 rounded-[10px] transition-colors"
                style={{ color: '#717182' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.985 0.001 0)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {(servicoSelecionado.aceita_orcamento_online || servicoSelecionado.prestadores?.aceita_orcamento_online) && (
                <div className="rounded-[12px] px-4 py-3 text-sm"
                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
                  💬 <strong>Orçamento sem visita</strong> — com fotos e detalhes o profissional orça remotamente.
                </div>
              )}

              {servicoSelecionado.descricao && (
                <p className="text-sm leading-relaxed" style={{ color: '#717182' }}>
                  {servicoSelecionado.descricao}
                </p>
              )}

              {servicoSelecionado.tipo === 'fixo' && servicoSelecionado.valor_fixo ? (
                <div className="rounded-[12px] p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div className="text-xs mb-1" style={{ color: '#717182' }}>Valor do serviço</div>
                  <div className="text-2xl font-bold" style={{ color: 'oklch(0.45 0.1 184)' }}>
                    R$ {Number(servicoSelecionado.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ) : (
                <div className="rounded-[12px] p-4 text-sm" style={{ background: 'oklch(0.985 0.001 0)', border: '1px solid rgba(0,0,0,0.08)', color: '#717182' }}>
                  💬 Valor sob orçamento — o profissional avalia e envia a proposta.
                </div>
              )}

              {/* Provider */}
              <div className="rounded-[12px] p-4" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>
                  Profissional responsável
                </div>
                <div className="flex items-center gap-3">
                  {servicoSelecionado.prestadores?.foto_url ? (
                    <img src={servicoSelecionado.prestadores.foto_url}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      style={{ border: '2px solid rgba(3,2,19,0.08)' }} />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ background: '#030213' }}>
                      {servicoSelecionado.prestadores?.nome?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <div className="font-[700]" style={{ color: '#030213' }}>{servicoSelecionado.prestadores?.nome}</div>
                    {servicoSelecionado.prestadores?.cidade && (
                      <div className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#717182' }}>
                        <MapPin className="h-3 w-3" />{servicoSelecionado.prestadores.cidade}
                      </div>
                    )}
                    {servicoSelecionado.prestadores?.verificado && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-1.5"
                        style={{ background: '#f0fdf4', color: '#166534' }}>
                        <Shield className="h-3 w-3" /> Verificado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                    '#SERVICO:' + servicoSelecionado.id +
                    '|#PRESTADOR:' + (servicoSelecionado.prestador_id || '') +
                    '|#CAT:' + (servicoSelecionado.categorias?.nome || '') +
                    '\n\nOlá! 👋 Vim pelo site do *Serviço Seguro* e tenho interesse em:\n\n🔧 ' + servicoSelecionado.titulo +
                    '\n📂 Categoria: ' + (servicoSelecionado.categorias?.nome || '') +
                    '\n\nPode me ajudar com um orçamento?'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 py-4 rounded-[12px] font-bold text-white text-center transition-opacity hover:opacity-90"
                  style={{ background: '#030213' }}>
                  <span className="text-xl">📱</span>
                  <span className="text-sm">Via WhatsApp</span>
                  <span className="text-xs" style={{ opacity: 0.7 }}>Atendimento imediato</span>
                </a>

                <a
                  href={`/orcamento?servico=${servicoSelecionado.id}&nome=${encodeURIComponent(servicoSelecionado.titulo)}&cat=${encodeURIComponent(servicoSelecionado.categorias?.nome || '')}`}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-[12px] font-bold text-center transition-colors"
                  style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', color: '#030213' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#030213')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)')}>
                  <span className="text-xl">💬</span>
                  <span className="text-sm">Via Chat</span>
                  <span className="text-xs" style={{ color: '#94a3b8' }}>IA coleta os detalhes</span>
                </a>
              </div>

              <p className="text-xs text-center" style={{ color: '#94a3b8' }}>
                Ambos os canais são atendidos pela nossa IA 🤖
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
