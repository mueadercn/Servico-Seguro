import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ArrowLeft, FileText, CheckCircle2, Download, ChevronDown, ChevronUp, Mail, Lock, User, Phone } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase, apiCall } from '../../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'https://servi-o-seguro-production.up.railway.app';

export function Contrato() {
  const [params] = useSearchParams();
  const orcId = params.get('orc');
  const papel = (params.get('papel') || 'cliente') as 'cliente' | 'prestador';

  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState('');
  const [form, setForm] = useState({ contNome:'', contCpf:'', prestNome:'', prestCpf:'', servico:'', valor:'', prazo:'', pagamento:'À vista', garantia:'90 dias' });
  const [comissao, setComissao] = useState({ valor: 0, pct: '' });
  const [comissaoTabela, setComissaoTabela] = useState<any[]>([]);
  const [contratoId, setContratoId] = useState('');
  const [contratoData, setContratoData] = useState<any>(null);
  const [aceite, setAceite] = useState(false);
  const [cpfSeguro, setCpfSeguro] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarClausulas, setMostrarClausulas] = useState(true);
  const [jaSigned, setJaSigned] = useState(false);

  // Auth gate — obrigatório para clientes antes de assinar
  const [clienteLogado, setClienteLogado] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ nome: '', email: '', telefone: '', cpf: '', senha: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authErro, setAuthErro] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const c = localStorage.getItem('ss_contratante');
    if (papel !== 'cliente' || c) {
      setClienteLogado(true);
      if (c) {
        const u = JSON.parse(c);
        if (u.nome && !form.contNome) set('contNome', u.nome);
      }
    }
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoadingInicial(true);
    try {
      const { data: comissoes } = await supabase.from('comissoes').select('*').eq('ativo', true).order('ordem');
      if (comissoes) setComissaoTabela(comissoes);
    } catch {}

    if (orcId) {
      try {
        // Buscar ORC com dados do prestador e usuário
        const { data: orcRows } = await supabase
          .from('orcs')
          .select('*, prestadores(*), usuarios(*)')
          .eq('id', orcId)
          .limit(1);
        const o = orcRows?.[0];
        if (o) {
          set('contNome', o.nome_cliente || '');
          set('contCpf', o.usuarios?.cpf || '');
          set('prestNome', o.prestadores?.nome || '');
          set('prestCpf', o.prestadores?.cpf || '');
          set('servico', o.resumo_anamnese || '');
          if (o.valor_final) { set('valor', String(o.valor_final)); }
        }

        // Verificar se já existe contrato para esse ORC (via backend para bypassar RLS)
        let existente: any = null;
        try {
          existente = await apiCall(`/api/contratos/orc/${orcId}`);
        } catch {}

        if (existente) {
          setContratoId(existente.id);
          setContratoData(existente);
          setTipo(existente.tipo || 'carta_aceite');
          // Preenche o form com dados do contrato existente (para mostrar no passo 3)
          if (existente.valor) set('valor', String(existente.valor));
          if (existente.prazo) set('prazo', existente.prazo);
          if (existente.pagamento) set('pagamento', existente.pagamento);
          if (existente.garantia) set('garantia', existente.garantia);
          const jaAssinadoPorMim = papel === 'prestador'
            ? existente.assinado_prestador
            : existente.assinado_cliente;
          setJaSigned(!!jaAssinadoPorMim);
          const comCalc = calcularComissaoValor(existente.valor || 0, comissoes || []);
          setComissao(existente.comissao
            ? { valor: existente.comissao, pct: calcularPct(existente.valor, existente.comissao) }
            : comCalc);
          setStep(3);
        }
      } catch {}
    }
    setLoadingInicial(false);
  }

  function calcularPct(valor: number, comissao: number): string {
    if (!valor || !comissao) return '';
    const pct = (comissao / valor) * 100;
    return pct.toFixed(0) + '%';
  }

  function calcularComissaoValor(v: number, tabela: any[]) {
    if (!v) return { valor: 0, pct: '' };
    let cv = 0, cp = '';
    if (tabela.length) {
      const f = tabela.find((c: any) => v >= c.valor_min && (c.valor_max === null || v <= c.valor_max));
      if (f) { cv = f.tipo === 'fixo' ? f.valor : (v * f.valor) / 100; cp = f.tipo === 'fixo' ? 'Taxa fixa' : f.valor + '%'; }
    } else {
      if (v <= 100) { cv = 10; cp = 'Taxa fixa'; }
      else if (v <= 500) { cv = v * 0.06; cp = '6%'; }
      else if (v <= 1000) { cv = v * 0.05; cp = '5%'; }
      else if (v <= 5000) { cv = v * 0.04; cp = '4%'; }
      else { cv = v * 0.03; cp = '3%'; }
    }
    return { valor: cv, pct: cp };
  }

  function calcComissao(val: string) {
    const v = parseFloat(val) || 0;
    setComissao(calcularComissaoValor(v, comissaoTabela));
  }

  const setA = (k: string, v: string) => setAuthForm(f => ({ ...f, [k]: v }));

  async function handleAuthLogin() {
    if (!authForm.email || !authForm.senha) { setAuthErro('Preencha email e senha.'); return; }
    setAuthLoading(true); setAuthErro('');
    try {
      const { data, error } = await supabase.from('contratante_auth')
        .select('id, usuario_id, senha_hash, usuarios(nome, cpf, telefone)')
        .eq('email', authForm.email.toLowerCase()).eq('ativo', true).limit(1);
      if (error || !data?.length) { setAuthErro('Email não encontrado.'); setAuthLoading(false); return; }
      const reg = data[0] as any;
      if (reg.senha_hash !== btoa(authForm.senha.trim())) { setAuthErro('Senha incorreta.'); setAuthLoading(false); return; }
      const u = { id: reg.usuario_id, nome: reg.usuarios?.nome, email: authForm.email };
      localStorage.setItem('ss_contratante', JSON.stringify(u));
      if (reg.usuarios?.nome) set('contNome', reg.usuarios.nome);
      if (reg.usuarios?.cpf) set('contCpf', reg.usuarios.cpf);
      if (orcId) await supabase.from('orcs').update({ usuario_id: reg.usuario_id }).eq('id', orcId);
      setClienteLogado(true);
    } catch (e: any) { setAuthErro(e.message); }
    setAuthLoading(false);
  }

  async function handleAuthRegister() {
    if (!authForm.nome || !authForm.email || !authForm.telefone || !authForm.senha) {
      setAuthErro('Preencha nome, email, WhatsApp e senha.'); return;
    }
    if (authForm.senha.length < 6) { setAuthErro('Senha mínima de 6 caracteres.'); return; }
    setAuthLoading(true); setAuthErro('');
    try {
      const { data: exist } = await supabase.from('contratante_auth').select('id').eq('email', authForm.email.toLowerCase()).limit(1);
      if (exist?.length) { setAuthErro('Email já cadastrado. Faça login.'); setAuthMode('login'); setAuthLoading(false); return; }
      const { data: u } = await supabase.from('usuarios').insert({
        nome: authForm.nome, email: authForm.email.toLowerCase(),
        telefone: authForm.telefone, cpf: authForm.cpf || null,
        cidade: 'Santa Maria', estado: 'RS', ativo: true
      }).select('id');
      if (!u?.length) throw new Error('Erro ao criar usuário');
      await supabase.from('contratante_auth').insert({
        usuario_id: u[0].id, email: authForm.email.toLowerCase(),
        senha_hash: btoa(authForm.senha), ativo: true
      });
      const userData = { id: u[0].id, nome: authForm.nome, email: authForm.email };
      localStorage.setItem('ss_contratante', JSON.stringify(userData));
      set('contNome', authForm.nome);
      if (authForm.cpf) set('contCpf', authForm.cpf);
      if (orcId) await supabase.from('orcs').update({ usuario_id: u[0].id }).eq('id', orcId);
      setClienteLogado(true);
    } catch (e: any) { setAuthErro(e.message); }
    setAuthLoading(false);
  }

  async function gerarContrato() {
    if (!form.contNome || !form.prestNome || !form.servico || !form.valor) { setErro('Preencha todos os campos obrigatórios.'); return; }
    setLoading(true); setErro('');
    try {
      const result = await apiCall('/api/contratos', {
        method: 'POST',
        body: {
          orc_id: orcId,
          tipo,
          valor: parseFloat(form.valor),
          comissao: comissao.valor,
          cont_nome: form.contNome,
          cont_cpf: form.contCpf,
          prest_nome: form.prestNome,
          prest_cpf: form.prestCpf,
          servico_desc: form.servico,
          prazo: form.prazo || 'A combinar',
          pagamento: form.pagamento || 'A combinar',
          garantia: form.garantia || '90 dias',
        }
      });
      if (result.ok) {
        setContratoId(result.contrato.id);
        setContratoData(result.contrato);
        setStep(3);
      }
    } catch (e: any) { setErro(e.message); }
    setLoading(false);
  }

  async function assinar() {
    setLoading(true); setErro('');
    try {
      const ip = await fetch('https://api.ipify.org?format=json')
        .then(r => r.json()).then(d => d.ip).catch(() => 'unknown');
      await apiCall(`/api/contratos/${contratoId}/assinar`, {
        method: 'POST',
        body: {
          parte: papel,
          ip,
          cpf_verificado: tipo === 'servico_seguro' && cpfSeguro.length === 11,
          biometria_verificada: false,
        }
      });
      setConcluido(true);
    } catch (e: any) { setErro(e.message); }
    setLoading(false);
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const comFmt = fmtBRL(comissao.valor);
  const garantia = contratoData?.garantia || form.garantia || '90 dias';
  const pagamento = contratoData?.pagamento || form.pagamento || 'A combinar';
  const prazo = contratoData?.prazo || form.prazo || 'A combinar';

  const clausulas = [
    ['1. OBRIGAÇÕES DO PRESTADOR', 'O prestador compromete-se a executar o serviço descrito com qualidade, pontualidade e dentro do prazo estipulado, utilizando materiais e técnicas adequadas ao escopo contratado.'],
    ['2. OBRIGAÇÕES DO CONTRATANTE', 'O contratante compromete-se a efetuar o pagamento conforme acordado e a disponibilizar acesso ao local do serviço nos horários combinados, bem como fornecer todas as informações necessárias à execução.'],
    ['3. GARANTIA', `O prestador garante o serviço executado pelo período de ${garantia} a partir da data de conclusão, comprometendo-se a corrigir eventuais defeitos decorrentes da execução sem custo adicional.`],
    ['4. RESCISÃO', 'Em caso de desistência após assinatura deste contrato, a parte desistente fica sujeita a multa de 20% sobre o valor total do serviço, salvo acordo mútuo entre as partes.'],
    ['5. COMISSÃO DA PLATAFORMA', `O PRESTADOR compromete-se a pagar à Serviço Seguro Plataforma Digital LTDA a comissão de ${comFmt} (${comissao.pct || calcularPct(parseFloat(form.valor||'0'), comissao.valor)}), no prazo máximo de 5 (cinco) dias úteis após a conclusão do serviço. O não pagamento implicará suspensão do perfil e multa de 2% ao mês.`],
    ['6. MEDIAÇÃO', 'A plataforma Serviço Seguro atuará como mediadora em caso de disputas, tendo acesso ao histórico completo das interações, acordos e documentos registrados na plataforma.'],
    ['7. CUSTÓDIA DIGITAL', 'Todas as interações entre as partes realizadas pela plataforma ficam registradas com timestamp e hash criptográfico, constituindo prova eletrônica nos termos da Lei 14.063/2020.'],
    ['8. FORO', 'Fica eleito o foro da comarca de Santa Maria/RS para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.'],
  ];

  if (loadingInicial) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // AUTH GATE — cliente precisa estar logado para ver/assinar o contrato
  if (papel === 'cliente' && !clienteLogado) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-primary px-4 py-4 flex items-center gap-3">
          <Link to="/" className="text-white/70 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
          <Logo className="h-8" />
          <div className="flex-1">
            <div className="font-bold text-white text-sm">Contrato Digital</div>
            <div className="text-white/60 text-xs">Identificação necessária</div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border shadow-sm w-full max-w-md">
            <div className="p-6 border-b text-center">
              <div className="text-3xl mb-2">🛡️</div>
              <h2 className="font-bold text-primary text-lg">Identifique-se para continuar</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Para assinar o contrato com validade jurídica, precisamos confirmar sua identidade.
              </p>
            </div>
            <div className="p-6">
              {/* TABS */}
              <div className="flex bg-muted rounded-xl p-1 mb-5">
                {[['login', 'Já tenho conta'], ['register', 'Criar conta']].map(([v, lb]) => (
                  <button key={v} onClick={() => { setAuthMode(v as any); setAuthErro(''); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authMode === v ? 'bg-white shadow text-primary' : 'text-muted-foreground'}`}>
                    {lb}
                  </button>
                ))}
              </div>

              {authErro && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">❌ {authErro}</div>
              )}

              {authMode === 'login' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="email" placeholder="seu@email.com" value={authForm.email} onChange={e => setA('email', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="password" placeholder="Sua senha" value={authForm.senha} onChange={e => setA('senha', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAuthLogin()}
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                  <button onClick={handleAuthLogin} disabled={authLoading}
                    className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50">
                    {authLoading ? 'Entrando...' : '→ Entrar e continuar'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="Nome completo *" value={authForm.nome} onChange={e => setA('nome', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="email" placeholder="Email *" value={authForm.email} onChange={e => setA('email', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="tel" placeholder="WhatsApp * (usado no contrato)" value={authForm.telefone} onChange={e => setA('telefone', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                  <input type="text" placeholder="CPF (opcional, mas recomendado)" value={authForm.cpf} onChange={e => setA('cpf', e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary" />
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="password" placeholder="Senha (mín. 6 caracteres) *" value={authForm.senha} onChange={e => setA('senha', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                    📱 Seu WhatsApp ficará registrado no contrato como prova de identidade.
                  </div>
                  <button onClick={handleAuthRegister} disabled={authLoading}
                    className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50">
                    {authLoading ? 'Criando conta...' : '✓ Criar conta e continuar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (concluido) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-primary mb-2">
          {tipo === 'carta_aceite' ? '📜 Carta Aceite Assinada!' : '🛡️ Contrato Seguro Assinado!'}
        </h2>
        <p className="text-muted-foreground mb-6">
          Assinatura registrada com validade jurídica.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a href={`${API_URL}/api/contratos/${contratoId}/pdf`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90">
            <Download className="h-4 w-4" /> Baixar PDF
          </a>
          <Link to="/" className="inline-flex items-center gap-2 border border-border px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50">
            ← Voltar
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-primary px-4 py-4 flex items-center gap-3">
        <Link to="/" className="text-white/70 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo className="h-8" />
        <div className="flex-1">
          <div className="font-bold text-white text-sm">Contrato Digital</div>
          <div className="text-white/60 text-xs">
            {papel === 'prestador' ? '👷 Profissional' : '👤 Cliente'}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* STEPS — só mostrar se não for contrato existente */}
        {!contratoData && (
          <div className="flex gap-1 mb-6 mt-2">
            {[1,2,3].map(i => (
              <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${step >= i ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        )}

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">❌ {erro}</div>}

        {/* STEP 1: TIPO */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-bold text-primary text-lg mb-1">Escolha o tipo de contrato</h2>
            <p className="text-muted-foreground text-sm mb-5">Selecione o nível de proteção adequado.</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { v: 'carta_aceite', ico: '📜', nome: 'Carta Aceite', badge: 'Simples', desc: 'Um clique · Juizados Especiais · Ideal até R$ 1.500', cor: 'border-blue-300 bg-blue-50' },
                { v: 'servico_seguro', ico: '🛡️', nome: 'Contrato Seguro', badge: 'Premium', desc: 'CPF + biometria · Qualquer instância · Máxima proteção', cor: 'border-success bg-success/5' },
              ].map(t => (
                <button key={t.v} onClick={() => setTipo(t.v)}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${tipo === t.v ? t.cor + ' border-2' : 'border-border hover:border-primary/40'}`}>
                  <div className="text-2xl mb-2">{t.ico}</div>
                  <div className="font-bold text-primary mb-1">{t.nome}</div>
                  <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-2 ${t.v === 'servico_seguro' ? 'bg-success text-white' : 'bg-blue-100 text-blue-800'}`}>{t.badge}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => { if(!tipo){setErro('Selecione o tipo.');return;} setErro(''); setStep(2); }}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors">
              Continuar →
            </button>
          </div>
        )}

        {/* STEP 2: DADOS */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-bold text-primary text-lg mb-4">Dados do Contrato</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Nome do Contratante *</label>
                  <input type="text" value={form.contNome} onChange={e => set('contNome', e.target.value)} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" /></div>
                <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">CPF do Contratante</label>
                  <input type="text" value={form.contCpf} onChange={e => set('contCpf', e.target.value)} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="000.000.000-00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Nome do Prestador *</label>
                  <input type="text" value={form.prestNome} onChange={e => set('prestNome', e.target.value)} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" /></div>
                <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">CPF do Prestador</label>
                  <input type="text" value={form.prestCpf} onChange={e => set('prestCpf', e.target.value)} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="000.000.000-00" /></div>
              </div>
              <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Descrição do Serviço *</label>
                <textarea value={form.servico} onChange={e => set('servico', e.target.value)} rows={3} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Valor Total (R$) *</label>
                  <input type="number" value={form.valor} onChange={e => { set('valor', e.target.value); calcComissao(e.target.value); }} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" /></div>
                <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Prazo de Execução</label>
                  <input type="text" value={form.prazo} onChange={e => set('prazo', e.target.value)} placeholder="Ex: 5 dias úteis" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Forma de Pagamento</label>
                  <select value={form.pagamento} onChange={e => set('pagamento', e.target.value)} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary">
                    <option>À vista</option><option>50% entrada + 50% conclusão</option><option>Parcelado</option>
                  </select></div>
                <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Garantia</label>
                  <input type="text" value={form.garantia} onChange={e => set('garantia', e.target.value)} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" /></div>
              </div>
              {comissao.valor > 0 && (
                <div className="bg-slate-50 border border-border rounded-xl p-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Comissão da Plataforma</div>
                  <div className="text-2xl font-bold text-success">{fmtBRL(comissao.valor)}</div>
                  <div className="text-xs text-muted-foreground">{comissao.pct} sobre o valor do serviço</div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-border rounded-xl font-semibold text-sm hover:bg-slate-50">← Voltar</button>
                <button onClick={gerarContrato} disabled={loading} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50">
                  {loading ? 'Gerando...' : '👁️ Visualizar contrato'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: VER E ASSINAR */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Cabeçalho do contrato */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-primary text-lg">
                    {tipo === 'carta_aceite' ? '📜 Carta Aceite' : '🛡️ Contrato Seguro'}
                  </h2>
                  <p className="text-xs text-muted-foreground">Leia com atenção antes de assinar</p>
                </div>
              </div>

              {/* Resumo */}
              <div className="bg-slate-50 rounded-xl p-4 text-sm grid grid-cols-2 gap-3">
                {[
                  ['Tipo', tipo === 'carta_aceite' ? '📜 Carta Aceite' : '🛡️ Contrato Seguro'],
                  ['Contratante', form.contNome || contratoData?.cont_nome || '—'],
                  ['Prestador', form.prestNome || contratoData?.prest_nome || '—'],
                  ['Valor total', fmtBRL(parseFloat(String(contratoData?.valor || form.valor || 0)))],
                  ['Comissão plataforma', comFmt],
                  ['Prazo', prazo],
                  ['Pagamento', pagamento],
                  ['Garantia', garantia],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div className="text-xs text-muted-foreground mb-0.5">{l}</div>
                    <div className="font-semibold text-sm">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cláusulas */}
            <div className="bg-white rounded-2xl border overflow-hidden">
              <button
                onClick={() => setMostrarClausulas(!mostrarClausulas)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition">
                <span className="font-bold text-primary">📋 Cláusulas e Condições</span>
                {mostrarClausulas ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {mostrarClausulas && (
                <div className="px-6 pb-6 space-y-4 max-h-80 overflow-y-auto border-t pt-4">
                  {clausulas.map(([titulo, texto]) => (
                    <div key={titulo}>
                      <p className="text-xs font-bold text-primary mb-1">{titulo}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status de assinaturas — só mostrar se contrato existente */}
            {contratoData && (
              <div className="bg-white rounded-2xl border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Status das assinaturas</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`px-3 py-2.5 rounded-xl ${contratoData.assinado_cliente ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-muted-foreground'}`}>
                    👤 Cliente: {contratoData.assinado_cliente
                      ? `✓ Assinado ${contratoData.assinado_cliente_em ? new Date(contratoData.assinado_cliente_em).toLocaleDateString('pt-BR') : ''}`
                      : 'Aguardando'}
                  </div>
                  <div className={`px-3 py-2.5 rounded-xl ${contratoData.assinado_prestador ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    👷 Prestador: {contratoData.assinado_prestador
                      ? `✓ Assinado ${contratoData.assinado_prestador_em ? new Date(contratoData.assinado_prestador_em).toLocaleDateString('pt-BR') : ''}`
                      : 'Aguardando'}
                  </div>
                </div>
              </div>
            )}

            {/* Área de assinatura */}
            <div className="bg-white rounded-2xl border p-6">
              {jaSigned ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="mx-auto text-green-500 mb-3" size={36} />
                  <p className="font-bold text-gray-800">Você já assinou este contrato!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {papel === 'prestador'
                      ? (contratoData?.assinado_cliente ? 'O cliente também assinou. Contrato válido!' : 'Aguardando assinatura do cliente.')
                      : (contratoData?.assinado_prestador ? 'O profissional também assinou. Contrato válido!' : 'Aguardando assinatura do profissional.')}
                  </p>
                  <a href={`${API_URL}/api/contratos/${contratoId}/pdf`} target="_blank" rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90">
                    <Download className="h-4 w-4" /> Baixar PDF do contrato
                  </a>
                </div>
              ) : tipo === 'carta_aceite' ? (
                <div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 mb-4">
                    📜 Ao marcar e clicar em assinar, você concorda eletronicamente com todos os termos acima. Lei 14.063/2020.
                  </div>
                  <label className="flex items-start gap-3 mb-5 cursor-pointer">
                    <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-1 accent-primary" />
                    <span className="text-sm text-muted-foreground">Li e concordo com todas as cláusulas deste contrato. As informações prestadas são verdadeiras.</span>
                  </label>
                  {erro && <p className="text-xs text-red-500 mb-3">{erro}</p>}
                  <button onClick={assinar} disabled={!aceite || loading}
                    className="w-full py-3.5 bg-success text-white rounded-xl font-bold hover:bg-success/90 disabled:opacity-50 transition-colors">
                    {loading ? 'Assinando...' : '✅ Assinar Contrato'}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 mb-4">
                    🛡️ Contrato Seguro requer confirmação de CPF para assinar.
                  </div>
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Confirme seu CPF</label>
                    <input type="text" value={cpfSeguro} onChange={e => setCpfSeguro(e.target.value.replace(/\D/g,''))} placeholder="00000000000" maxLength={11}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  </div>
                  <label className="flex items-start gap-3 mb-4 cursor-pointer">
                    <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-1 accent-primary" />
                    <span className="text-sm text-muted-foreground">Li e concordo com todas as cláusulas deste contrato. As informações prestadas são verdadeiras.</span>
                  </label>
                  {erro && <p className="text-xs text-red-500 mb-3">{erro}</p>}
                  <button onClick={assinar} disabled={!aceite || cpfSeguro.length !== 11 || loading}
                    className="w-full py-3.5 bg-success text-white rounded-xl font-bold hover:bg-success/90 disabled:opacity-50 transition-colors">
                    {loading ? 'Assinando...' : '🛡️ Assinar Contrato Seguro'}
                  </button>
                </div>
              )}

              {!contratoData && (
                <button onClick={() => setStep(2)} className="w-full mt-3 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-slate-50">← Voltar</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
