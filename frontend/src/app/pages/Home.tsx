import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Shield, MapPin, ChevronRight, Star, CheckCircle2, X, MessageSquare } from 'lucide-react';
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
      // Carregar categorias do banco
      const { data: cats } = await supabase
        .from('categorias').select('id,nome,icone').eq('ativa', true).order('nome');
      if (cats?.length) setCategorias(cats);

      // Carregar serviços da cidade
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

      // Filtrar cidade no JS (join filter do Supabase remove linhas)
      const todos = svcs || [];
      const filtrados = todos.filter((s: any) =>
        !s.prestadores?.cidade || s.prestadores.cidade === cidade
      );
      setServicos(filtrados.length > 0 ? filtrados.slice(0, 8) : todos.slice(0, 8));

      // Stats
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
    <div className="min-h-screen bg-white">

      {/* HEADER MÍNIMO */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo className="h-8" />
          <div className="flex items-center gap-2">
            <Link to="/como-funciona"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Como funciona
            </Link>
            <Link to="/auth?tipo=prestador"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block px-3">
              Sou profissional
            </Link>
            <Link to="/auth"
              className="text-sm bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors font-medium">
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* HERO — DIRETO AO PONTO */}
      <section className="pt-28 pb-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary mb-3 leading-tight">
            Encontre profissionais<br />
            <span className="text-success">verificados</span> perto de você
          </h1>
          <p className="text-muted-foreground mb-8 text-base">
            Contrato digital e segurança jurídica em todo serviço.
          </p>

          {/* BUSCA */}
          <form onSubmit={buscar}
            className="bg-white border border-slate-200 rounded-2xl shadow-lg p-2 flex flex-col sm:flex-row gap-2">
            {/* Cidade */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl sm:w-48 flex-shrink-0">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <select value={cidade} onChange={e => setCidade(e.target.value)}
                className="bg-transparent text-sm outline-none w-full text-foreground font-medium">
                {CIDADES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="hidden sm:block w-px bg-slate-200 my-1" />

            {/* Campo de busca */}
            <div className="flex items-center gap-2 flex-1 px-3">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="O que você precisa? Ex: eletricista, pintura"
                className="flex-1 py-2.5 text-sm outline-none bg-transparent placeholder:text-muted-foreground" />
            </div>

            <button type="submit"
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors flex-shrink-0">
              Buscar
            </button>
          </form>

          {/* CATEGORIAS RÁPIDAS */}
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            {cats.slice(0, 8).map((c: any) => (
              <button key={c.nome || c.id}
                onClick={() => navigate(`/busca?cat=${encodeURIComponent(c.nome)}&cidade=${encodeURIComponent(cidade)}`)}
                className="flex items-center gap-1.5 text-sm bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-primary/30 text-foreground px-3 py-1.5 rounded-full transition-all">
                <span>{c.icone}</span>
                <span>{c.nome}</span>
              </button>
            ))}
          </div>

          {/* STATS */}
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>
                <strong className="text-foreground">{stats.prestadores || '—'}+</strong> profissionais verificados
              </span>
            </div>
            <div className="text-slate-300">·</div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-success" />
              <span>Contrato em todo serviço</span>
            </div>
          </div>
        </div>
      </section>

      {/* SELOS */}
      <section className="py-6 border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { ic: '🤳', t: 'Biometria facial', s: 'Identidade confirmada' },
              { ic: '📄', t: 'Contrato digital', s: 'Validade jurídica' },
              { ic: '⭐', t: 'Avaliações reais', s: 'Por serviço executado' },
              { ic: '💬', t: 'IA no atendimento', s: 'Orçamento rápido' },
            ].map(s => (
              <div key={s.t} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3">
                <span className="text-xl flex-shrink-0">{s.ic}</span>
                <div>
                  <div className="text-xs font-bold text-primary">{s.t}</div>
                  <div className="text-xs text-muted-foreground">{s.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVIÇOS DA CIDADE */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-primary">
                Serviços disponíveis em {cidade}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {loading ? 'Carregando...' : `${stats.servicos} serviços · profissionais verificados`}
              </p>
            </div>
            <Link to={`/busca?cidade=${encodeURIComponent(cidade)}`}
              className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-slate-100 rounded-2xl h-40 animate-pulse" />
              ))}
            </div>
          ) : servicos.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-12 text-center">
              <div className="text-3xl mb-3">🔧</div>
              <p className="text-muted-foreground text-sm mb-2">
                Nenhum serviço cadastrado em {cidade} ainda.
              </p>
              <Link to="/auth?tipo=prestador"
                className="text-sm text-primary hover:underline">
                Cadastre-se como profissional →
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {servicos.map((s: any) => (
                <button key={s.id}
                  onClick={() => setServicoSelecionado(s)}
                  className="bg-white rounded-2xl border hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group text-left w-full">
                  <div className="p-4">
                    {/* Categoria */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{s.categorias?.icone || '🔧'}</span>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide truncate">
                        {s.categorias?.nome}
                      </span>
                    </div>

                    {/* Título */}
                    <h3 className="font-bold text-primary text-sm mb-1 leading-tight line-clamp-2">
                      {s.titulo}
                    </h3>

                    {/* Nota */}
                    {s.prestadores?.nota_media > 0 && (
                      <div className="flex items-center gap-1 mb-2">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-semibold">
                          {Number(s.prestadores.nota_media).toFixed(1)}
                        </span>
                      </div>
                    )}

                    {/* Valor */}
                    {s.tipo === 'fixo' && s.valor_fixo ? (
                      <div className="text-sm font-bold text-success">
                        R$ {Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Sob orçamento</div>
                    )}
                  </div>

                  {/* Footer do card */}
                  <div className="px-4 py-2.5 bg-slate-50 border-t flex items-center gap-2">
                    {/* Avatar prestador */}
                    {s.prestadores?.foto_url ? (
                      <img src={s.prestadores.foto_url} alt={s.prestadores.nome}
                        className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                        {s.prestadores?.nome?.charAt(0) || '?'}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {s.prestadores?.nome}
                    </span>
                    {s.prestadores?.verificado && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="text-center mt-6">
            <Link to={`/busca?cidade=${encodeURIComponent(cidade)}`}
              className="inline-flex items-center gap-2 border border-slate-200 hover:border-primary/30 text-sm text-foreground px-6 py-2.5 rounded-xl transition-all hover:bg-slate-50">
              Ver todos os serviços em {cidade} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA DUPLO */}
      <section className="py-12 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-5">
          <div className="bg-primary rounded-2xl p-7 text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 text-8xl opacity-[0.05] leading-none select-none">🔧</div>
            <div className="relative z-10">
              <div className="text-2xl mb-3">👤</div>
              <h3 className="text-lg font-bold mb-2">Precisa de um serviço?</h3>
              <p className="text-white/70 text-sm mb-5">
                Encontre profissionais verificados com contrato e segurança jurídica.
              </p>
              <Link to={`/busca?cidade=${encodeURIComponent(cidade)}`}
                className="inline-flex items-center gap-2 bg-white text-primary px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                Buscar profissional <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="bg-success rounded-2xl p-7 text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 text-8xl opacity-[0.05] leading-none select-none">📋</div>
            <div className="relative z-10">
              <div className="text-2xl mb-3">👷</div>
              <h3 className="text-lg font-bold mb-2">É profissional?</h3>
              <p className="text-white/70 text-sm mb-5">
                Receba orçamentos qualificados pela IA e formalize seus serviços.
              </p>
              <Link to="/auth?tipo=prestador"
                className="inline-flex items-center gap-2 bg-white text-success px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                Cadastrar grátis <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL SERVIÇO */}
      {servicoSelecionado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setServicoSelecionado(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span>{servicoSelecionado.categorias?.icone || '🔧'}</span>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    {servicoSelecionado.categorias?.nome}
                  </span>
                </div>
                <h3 className="font-bold text-primary">{servicoSelecionado.titulo}</h3>
              </div>
              <button onClick={() => setServicoSelecionado(null)}
                className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Badge orça online */}
              {(servicoSelecionado.aceita_orcamento_online || servicoSelecionado.prestadores?.aceita_orcamento_online) && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                  💬 <strong>Orçamento sem visita</strong> — com fotos e detalhes o profissional orça remotamente.
                </div>
              )}

              {/* Descrição */}
              {servicoSelecionado.descricao && (
                <p className="text-sm text-muted-foreground leading-relaxed">{servicoSelecionado.descricao}</p>
              )}

              {/* Valor */}
              {servicoSelecionado.tipo === 'fixo' && servicoSelecionado.valor_fixo ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-1">Valor do serviço</div>
                  <div className="text-2xl font-bold text-success">
                    R$ {Number(servicoSelecionado.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-border rounded-xl p-4 text-sm text-muted-foreground">
                  💬 Valor sob orçamento — o profissional avalia e envia a proposta.
                </div>
              )}

              {/* Profissional */}
              <div className="border border-border rounded-xl p-4">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Profissional responsável
                </div>
                <div className="flex items-center gap-3">
                  {servicoSelecionado.prestadores?.foto_url ? (
                    <img src={servicoSelecionado.prestadores.foto_url}
                      className="w-12 h-12 rounded-full object-cover border-2 border-primary/10" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                      {servicoSelecionado.prestadores?.nome?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-primary">{servicoSelecionado.prestadores?.nome}</div>
                    {servicoSelecionado.prestadores?.cidade && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />{servicoSelecionado.prestadores.cidade}
                      </div>
                    )}
                    {servicoSelecionado.prestadores?.verificado && (
                      <span className="inline-flex items-center gap-1 text-xs bg-success/10 text-success font-bold px-2 py-0.5 rounded-full mt-1.5">
                        <Shield className="h-3 w-3" /> Verificado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* DOIS BOTÕES */}
              <div className="grid grid-cols-2 gap-3">
                <a href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                  '#SERVICO:' + servicoSelecionado.id +
                  '\n\nOlá! 👋 Vim pelo site do *Serviço Seguro* e tenho interesse em:\n\n🔧 ' + servicoSelecionado.titulo +
                  '\n📂 Categoria: ' + (servicoSelecionado.categorias?.nome || '') +
                  '\n\nPode me ajudar com um orçamento?'
                )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 bg-[#25D366] hover:bg-[#20c05c] text-white py-4 rounded-xl font-bold transition-colors text-center">
                  <span className="text-xl">📱</span>
                  <span className="text-sm">Via WhatsApp</span>
                  <span className="text-xs opacity-80">Atendimento imediato</span>
                </a>

                <a href={`/orcamento?servico=${servicoSelecionado.id}&nome=${encodeURIComponent(servicoSelecionado.titulo)}&cat=${encodeURIComponent(servicoSelecionado.categorias?.nome || '')}`}
                  className="flex flex-col items-center gap-1.5 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-bold transition-colors text-center">
                  <span className="text-xl">💬</span>
                  <span className="text-sm">Via Chat</span>
                  <span className="text-xs opacity-80">IA coleta os detalhes</span>
                </a>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Ambos os canais são atendidos pela nossa IA 🤖
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-6 px-4 text-center text-xs text-muted-foreground">
        © 2026 Serviço Seguro · {cidade} ·
        <Link to="/como-funciona" className="hover:text-primary ml-2">Como funciona</Link> ·
        <Link to="/admin" className="hover:text-primary ml-2">Admin</Link>
      </footer>
    </div>
  );
}
