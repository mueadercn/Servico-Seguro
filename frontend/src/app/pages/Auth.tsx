import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Shield, ArrowLeft, Mail, Lock, User, Phone, MapPin, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase } from '../../lib/supabase';

export function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [tipo, setTipo] = useState<'contratante' | 'prestador'>(
    params.get('tipo') === 'prestador' ? 'prestador' : 'contratante'
  );
  const [step, setStep] = useState(1);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [categorias, setCategorias] = useState<any[]>([]);

  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', cpf: '', cidade: 'Santa Maria',
    senha: '', senha2: '', bio: '', aceita_online: false,
    categorias: [] as string[],
  });

  useEffect(() => {
    supabase.from('categorias').select('id,nome,icone').eq('ativa', true).order('nome')
      .then(({ data }) => { if (data) setCategorias(data); });
    if (params.get('tipo') === 'prestador') setMode('register');
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function handleLogin() {
    if (!form.email || !form.senha) { setErro('Preencha email e senha.'); return; }
    setLoading(true); setErro('');
    try {
      const tabela = tipo === 'prestador' ? 'prestador_auth' : 'contratante_auth';
      const join = tipo === 'prestador' ? 'prestadores(nome)' : 'usuarios(nome)';
      const { data, error } = await supabase.from(tabela)
        .select(`id, ${tipo === 'prestador' ? 'prestador_id' : 'usuario_id'}, senha_hash, ${join}`)
        .eq('email', form.email.toLowerCase())
        .eq('ativo', true).limit(1);

      if (error || !data?.length) { setErro('Email não encontrado.'); setLoading(false); return; }
      const reg = data[0];
      if (reg.senha_hash !== btoa(form.senha.trim())) { setErro('Senha incorreta.'); setLoading(false); return; }

      const idKey = tipo === 'prestador' ? 'prestador_id' : 'usuario_id';
      const nomeData = tipo === 'prestador' ? (reg as any).prestadores : (reg as any).usuarios;
      const lsKey = tipo === 'prestador' ? 'ss_prestador' : 'ss_contratante';
      localStorage.setItem(lsKey, JSON.stringify({ id: reg[idKey], nome: nomeData?.nome, email: form.email }));

      await supabase.from(tabela).update({ ultimo_acesso: new Date().toISOString() }).eq('id', reg.id);
      navigate(tipo === 'prestador' ? '/prestador' : '/contratante');
    } catch (e: any) { setErro(e.message); }
    setLoading(false);
  }

  async function handleRegister() {
    if (!form.nome || !form.email || !form.telefone) { setErro('Preencha os campos obrigatórios.'); return; }
    if (form.senha.length < 6) { setErro('Senha mínima de 6 caracteres.'); return; }
    if (form.senha !== form.senha2) { setErro('As senhas não coincidem.'); return; }
    setLoading(true); setErro('');
    try {
      if (tipo === 'contratante') {
        const { data: exist } = await supabase.from('contratante_auth').select('id').eq('email', form.email.toLowerCase()).limit(1);
        if (exist?.length) { setErro('Email já cadastrado.'); setLoading(false); return; }
        const { data: u } = await supabase.from('usuarios').insert({
          nome: form.nome, email: form.email.toLowerCase(), telefone: form.telefone,
          cpf: form.cpf || null, cidade: form.cidade, estado: 'RS', ativo: true
        }).select('id');
        if (!u?.length) throw new Error('Erro ao criar usuário');
        await supabase.from('contratante_auth').insert({ usuario_id: u[0].id, email: form.email.toLowerCase(), senha_hash: btoa(form.senha), ativo: true });
        localStorage.setItem('ss_contratante', JSON.stringify({ id: u[0].id, nome: form.nome, email: form.email }));
        navigate('/contratante');
      } else {
        const { data: exist } = await supabase.from('prestador_auth').select('id').eq('email', form.email.toLowerCase()).limit(1);
        if (exist?.length) { setErro('Email já cadastrado.'); setLoading(false); return; }
        const { data: p } = await supabase.from('prestadores').insert({
          nome: form.nome, email: form.email.toLowerCase(), telefone: form.telefone,
          cpf: form.cpf || null, cidade: form.cidade, estado: 'RS',
          bio: form.bio || null, ativo: true, verificado: false,
          aceita_orcamento_online: form.aceita_online
        }).select('id');
        if (!p?.length) throw new Error('Erro ao criar prestador');
        await supabase.from('prestador_auth').insert({ prestador_id: p[0].id, email: form.email.toLowerCase(), senha_hash: btoa(form.senha), ativo: true });
        localStorage.setItem('ss_prestador', JSON.stringify({ id: p[0].id, nome: form.nome, email: form.email }));
        navigate('/prestador');
      }
    } catch (e: any) { setErro(e.message); }
    setLoading(false);
  }

  const toggleCat = (id: string) => {
    set('categorias', form.categorias.includes(id) ? form.categorias.filter(c => c !== id) : [...form.categorias, id]);
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-[#0d2847] to-primary p-12 flex-col justify-center text-white relative">
        <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /><span className="text-sm">Voltar</span>
        </Link>
        <div className="max-w-md">
          <div className="mb-8 bg-white p-4 rounded-2xl inline-block"><Logo className="h-12" showText={false} /></div>
          <h1 className="text-4xl font-bold mb-4">Bem-vindo ao<br /><span className="text-success">Serviço Seguro</span></h1>
          <p className="text-white/60 mb-8">A plataforma que conecta você aos melhores profissionais com segurança e transparência.</p>
          <div className="space-y-4">
            {[
              { t: 'Profissionais Verificados', d: 'Todos passam por verificação de identidade' },
              { t: 'Contrato Digital', d: 'Validade jurídica em qualquer instância' },
              { t: 'IA no Atendimento', d: 'Orçamentos qualificados sem esforço' },
            ].map(f => (
              <div key={f.t} className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-success/20"><Shield className="h-5 w-5 text-success" /></div>
                <div><h3 className="font-semibold mb-0.5">{f.t}</h3><p className="text-sm text-white/50">{f.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6">
            <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /><span className="text-sm">Voltar</span>
            </Link>
          </div>

          <h2 className="text-3xl font-bold mb-2">{mode === 'login' ? 'Entrar' : 'Criar Conta'}</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            {mode === 'login' ? 'Entre com suas credenciais' : 'Preencha seus dados para começar'}
          </p>

          {/* TIPO */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[['contratante', '👤', 'Contratante', 'Contratar serviços'], ['prestador', '👷', 'Profissional', 'Oferecer serviços']].map(([v, ic, lb, sub]) => (
              <button key={v} onClick={() => setTipo(v as any)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${tipo === v ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <span className="text-2xl block mb-1">{ic}</span>
                <div className="font-semibold text-sm">{lb}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </button>
            ))}
          </div>

          {/* TABS */}
          <div className="flex bg-muted rounded-xl p-1 mb-6">
            {[['login', 'Entrar'], ['register', 'Criar conta']].map(([v, lb]) => (
              <button key={v} onClick={() => { setMode(v as any); setStep(1); setErro(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === v ? 'bg-white shadow text-primary' : 'text-muted-foreground'}`}>
                {lb}
              </button>
            ))}
          </div>

          {erro && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-xl mb-4">
              ❌ {erro}
            </div>
          )}

          {/* LOGIN */}
          {mode === 'login' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type={showPwd ? 'text' : 'password'} value={form.senha} onChange={e => set('senha', e.target.value)}
                    placeholder="••••••••"
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full pl-10 pr-10 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button onClick={handleLogin} disabled={loading}
                className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors mt-2">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <p className="text-center text-sm text-muted-foreground">
                Não tem conta?{' '}
                <button onClick={() => setMode('register')} className="text-primary font-semibold hover:underline">Criar agora</button>
              </p>
            </div>
          )}

          {/* REGISTER */}
          {mode === 'register' && (
            <div className="space-y-4">
              {/* Progress */}
              {tipo === 'prestador' && (
                <div className="flex gap-1 mb-2">
                  {[1,2,3].map(i => (
                    <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${step >= i ? 'bg-primary' : 'bg-border'}`} />
                  ))}
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Nome completo *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)}
                        placeholder="Seu nome completo"
                        className="w-full pl-10 pr-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full pl-10 pr-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">WhatsApp *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="tel" value={form.telefone} onChange={e => set('telefone', e.target.value)}
                        placeholder="(55) 99999-0000"
                        className="w-full pl-10 pr-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">CPF</label>
                      <input type="text" value={form.cpf} onChange={e => set('cpf', e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full px-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Cidade</label>
                      <select value={form.cidade} onChange={e => set('cidade', e.target.value)}
                        className="w-full px-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm">
                        <option>Santa Maria</option><option>Passo Fundo</option><option>Porto Alegre</option>
                      </select>
                    </div>
                  </div>
                  {tipo === 'prestador' && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Sobre você</label>
                      <input type="text" value={form.bio} onChange={e => set('bio', e.target.value)}
                        placeholder="Ex: 10 anos de experiência em elétrica"
                        className="w-full px-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" />
                    </div>
                  )}
                </>
              )}

              {/* STEP 2 — Categorias (prestador) */}
              {step === 2 && tipo === 'prestador' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                      Selecione suas categorias *
                    </label>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {(categorias.length ? categorias : [
                        { id:'1', nome:'Instalações', icone:'⚡' },
                        { id:'2', nome:'Construção e Reforma', icone:'🏗️' },
                        { id:'3', nome:'Limpeza e Conservação', icone:'🧹' },
                      ]).map((c: any) => (
                        <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.categorias.includes(c.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                          <input type="checkbox" checked={form.categorias.includes(c.id)} onChange={() => toggleCat(c.id)} className="accent-primary" />
                          <span>{c.icone}</span>
                          <span className="text-sm font-medium">{c.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Aceita orçamento online?</label>
                    <select value={form.aceita_online ? 'true' : 'false'} onChange={e => set('aceita_online', e.target.value === 'true')}
                      className="w-full px-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm">
                      <option value="false">Não — preciso visitar o local</option>
                      <option value="true">Sim — consigo orçar com fotos</option>
                    </select>
                  </div>
                </>
              )}

              {/* STEP 3 — Senha (prestador) ou direto (contratante) */}
              {(step === 3 || (tipo === 'contratante' && step === 1)) && (
                <>
                  {tipo === 'contratante' && step === 1 && (
                    <div className="border-t pt-4 mt-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Criar senha</div>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Senha *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type={showPwd ? 'text' : 'password'} value={form.senha} onChange={e => set('senha', e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-10 pr-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Confirmar senha *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type={showPwd ? 'text' : 'password'} value={form.senha2} onChange={e => set('senha2', e.target.value)}
                        placeholder="Repita a senha"
                        className="w-full pl-10 pr-4 py-3 border rounded-xl bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" />
                    </div>
                  </div>
                </>
              )}

              {/* BTNS */}
              <div className="flex gap-3 pt-2">
                {((tipo === 'prestador' && step > 1)) && (
                  <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3 border rounded-xl font-semibold text-sm hover:bg-muted transition-colors">
                    ← Voltar
                  </button>
                )}
                {tipo === 'prestador' && step < 3 ? (
                  <button onClick={() => {
                    if (step === 1 && (!form.nome || !form.email || !form.telefone)) { setErro('Preencha nome, email e WhatsApp.'); return; }
                    if (step === 2 && !form.categorias.length) { setErro('Selecione ao menos uma categoria.'); return; }
                    setErro(''); setStep(s => s + 1);
                  }} className="flex-1 py-3 bg-success hover:bg-success/90 text-white rounded-xl font-semibold text-sm transition-colors">
                    Continuar →
                  </button>
                ) : (
                  <button onClick={handleRegister} disabled={loading}
                    className="flex-1 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors">
                    {loading ? 'Criando...' : 'Criar conta'}
                  </button>
                )}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{' '}
                <button onClick={() => { setMode('login'); setErro(''); }} className="text-primary font-semibold hover:underline">Entrar</button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
