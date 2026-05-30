import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  LayoutDashboard, ClipboardList, FileText, Star, User, LogOut,
  Plus, TrendingUp, CheckCircle2, DollarSign, Clock, Settings, Shield
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase, getPrestador, logout } from '../../lib/supabase';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Meus Leads', icon: ClipboardList },
  { id: 'servicos', label: 'Meus Serviços', icon: Settings },
  { id: 'contratos', label: 'Contratos', icon: FileText },
  { id: 'avaliacoes', label: 'Avaliações', icon: Star },
  { id: 'perfil', label: 'Meu Perfil', icon: User },
];

export function ProviderDashboard() {
  const navigate = useNavigate();
  const prestador = getPrestador();
  const [aba, setAba] = useState('dashboard');
  const [leads, setLeads] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (!prestador) { navigate('/auth'); return; }
    carregarTudo();
  }, []);

  async function carregarTudo() {
    if (!prestador) return;
    const [lRes, sRes, avRes, pRes] = await Promise.all([
      supabase.from('orcs').select('*').eq('prestador_id', prestador.id).order('criado_em', { ascending: false }),
      supabase.from('servicos').select('*, categorias(nome,icone)').eq('prestador_id', prestador.id).order('criado_em', { ascending: false }),
      supabase.from('avaliacoes').select('*').eq('avaliado_id', prestador.id).order('criado_em', { ascending: false }),
      supabase.from('prestadores').select('*').eq('id', prestador.id).limit(1),
    ]);
    setLeads(lRes.data || []);
    setServicos(sRes.data || []);
    setAvaliacoes(avRes.data || []);
    if (pRes.data?.[0]) setPerfil(pRes.data[0]);
    setLoading(false);
  }

  const stats = [
    { label: 'Leads Recebidos', value: leads.length, icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'Contratos Ativos', value: leads.filter(l => l.status === 'CONTRATO ASSINADO').length, icon: CheckCircle2, color: 'text-success bg-success/10' },
    { label: 'Minha Nota', value: avaliacoes.length ? (avaliacoes.reduce((a,v) => a+v.nota,0)/avaliacoes.length).toFixed(1) : '—', icon: Star, color: 'text-amber-600 bg-amber-50' },
    { label: 'Serviços Fechados', value: leads.filter(l => l.status === 'ENCERRADO').length, icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  ];

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      'NOVO': 'bg-blue-100 text-blue-800', 'EM ANAMNESE': 'bg-blue-100 text-blue-800',
      'ANAMNESE CONCLUÍDA': 'bg-blue-100 text-blue-800', 'PRESTADOR NOTIFICADO': 'bg-amber-100 text-amber-800',
      'AGUARDANDO PRESTADOR': 'bg-amber-100 text-amber-800', 'VISITA AGENDADA': 'bg-amber-100 text-amber-800',
      'FECHADO': 'bg-success/15 text-success', 'CONTRATO ASSINADO': 'bg-success/15 text-success',
      'ENCERRADO': 'bg-success/15 text-success', 'CANCELADO': 'bg-red-100 text-red-800',
    };
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SIDEBAR */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-white border-r z-40 flex flex-col transition-transform lg:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b"><Link to="/"><Logo className="h-8" /></Link></div>
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-success/10 flex items-center justify-center text-success font-bold text-lg">
              {(prestador?.nome || 'P').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate text-sm">{prestador?.nome}</div>
              <div className="text-xs text-muted-foreground">Profissional</div>
            </div>
          </div>
          {perfil?.verificado && (
            <div className="flex items-center gap-1 mt-2 text-xs text-success font-semibold">
              <Shield className="h-3 w-3" /> Identidade verificada
            </div>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setAba(id); setMobileMenu(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${aba === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-all">
            <LogOut className="h-4 w-4" />Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* TOPBAR */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenu(!mobileMenu)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
              <LayoutDashboard className="h-5 w-5" />
            </button>
            <h1 className="font-bold text-primary">{navItems.find(n => n.id === aba)?.label || 'Dashboard'}</h1>
          </div>
          <span className="bg-success text-white text-xs font-bold px-3 py-1 rounded-full">👷 Profissional</span>
        </div>

        <div className="p-6 flex-1">

          {/* DASHBOARD */}
          {aba === 'dashboard' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map(s => (
                  <div key={s.label} className="bg-white rounded-2xl border p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
                      <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="h-4 w-4" /></div>
                    </div>
                    <div className="text-2xl font-bold text-primary">{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <h2 className="font-bold text-primary">Leads recentes</h2>
                  <button onClick={() => setAba('leads')} className="text-sm text-primary hover:underline">Ver todos</button>
                </div>
                {leads.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhum lead ainda.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>{['Código','Resumo','Cliente','Status','Data'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y">
                        {leads.slice(0,5).map((l: any) => (
                          <tr key={l.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3 font-bold text-primary font-mono text-xs">{l.codigo}</td>
                            <td className="px-5 py-3 text-muted-foreground max-w-xs truncate">{l.resumo_anamnese?.substring(0,50) || '—'}</td>
                            <td className="px-5 py-3 font-medium">{l.nome_cliente || '—'}</td>
                            <td className="px-5 py-3">{statusBadge(l.status)}</td>
                            <td className="px-5 py-3 text-muted-foreground text-xs">{l.criado_em ? new Date(l.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LEADS */}
          {aba === 'leads' && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-primary">Todos os Leads</h2>
              </div>
              {leads.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum lead recebido ainda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>{['Código','Serviço','Cliente','Canal','Status','Data'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {leads.map((l: any) => (
                        <tr key={l.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-bold text-primary font-mono text-xs">{l.codigo}</td>
                          <td className="px-5 py-3">{l.resumo_anamnese?.substring(0,40) || '—'}</td>
                          <td className="px-5 py-3 font-medium">{l.nome_cliente || '—'}</td>
                          <td className="px-5 py-3">{l.canal === 'whatsapp' ? '📱 WhatsApp' : '💻 Site'}</td>
                          <td className="px-5 py-3">{statusBadge(l.status)}</td>
                          <td className="px-5 py-3 text-muted-foreground text-xs">{l.criado_em ? new Date(l.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SERVIÇOS */}
          {aba === 'servicos' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-primary">Meus Serviços ({servicos.length})</h2>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-success text-white rounded-xl text-sm font-semibold hover:bg-success/90 transition-colors">
                  <Plus className="h-4 w-4" /> Novo Serviço
                </button>
              </div>
              {servicos.length === 0 ? (
                <div className="bg-white rounded-2xl border py-16 text-center text-muted-foreground">
                  <Settings className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum serviço cadastrado.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {servicos.map((s: any) => (
                    <div key={s.id} className="bg-white rounded-2xl border p-5 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                            {s.categorias?.icone || '🔧'}
                          </div>
                          <div>
                            <div className="font-bold text-primary">{s.titulo}</div>
                            <div className="text-xs text-muted-foreground">{s.categorias?.nome}</div>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.ativo ? 'bg-success/15 text-success' : 'bg-red-100 text-red-600'}`}>
                          {s.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      {s.descricao && <p className="text-sm text-muted-foreground">{s.descricao}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AVALIAÇÕES */}
          {aba === 'avaliacoes' && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="font-bold text-primary">Minhas Avaliações</h2>
                {avaliacoes.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Média: <strong className="text-primary">⭐ {(avaliacoes.reduce((a,v) => a+v.nota,0)/avaliacoes.length).toFixed(1)}</strong>
                  </div>
                )}
              </div>
              {avaliacoes.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma avaliação ainda.</p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {avaliacoes.map((av: any) => (
                    <div key={av.id} className="border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">Cliente verificado</span>
                        <span className="text-amber-500">{'⭐'.repeat(av.nota)}</span>
                      </div>
                      {av.comentario && <p className="text-sm text-muted-foreground">{av.comentario}</p>}
                      <p className="text-xs text-muted-foreground mt-2">{av.criado_em ? new Date(av.criado_em).toLocaleDateString('pt-BR') : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PERFIL */}
          {aba === 'perfil' && perfil && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <h2 className="font-bold text-primary">Meu Perfil</h2>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${perfil.verificado ? 'bg-success/15 text-success' : 'bg-amber-100 text-amber-800'}`}>
                    {perfil.verificado ? '🤳 Verificado' : '⏳ Pendente'}
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { l: 'Nome', v: perfil.nome },
                      { l: 'Email', v: perfil.email },
                      { l: 'WhatsApp', v: perfil.telefone },
                      { l: 'CPF', v: perfil.cpf || '—' },
                      { l: 'Cidade', v: perfil.cidade },
                      { l: 'Estado', v: perfil.estado },
                    ].map(f => (
                      <div key={f.l}>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{f.l}</div>
                        <div className="text-sm font-medium">{f.v}</div>
                      </div>
                    ))}
                  </div>
                  {perfil.bio && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sobre</div>
                      <div className="text-sm">{perfil.bio}</div>
                    </div>
                  )}

                  {/* Verificação */}
                  <div className="border-t pt-4 mt-4">
                    <div className="font-bold text-primary mb-3">Verificação de Identidade</div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { ico: '📋', l: 'CPF', ok: !!perfil.cpf },
                        { ico: '🪪', l: 'Documento', ok: false },
                        { ico: '🤳', l: 'Biometria', ok: perfil.verificado },
                      ].map(s => (
                        <div key={s.l} className={`text-center border rounded-xl p-3 ${s.ok ? 'border-success bg-success/5' : 'opacity-50'}`}>
                          <div className="text-xl mb-1">{s.ico}</div>
                          <div className="text-xs font-bold text-primary">{s.l}</div>
                          <div className="text-xs text-muted-foreground">{s.ok ? '✓ OK' : 'Pendente'}</div>
                        </div>
                      ))}
                    </div>
                    {!perfil.verificado && (
                      <Link to="/biometria" className="inline-flex items-center gap-2 bg-success text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-success/90 transition-colors">
                        🤳 Verificar identidade agora
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Mobile overlay */}
      {mobileMenu && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileMenu(false)} />}
    </div>
  );
}
