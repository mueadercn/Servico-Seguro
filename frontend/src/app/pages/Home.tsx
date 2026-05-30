import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Shield, Star, Smartphone, MapPin, ChevronRight, CheckCircle2, FileText, Users, Zap } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase } from '../../lib/supabase';

const CIDADES = ['Santa Maria', 'Passo Fundo', 'Porto Alegre', 'Pelotas'];

const CATEGORIAS = [
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
  const [cidade, setCidade] = useState('Santa Maria');
  const [stats, setStats] = useState({ prestadores: 0, servicos: 0 });

  useEffect(() => {
    supabase.from('prestadores').select('id', { count: 'exact' }).eq('ativo', true).eq('verificado', true)
      .then(({ count }) => setStats(s => ({ ...s, prestadores: count || 0 })));
    supabase.from('servicos').select('id', { count: 'exact' }).eq('ativo', true)
      .then(({ count }) => setStats(s => ({ ...s, servicos: count || 0 })));
  }, []);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/busca?q=${encodeURIComponent(busca)}&cidade=${encodeURIComponent(cidade)}`);
  }

  function buscarCategoria(cat: string) {
    navigate(`/busca?cat=${encodeURIComponent(cat)}&cidade=${encodeURIComponent(cidade)}`);
  }

  return (
    <div className="min-h-screen bg-white">

      {/* HEADER MÍNIMO */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo className="h-8" />
          <div className="flex items-center gap-2">
            <Link to="/como-funciona" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Como funciona
            </Link>
            <Link to="/auth?tipo=prestador" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block px-3">
              Sou profissional
            </Link>
            <Link to="/auth" className="text-sm bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors font-medium">
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* HERO — DIRETO AO PONTO */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-2xl mx-auto text-center">

          <h1 className="text-4xl md:text-5xl font-bold text-primary mb-3 leading-tight">
            Encontre profissionais<br />
            <span className="text-success">verificados</span> perto de você
          </h1>
          <p className="text-muted-foreground mb-8 text-base">
            Com contrato digital e segurança jurídica.
          </p>

          {/* BUSCA */}
          <form onSubmit={buscar} className="bg-white border border-slate-200 rounded-2xl shadow-lg p-2 flex flex-col sm:flex-row gap-2">
            {/* Cidade */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl sm:w-44 flex-shrink-0">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <select value={cidade} onChange={e => setCidade(e.target.value)}
                className="bg-transparent text-sm outline-none w-full text-foreground">
                {CIDADES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Divisor */}
            <div className="hidden sm:block w-px bg-slate-200 my-1" />

            {/* Busca */}
            <div className="flex items-center gap-2 flex-1 px-3">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="O que você precisa? Ex: eletricista"
                className="flex-1 py-2 text-sm outline-none bg-transparent placeholder:text-muted-foreground" />
            </div>

            <button type="submit"
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors flex-shrink-0">
              Buscar
            </button>
          </form>

          {/* CATEGORIAS RÁPIDAS */}
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            {CATEGORIAS.map(c => (
              <button key={c.nome} onClick={() => buscarCategoria(c.nome)}
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
              <span><strong className="text-foreground">{stats.prestadores || '10'}+</strong> profissionais verificados</span>
            </div>
            <div className="text-slate-300">·</div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-success" />
              <span>Contrato em todo serviço</span>
            </div>
          </div>
        </div>
      </section>

      {/* SELOS DE CONFIANÇA */}
      <section className="py-8 border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { ic: '🤳', titulo: 'Biometria facial', sub: 'Identidade confirmada' },
              { ic: '📄', titulo: 'Contrato digital', sub: 'Validade jurídica' },
              { ic: '⭐', titulo: 'Avaliações reais', sub: 'Clientes verificados' },
              { ic: '💬', titulo: 'Orçamento pela IA', sub: 'Rápido e preciso' },
            ].map(s => (
              <div key={s.titulo} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3">
                <span className="text-xl flex-shrink-0">{s.ic}</span>
                <div>
                  <div className="text-xs font-bold text-primary">{s.titulo}</div>
                  <div className="text-xs text-muted-foreground">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA DUPLO */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-5">

          {/* Para contratante */}
          <div className="bg-primary rounded-2xl p-7 text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 text-8xl opacity-[0.06] leading-none select-none">🔧</div>
            <div className="relative z-10">
              <div className="text-2xl mb-3">👤</div>
              <h3 className="text-lg font-bold mb-2">Precisa de um serviço?</h3>
              <p className="text-white/70 text-sm mb-5 leading-relaxed">
                Encontre profissionais verificados, feche com contrato e tenha tudo documentado.
              </p>
              <Link to="/busca?cidade=Santa Maria"
                className="inline-flex items-center gap-2 bg-white text-primary px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                Buscar profissional <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Para prestador */}
          <div className="bg-success rounded-2xl p-7 text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 text-8xl opacity-[0.06] leading-none select-none">📋</div>
            <div className="relative z-10">
              <div className="text-2xl mb-3">👷</div>
              <h3 className="text-lg font-bold mb-2">É profissional?</h3>
              <p className="text-white/70 text-sm mb-5 leading-relaxed">
                Receba orçamentos qualificados pela IA, formalize seus serviços e construa sua reputação.
              </p>
              <Link to="/auth?tipo=prestador"
                className="inline-flex items-center gap-2 bg-white text-success px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                Cadastrar grátis <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* LINK PARA COMO FUNCIONA */}
      <section className="pb-16 px-4 text-center">
        <Link to="/como-funciona"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors border border-slate-200 hover:border-primary/30 px-5 py-2.5 rounded-xl">
          Saiba como funciona <ChevronRight className="h-4 w-4" />
        </Link>
      </section>

      {/* FOOTER MÍNIMO */}
      <footer className="border-t border-slate-100 py-6 px-4 text-center text-xs text-muted-foreground">
        © 2026 Serviço Seguro · Santa Maria RS ·
        <Link to="/como-funciona" className="hover:text-primary ml-2">Como funciona</Link> ·
        <Link to="/admin" className="hover:text-primary ml-2">Admin</Link>
      </footer>
    </div>
  );
}
