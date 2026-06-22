import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import { supabase, getPrestador, getContratante } from '../../lib/supabase';

const TEAL = 'oklch(0.6 0.118 184.704)';
const TEAL_LIGHT = 'oklch(0.92 0.05 184)';

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
    // Redireciona quem já está logado
    const p = getPrestador();
    const c = getContratante();
    if (p?.id) { navigate('/prestador'); return; }
    if (c?.id) { navigate('/contratante'); return; }

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
      const join = tipo === 'prestador' ? 'prestadores(id,nome,email,telefone)' : 'usuarios(id,nome,email,telefone)';
      const { data, error } = await supabase.from(tabela)
        .select(`id, ${tipo === 'prestador' ? 'prestador_id' : 'usuario_id'}, senha_hash, ${join}`)
        .eq('email', form.email.toLowerCase())
        .eq('ativo', true).limit(1);

      if (error || !data?.length) { setErro('Email não encontrado.'); setLoading(false); return; }
      const reg = data[0];
      if (reg.senha_hash !== btoa(form.senha.trim())) { setErro('Senha incorreta.'); setLoading(false); return; }

      const idKey = tipo === 'prestador' ? 'prestador_id' : 'usuario_id';
      const perfil = tipo === 'prestador' ? (reg as any).prestadores : (reg as any).usuarios;
      const lsKey = tipo === 'prestador' ? 'ss_prestador' : 'ss_contratante';
      localStorage.setItem(lsKey, JSON.stringify({ id: reg[idKey], nome: perfil?.nome, email: form.email, telefone: perfil?.telefone }));

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
        localStorage.setItem('ss_contratante', JSON.stringify({ id: u[0].id, nome: form.nome, email: form.email, telefone: form.telefone }));
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
        localStorage.setItem('ss_prestador', JSON.stringify({ id: p[0].id, nome: form.nome, email: form.email, telefone: form.telefone }));
        navigate('/prestador');
      }
    } catch (e: any) { setErro(e.message); }
    setLoading(false);
  }

  const toggleCat = (id: string) => {
    set('categorias', form.categorias.includes(id) ? form.categorias.filter(c => c !== id) : [...form.categorias, id]);
  };

  /* ── Shared input classes ── */
  const inputCls = 'w-full px-4 py-3 border border-[#e2e8f0] rounded-[12px] bg-[#f8fafc] text-sm outline-none focus:border-[#030213] transition-colors';
  const inputWithIconCls = 'w-full pl-10 pr-4 py-3 border border-[#e2e8f0] rounded-[12px] bg-[#f8fafc] text-sm outline-none focus:border-[#030213] transition-colors';
  const labelCls = 'text-[11px] font-bold uppercase text-[#64748b] tracking-[0.04em] mb-1.5 block';

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-center p-[56px] text-white relative"
        style={{ background: 'linear-gradient(150deg, #030213, #16161f 55%, #030213)' }}
      >
        <Link
          to="/"
          className="absolute top-8 left-8 flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        {/* Logo */}
        <div className="w-16 h-16 bg-black rounded-[16px] flex items-center justify-center mb-8">
          <span className="text-3xl">🛡️</span>
        </div>

        {/* Headline */}
        <h1 className="text-[38px] font-extrabold mb-4 leading-tight">
          Bem-vindo ao<br />
          <span style={{ color: TEAL }}>Serviço Seguro</span>
        </h1>
        <p className="text-white/60 mb-8 text-sm leading-relaxed">
          A plataforma que conecta você aos melhores profissionais com segurança e transparência.
        </p>

        {/* Feature rows */}
        <div>
          {[
            { icon: '✅', title: 'Profissionais Verificados', desc: 'Todos passam por verificação de identidade' },
            { icon: '📄', title: 'Contrato Digital com validade jurídica', desc: 'Válido em qualquer instância judicial' },
            { icon: '🤖', title: 'IA no Atendimento', desc: 'Orçamentos qualificados sem esforço' },
          ].map((f, i) => (
            <div key={f.title} className={`flex items-start gap-3 ${i < 2 ? 'mb-4' : ''}`}>
              <div
                className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0 text-base"
                style={{ background: TEAL_LIGHT }}
              >
                {f.icon}
              </div>
              <div>
                <div className="font-bold text-sm mb-0.5">{f.title}</div>
                <div className="text-white/50 text-xs">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-[400px]">

          {/* Back link — mobile only */}
          <Link
            to="/"
            className="text-sm text-[#64748b] hover:text-[#030213] flex items-center gap-1 mb-6 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>

          {/* Heading */}
          <h2 className="text-3xl font-extrabold mb-2 text-[#030213]">
            {mode === 'login' ? 'Entrar' : 'Criar Conta'}
          </h2>
          <p className="text-[#64748b] mb-6 text-sm">
            {mode === 'login' ? 'Entre com suas credenciais' : 'Preencha seus dados para começar'}
          </p>

          {/* User type selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([
              ['contratante', '👤', 'Contratante', 'Contratar serviços'],
              ['prestador',   '👷', 'Profissional', 'Oferecer serviços'],
            ] as const).map(([v, ic, lb, sub]) => (
              <button
                key={v}
                onClick={() => setTipo(v)}
                className="p-4 rounded-[12px] text-left transition-all"
                style={{
                  border: tipo === v ? '2px solid #030213' : '2px solid #e2e8f0',
                  background: tipo === v ? 'rgba(3,2,19,0.04)' : '#fff',
                }}
                onMouseEnter={e => { if (tipo !== v) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(3,2,19,0.4)'; }}
                onMouseLeave={e => { if (tipo !== v) (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
              >
                <span className="text-2xl block mb-1">{ic}</span>
                <div className="font-bold text-sm">{lb}</div>
                <div className="text-xs text-[#64748b]">{sub}</div>
              </button>
            ))}
          </div>

          {/* Login / Register tabs */}
          <div className="flex bg-[#f1f5f9] rounded-[12px] p-1 mb-6">
            {([['login', 'Entrar'], ['register', 'Criar conta']] as const).map(([v, lb]) => (
              <button
                key={v}
                onClick={() => { setMode(v); setStep(1); setErro(''); }}
                className={`flex-1 py-2.5 text-sm transition-all rounded-[9px] ${
                  mode === v
                    ? 'bg-white shadow-sm text-[#030213] font-semibold'
                    : 'text-[#64748b] font-medium'
                }`}
              >
                {lb}
              </button>
            ))}
          </div>

          {/* Error box */}
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
              {erro}
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="seu@email.com"
                    className={inputWithIconCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.senha}
                    onChange={e => set('senha', e.target.value)}
                    placeholder="••••••••"
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full pl-10 pr-10 py-3 border border-[#e2e8f0] rounded-[12px] bg-[#f8fafc] text-sm outline-none focus:border-[#030213] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#030213] transition-colors"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3.5 bg-[#030213] text-white rounded-[12px] text-[15px] font-bold hover:bg-[#030213]/90 disabled:opacity-50 transition-all mt-2"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <p className="text-center text-sm text-[#64748b]">
                Não tem conta?{' '}
                <button
                  onClick={() => setMode('register')}
                  className="font-bold text-[#030213] hover:underline"
                >
                  Criar agora
                </button>
              </p>
            </div>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <div className="space-y-4">
              {/* Progress bar — prestador only */}
              {tipo === 'prestador' && (
                <div className="flex gap-1.5 mb-2">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="flex-1 h-1.5 rounded-full transition-all"
                      style={{ background: step >= i ? '#030213' : '#e2e8f0' }}
                    />
                  ))}
                </div>
              )}

              {/* STEP 1 — Personal info */}
              {step === 1 && (
                <>
                  <div>
                    <label className={labelCls}>Nome completo *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                      <input
                        type="text"
                        value={form.nome}
                        onChange={e => set('nome', e.target.value)}
                        placeholder="Seu nome completo"
                        className={inputWithIconCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => set('email', e.target.value)}
                        placeholder="seu@email.com"
                        className={inputWithIconCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>WhatsApp *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                      <input
                        type="tel"
                        value={form.telefone}
                        onChange={e => set('telefone', e.target.value)}
                        placeholder="(55) 99999-0000"
                        className={inputWithIconCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>CPF</label>
                      <input
                        type="text"
                        value={form.cpf}
                        onChange={e => set('cpf', e.target.value)}
                        placeholder="000.000.000-00"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Cidade</label>
                      <select
                        value={form.cidade}
                        onChange={e => set('cidade', e.target.value)}
                        className={inputCls}
                      >
                        <option>Santa Maria</option>
                        <option>Passo Fundo</option>
                        <option>Porto Alegre</option>
                      </select>
                    </div>
                  </div>
                  {tipo === 'prestador' && (
                    <div>
                      <label className={labelCls}>Sobre você</label>
                      <input
                        type="text"
                        value={form.bio}
                        onChange={e => set('bio', e.target.value)}
                        placeholder="Ex: 10 anos de experiência em elétrica"
                        className={inputCls}
                      />
                    </div>
                  )}
                </>
              )}

              {/* STEP 2 — Categories (prestador only) */}
              {step === 2 && tipo === 'prestador' && (
                <>
                  <div>
                    <label className={labelCls}>Selecione suas categorias *</label>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {(categorias.length ? categorias : [
                        { id: '1', nome: 'Instalações', icone: '⚡' },
                        { id: '2', nome: 'Construção e Reforma', icone: '🏗️' },
                        { id: '3', nome: 'Limpeza e Conservação', icone: '🧹' },
                      ]).map((c: any) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 p-3 rounded-[12px] cursor-pointer transition-all"
                          style={{
                            border: form.categorias.includes(c.id) ? '2px solid #030213' : '2px solid #e2e8f0',
                            background: form.categorias.includes(c.id) ? 'rgba(3,2,19,0.04)' : '#fff',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={form.categorias.includes(c.id)}
                            onChange={() => toggleCat(c.id)}
                            className="accent-[#030213]"
                          />
                          <span>{c.icone}</span>
                          <span className="text-sm font-medium text-[#030213]">{c.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Aceita orçamento online?</label>
                    <select
                      value={form.aceita_online ? 'true' : 'false'}
                      onChange={e => set('aceita_online', e.target.value === 'true')}
                      className={inputCls}
                    >
                      <option value="false">Não — preciso visitar o local</option>
                      <option value="true">Sim — consigo orçar com fotos</option>
                    </select>
                  </div>
                </>
              )}

              {/* STEP 3 (prestador) or combined password section (contratante) */}
              {(step === 3 || (tipo === 'contratante' && step === 1)) && (
                <>
                  {tipo === 'contratante' && step === 1 && (
                    <div className="border-t border-[#e2e8f0] pt-4 mt-2">
                      <div className={labelCls}>Criar senha</div>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Senha *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={form.senha}
                        onChange={e => set('senha', e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className={inputWithIconCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Confirmar senha *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={form.senha2}
                        onChange={e => set('senha2', e.target.value)}
                        placeholder="Repita a senha"
                        className={inputWithIconCls}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-3 pt-2">
                {tipo === 'prestador' && step > 1 && (
                  <button
                    onClick={() => setStep(s => s - 1)}
                    className="flex-1 py-3.5 border-2 border-[#e2e8f0] rounded-[12px] font-bold text-sm text-[#030213] hover:border-[#030213]/40 transition-all"
                  >
                    ← Voltar
                  </button>
                )}
                {tipo === 'prestador' && step < 3 ? (
                  <button
                    onClick={() => {
                      if (step === 1 && (!form.nome || !form.email || !form.telefone)) {
                        setErro('Preencha nome, email e WhatsApp.'); return;
                      }
                      if (step === 2 && !form.categorias.length) {
                        setErro('Selecione ao menos uma categoria.'); return;
                      }
                      setErro(''); setStep(s => s + 1);
                    }}
                    className="flex-1 py-3.5 text-white rounded-[12px] font-bold text-[15px] transition-all"
                    style={{ background: TEAL }}
                  >
                    Continuar →
                  </button>
                ) : (
                  <button
                    onClick={handleRegister}
                    disabled={loading}
                    className="flex-1 py-3.5 bg-[#030213] text-white rounded-[12px] text-[15px] font-bold hover:bg-[#030213]/90 disabled:opacity-50 transition-all"
                  >
                    {loading ? 'Criando...' : 'Criar conta'}
                  </button>
                )}
              </div>

              <p className="text-center text-sm text-[#64748b]">
                Já tem conta?{' '}
                <button
                  onClick={() => { setMode('login'); setErro(''); }}
                  className="font-bold text-[#030213] hover:underline"
                >
                  Entrar
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
