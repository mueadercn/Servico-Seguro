import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { LayoutDashboard, ClipboardList, FileText, Star, User, LogOut, Plus, Clock, CheckCircle2, Shield } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase, getContratante, logout } from '../../lib/supabase';

const navItems = [
  { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
  { id: 'orcamentos', label: 'Meus Orçamentos', icon: ClipboardList },
  { id: 'contratos', label: 'Contratos', icon: FileText },
  { id: 'avaliacoes', label: 'Avaliações', icon: Star },
  { id: 'perfil', label: 'Meu Perfil', icon: User },
];

export function ClientDashboard() {
  const navigate = useNavigate();
  const contratante = getContratante();
  const [aba, setAba] = useState('dashboard');
  const [orcs, setOrcs] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [perfil, setPerfil] = useState<any>(null);

  useEffect(() => {
    if (!contratante) { navigate('/auth'); return; }
    carregarTudo();
  }, []);

  async function carregarTudo() {
    if (!contratante) return;
    const [oRes, pRes] = await Promise.all([
      supabase.from('orcs').select('*').eq('usuario_id', contratante.id).order('criado_em', { ascending: false }),
      supabase.from('usuarios').select('*').eq('id', contratante.id).limit(1),
    ]);
    const orcData = oRes.data || [];
    setOrcs(orcData);
    if (pRes.data?.[0]) setPerfil(pRes.data[0]);

    if (orcData.length) {
      const ids = orcData.map((o: any) => o.id);
      const { data: cData } = await supabase.from('contratos').select('*, orcs(codigo)').in('orc_id', ids);
      setContratos(cData || []);
    }
    setLoading(false);
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      'NOVO': 'bg-blue-100 text-blue-800', 'ANAMNESE CONCLUÍDA': 'bg-blue-100 text-blue-800',
      'AGUARDANDO PRESTADOR': 'bg-amber-100 text-amber-800', 'VISITA AGENDADA': 'bg-amber-100 text-amber-800',
      'FECHADO': 'bg-success/15 text-success', 'CONTRATO ASSINADO': 'bg-success/15 text-success', 'ENCERRADO': 'bg-success/15 text-success',
      'CANCELADO': 'bg-red-100 text-red-800',
    };
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SIDEBAR */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-[#0B1E3D] z-40 flex flex-col transition-transform lg:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-white/10"><Link to="/"><Logo className="h-8" /></Link></div>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/30 flex items-center justify-center text-white font-bold text-lg">
              {(contratante?.nome || 'C').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate text-sm text-white">{contratante?.nome}</div>
              <div className="text-xs text-white/50">Contratante</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setAba(id); setMobileMenu(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${aba === id ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all">
            <LogOut className="h-4 w-4" />Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenu(!mobileMenu)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
              <LayoutDashboard className="h-5 w-5" />
            </button>
            <h1 className="font-bold text-primary">{navItems.find(n => n.id === aba)?.label || 'Início'}</h1>
          </div>
          <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">👤 Contratante</span>
        </div>

        <div className="p-6 flex-1">

          {/* DASHBOARD */}
          {aba === 'dashboard' && (
            <div>
              {/* CTA */}
              <div className="bg-gradient-to-br from-primary to-[#0d2847] rounded-2xl p-6 text-white mb-6 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 text-8xl opacity-[0.06] leading-none">🛡️</div>
                <h3 className="text-xl font-bold mb-2 relative z-10">Precisa de um serviço?</h3>
                <p className="text-white/70 text-sm mb-4 relative z-10">Solicite um orçamento agora. Nossa IA coleta as informações e conecta você ao profissional certo.</p>
                <Link to="/" className="inline-flex items-center gap-2 bg-success text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-success/90 transition-colors relative z-10">
                  <Plus className="h-4 w-4" /> Buscar serviços
                </Link>
              </div>

              {/* STATS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { l: 'Orçamentos', v: orcs.length, i: ClipboardList, c: 'text-blue-600 bg-blue-50' },
                  { l: 'Contratos', v: contratos.filter(c => c.assinado_cliente && c.assinado_prestador).length, i: FileText, c: 'text-success bg-success/10' },
                  { l: 'Em andamento', v: orcs.filter(o => ['CONTRATO ASSINADO'].includes(o.status)).length, i: Clock, c: 'text-amber-600 bg-amber-50' },
                  { l: 'Concluídos', v: orcs.filter(o => o.status === 'ENCERRADO').length, i: CheckCircle2, c: 'text-emerald-600 bg-emerald-50' },
                ].map(s => (
                  <div key={s.l} className="bg-white rounded-2xl border p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground font-medium">{s.l}</span>
                      <div className={`p-2 rounded-lg ${s.c}`}><s.i className="h-4 w-4" /></div>
                    </div>
                    <div className="text-2xl font-bold text-primary">{s.v}</div>
                  </div>
                ))}
              </div>

              {/* ORÇAMENTOS RECENTES */}
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <h2 className="font-bold text-primary">Orçamentos recentes</h2>
                  <button onClick={() => setAba('orcamentos')} className="text-sm text-primary hover:underline">Ver todos</button>
                </div>
                {orcs.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="mb-4">Nenhum orçamento ainda.</p>
                    <Link to="/" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold">Solicitar primeiro orçamento</Link>
                  </div>
                ) : (
                  <div className="divide-y">
                    {orcs.slice(0,3).map((o: any) => (
                      <div key={o.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-primary font-mono text-sm">{o.codigo}</span>
                          {statusBadge(o.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{o.resumo_anamnese?.substring(0,80) || 'Aguardando informações...'}</p>
                        <div className="text-xs text-muted-foreground mt-1">{o.criado_em ? new Date(o.criado_em).toLocaleDateString('pt-BR') : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ORÇAMENTOS */}
          {aba === 'orcamentos' && (
            <div className="space-y-3">
              {orcs.length === 0 ? (
                <div className="bg-white rounded-2xl border py-16 text-center text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum orçamento ainda.</p>
                </div>
              ) : orcs.map((o: any) => (
                <div key={o.id} className="bg-white rounded-2xl border p-5 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-primary font-mono">{o.codigo}</span>
                    <div className="flex items-center gap-2">
                      {statusBadge(o.status)}
                      <span className="text-xs text-muted-foreground">{o.canal === 'whatsapp' ? '📱' : '💻'}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{o.resumo_anamnese || 'Aguardando informações...'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{o.criado_em ? new Date(o.criado_em).toLocaleDateString('pt-BR') : ''}</span>
                    {o.valor_final && <span className="font-bold text-success">R$ {Number(o.valor_final).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CONTRATOS */}
          {aba === 'contratos' && (
            <div className="space-y-3">
              {contratos.length === 0 ? (
                <div className="bg-white rounded-2xl border py-16 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum contrato ainda.</p>
                </div>
              ) : contratos.map((c: any) => (
                <div key={c.id} className="bg-white rounded-2xl border overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b flex items-center justify-between">
                    <span className="font-bold text-primary font-mono text-sm">{c.orcs?.codigo}</span>
                    <div className="flex gap-2">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        {c.tipo === 'carta_aceite' ? '📜 Carta Aceite' : '🛡️ Contrato Seguro'}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.assinado_cliente && c.assinado_prestador ? 'bg-success/15 text-success' : 'bg-amber-100 text-amber-800'}`}>
                        {c.assinado_cliente && c.assinado_prestador ? '✓ Assinado' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><div className="text-xs text-muted-foreground mb-1">Valor</div><div className="font-bold text-success">R$ {Number(c.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
                      <div><div className="text-xs text-muted-foreground mb-1">Sua assinatura</div><div>{c.assinado_cliente ? '✅' : '⏳ Pendente'}</div></div>
                      <div><div className="text-xs text-muted-foreground mb-1">Data</div><div>{c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '—'}</div></div>
                    </div>
                    {!c.assinado_cliente && (
                      <Link to={`/contrato?id=${c.id}`} className="inline-flex items-center gap-2 mt-4 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                        ✍️ Assinar contrato
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PERFIL */}
          {aba === 'perfil' && perfil && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="px-6 py-4 border-b"><h2 className="font-bold text-primary">Meu Perfil</h2></div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { l: 'Nome', v: perfil.nome }, { l: 'Email', v: perfil.email },
                      { l: 'WhatsApp', v: perfil.telefone }, { l: 'CPF', v: perfil.cpf || '—' },
                      { l: 'Cidade', v: perfil.cidade }, { l: 'Estado', v: perfil.estado },
                    ].map(f => (
                      <div key={f.l}>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{f.l}</div>
                        <div className="text-sm font-medium">{f.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-4">
                    <div className="font-bold text-primary mb-3">Verificação de Identidade</div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { ico: '📋', l: 'CPF', ok: !!perfil.cpf },
                        { ico: '🪪', l: 'Documento', ok: false },
                        { ico: '🤳', l: 'Biometria', ok: false },
                      ].map(s => (
                        <div key={s.l} className={`text-center border rounded-xl p-3 ${s.ok ? 'border-success bg-success/5' : 'opacity-50'}`}>
                          <div className="text-xl mb-1">{s.ico}</div>
                          <div className="text-xs font-bold text-primary">{s.l}</div>
                          <div className="text-xs text-muted-foreground">{s.ok ? '✓ OK' : 'Pendente'}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                      🔒 <strong>Em breve:</strong> A verificação biométrica será necessária para contratos do tipo Serviço Seguro.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {mobileMenu && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileMenu(false)} />}
    </div>
  );
}
