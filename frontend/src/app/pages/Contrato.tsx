import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ArrowLeft, FileText, CheckCircle2, Download, ChevronDown, ChevronUp, Edit3, AlertTriangle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase, apiCall, getPrestador, getContratante } from '../../lib/supabase';
import { validarCPF, mascaraCPF } from '../utils/validacoes';

const API_URL = import.meta.env.VITE_API_URL || 'https://servi-o-seguro-production.up.railway.app';
const TEAL = 'oklch(0.6 0.118 184.704)';

export function Contrato() {
  const [params] = useSearchParams();
  const orcId = params.get('orc');
  const papel = (params.get('papel') || 'cliente') as 'cliente' | 'prestador';

  // Form steps: 1 = dados, 2 = ver/assinar
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    contNome: '', contCpf: '', prestNome: '', prestCpf: '',
    servico: '', valor: '', prazo: '', pagamento: 'À vista', garantia: '90 dias'
  });
  const [comissao, setComissao] = useState({ valor: 0, pct: '' });
  const [comissaoTabela, setComissaoTabela] = useState<any[]>([]);
  const [contratoId, setContratoId] = useState('');
  const [contratoData, setContratoData] = useState<any>(null);
  const [aceite, setAceite] = useState(false);
  const [cpfAssinatura, setCpfAssinatura] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarClausulas, setMostrarClausulas] = useState(true);
  const [jaSigned, setJaSigned] = useState(false);
  const [retificando, setRetificando] = useState(false);
  const [evidencias, setEvidencias] = useState<any>(null);
  const [mensagensChat, setMensagensChat] = useState<any[]>([]);
  const [chatLink, setChatLink] = useState('');
  const [telefoneOrc, setTelefoneOrc] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoadingInicial(true);
    try {
      const { data: comissoes } = await supabase.from('comissoes').select('*').eq('ativo', true).order('ordem');
      if (comissoes) setComissaoTabela(comissoes);

      // Pré-preencher com dados do usuário logado
      let contNomeInicial = '';
      let contCpfInicial = '';
      if (papel === 'cliente') {
        const c = getContratante();
        if (c?.nome) { set('contNome', c.nome); contNomeInicial = c.nome; }
        if ((c as any)?.cpf) { set('contCpf', (c as any).cpf); contCpfInicial = (c as any).cpf; }
        // Buscar perfil completo do banco para pegar nome real e CPF
        if (c?.id) {
          const { data: perfil } = await supabase.from('usuarios').select('nome, cpf').eq('id', c.id).maybeSingle();
          if (perfil?.nome) { set('contNome', perfil.nome); contNomeInicial = perfil.nome; }
          if (perfil?.cpf) { set('contCpf', perfil.cpf); contCpfInicial = perfil.cpf; }
        }
      } else {
        const p = getPrestador();
        if (p?.nome) set('prestNome', p.nome);
        if ((p as any)?.cpf) set('prestCpf', (p as any).cpf);
        // Buscar perfil completo do banco
        if (p?.id) {
          const { data: perfil } = await supabase.from('prestadores').select('nome, cpf').eq('id', p.id).maybeSingle();
          if (perfil?.nome) set('prestNome', perfil.nome);
          if (perfil?.cpf) set('prestCpf', perfil.cpf);
        }
      }

      if (orcId) {
        // Buscar link do chat para botão de voltar
        const { data: chatData } = await supabase.from('chat_negociacao').select('link_token').eq('orc_id', orcId).maybeSingle();
        if (chatData?.link_token) setChatLink(`/chat/${chatData.link_token}?papel=${papel}`);

        const { data: orcRows } = await supabase
          .from('orcs')
          .select('*, prestadores(*), usuarios(*)')
          .eq('id', orcId)
          .limit(1);
        const o = orcRows?.[0];
        if (o) {
          if (!contNomeInicial) set('contNome', o.nome_cliente || '');
          set('contCpf', o.usuarios?.cpf || contCpfInicial || '');
          set('prestNome', o.prestadores?.nome || '');
          set('prestCpf', o.prestadores?.cpf || '');
          set('servico', o.resumo_anamnese || '');
          if (o.valor_final) set('valor', String(o.valor_final));
          if (o.telefone_cliente) setTelefoneOrc(o.telefone_cliente);
        }

        let existente: any = null;
        try { existente = await apiCall(`/api/contratos/orc/${orcId}`); } catch {}

        if (existente) {
          setContratoId(existente.id);
          setContratoData(existente);
          if (existente.valor) set('valor', String(existente.valor));
          if (existente.prazo) set('prazo', existente.prazo);
          if (existente.pagamento) set('pagamento', existente.pagamento);
          if (existente.garantia) set('garantia', existente.garantia);
          const jaAssinadoPorMim = papel === 'prestador' ? existente.assinado_prestador : existente.assinado_cliente;
          setJaSigned(!!jaAssinadoPorMim);
          const comCalc = calcularComissaoValor(existente.valor || 0, comissoes || []);
          setComissao(existente.comissao
            ? { valor: existente.comissao, pct: calcularPct(existente.valor, existente.comissao) }
            : comCalc);
          setStep(2);
        }
      }
    } catch {}
    setLoadingInicial(false);
  }

  function calcularPct(valor: number, comissao: number): string {
    if (!valor || !comissao) return '';
    return ((comissao / valor) * 100).toFixed(0) + '%';
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

  function validarNomeCompleto(nome: string) {
    return nome.trim().split(/\s+/).filter(Boolean).length >= 2;
  }

  async function gerarContrato() {
    if (!form.contNome || !form.prestNome || !form.servico || !form.valor) {
      setErro('Preencha todos os campos obrigatórios.'); return;
    }
    if (!validarNomeCompleto(form.contNome)) {
      setErro('Informe o nome completo do contratante (nome e sobrenome).'); return;
    }
    if (!validarNomeCompleto(form.prestNome)) {
      setErro('Informe o nome completo do prestador (nome e sobrenome).'); return;
    }
    if (!form.contCpf || form.contCpf.replace(/\D/g, '').length !== 11) {
      setErro('CPF do contratante é obrigatório e deve ter 11 dígitos.'); return;
    }
    if (!validarCPF(form.contCpf.replace(/\D/g, ''))) {
      setErro('CPF do contratante é inválido.'); return;
    }
    if (parseFloat(form.valor) <= 0) {
      setErro('Informe um valor válido para o serviço.'); return;
    }
    setLoading(true); setErro('');
    try {
      const result = await apiCall('/api/contratos', {
        method: 'POST',
        body: {
          orc_id: orcId,
          tipo: 'servico_seguro',
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
        setStep(2);
      }
    } catch (e: any) { setErro(e.message); }
    setLoading(false);
  }

  async function retificarContrato() {
    if (!form.valor) { setErro('Informe o valor.'); return; }
    setLoading(true); setErro('');
    try {
      const result = await apiCall(`/api/contratos/${contratoId}/retificar`, {
        method: 'PUT',
        body: {
          valor: parseFloat(form.valor),
          comissao: comissao.valor,
          prazo: form.prazo,
          pagamento: form.pagamento,
          garantia: form.garantia,
          servico_desc: form.servico,
          retificado_por: papel,
        }
      });
      if (result.ok) {
        setContratoData(result.contrato);
        setJaSigned(false);
        setAceite(false);
        setRetificando(false);
        setStep(2);
      }
    } catch (e: any) { setErro(e.message); }
    setLoading(false);
  }

  async function assinar() {
    // Validar CPF antes de assinar
    const cpfDigitos = cpfAssinatura.replace(/\D/g, '');
    if (!cpfDigitos || cpfDigitos.length !== 11) {
      setErro('Informe seu CPF completo (11 dígitos) para assinar.'); return;
    }
    if (!validarCPF(cpfDigitos)) {
      setErro('CPF inválido. Verifique os dígitos.'); return;
    }

    setLoading(true); setErro('');
    try {
      const ip = await fetch('https://api.ipify.org?format=json')
        .then(r => r.json()).then(d => d.ip).catch(() => 'desconhecido');

      // Tentar geolocalização
      let geo: any = null;
      try {
        geo = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => resolve(null),
            { timeout: 5000 }
          );
        });
      } catch {}

      const ua = navigator.userAgent;
      const telefone = papel === 'cliente'
        ? (telefoneOrc || (getContratante() as any)?.telefone || '')
        : ((getPrestador() as any)?.telefone || '');

      const result = await apiCall(`/api/contratos/${contratoId}/assinar`, {
        method: 'POST',
        body: {
          parte: papel,
          ip,
          cpf_verificado: true,
          biometria_verificada: false,
          user_agent: ua,
          geolocalizacao: geo,
          telefone,
        }
      });

      // Buscar mensagens do chat para o log de evidências
      if (orcId) {
        try {
          const { data: chatData } = await supabase
            .from('chat_negociacao')
            .select('id')
            .eq('orc_id', orcId)
            .maybeSingle();
          if (chatData?.id) {
            const { data: msgs } = await supabase
              .from('chat_mensagens')
              .select('remetente, tipo, conteudo, criado_em')
              .eq('chat_id', chatData.id)
              .eq('tipo', 'texto')
              .order('criado_em', { ascending: false })
              .limit(10);
            if (msgs) setMensagensChat(msgs.reverse());
          }
        } catch {}
      }

      setEvidencias({ ip, geo, ua, telefone, timestamp: new Date().toISOString() });
      setContratoData((prev: any) => prev ? { ...prev, ...result.contrato } : result.contrato);
      setJaSigned(true);
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
    ['5. COMISSÃO DA PLATAFORMA', `O PRESTADOR compromete-se a pagar à Serviço Seguro Plataforma Digital LTDA a comissão de ${comFmt} (${comissao.pct}), no prazo máximo de 5 (cinco) dias úteis após a conclusão do serviço. O não pagamento implicará suspensão do perfil e multa de 2% ao mês.`],
    ['6. MEDIAÇÃO', 'A plataforma Serviço Seguro atuará como mediadora em caso de disputas, tendo acesso ao histórico completo das interações, acordos e documentos registrados na plataforma.'],
    ['7. CUSTÓDIA DIGITAL', 'Todas as interações entre as partes realizadas pela plataforma ficam registradas com timestamp e hash criptográfico, constituindo prova eletrônica nos termos da Lei 14.063/2020.'],
    ['8. FORO', 'Fica eleito o foro da comarca de Santa Maria/RS para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.'],
  ];

  if (loadingInicial) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" style={{ borderColor: '#030213', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // Tela de conclusão com log de evidências
  if (concluido) return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Sucesso */}
        <div className="bg-white rounded-2xl border p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-[#030213] mb-2">Contrato Assinado!</h2>
          <p className="text-[#717182] mb-6">Assinatura registrada com validade jurídica — Lei 14.063/2020.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href={`${API_URL}/api/contratos/${contratoId}/pdf`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-90"
              style={{ background: '#030213' }}>
              <Download className="h-4 w-4" /> Baixar PDF
            </a>
            <Link to="/" className="inline-flex items-center gap-2 border border-[#e2e8f0] px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50">
              ← Voltar
            </Link>
          </div>
        </div>

        {/* Log de evidências */}
        {evidencias && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ background: '#030213' }}>
              <h3 className="font-bold text-white text-sm">📋 Log de Evidências Digitais</h3>
              <p className="text-white/60 text-xs mt-0.5">Registro conforme Lei 14.063/2020</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <EvidItem label="🕐 Timestamp" value={new Date(evidencias.timestamp).toLocaleString('pt-BR')} />
              <EvidItem label="🌐 Endereço IP" value={evidencias.ip} />
              {evidencias.telefone && <EvidItem label="📱 Telefone" value={evidencias.telefone} />}
              {evidencias.geo && (
                <EvidItem label="📍 Geolocalização"
                  value={`${evidencias.geo.lat.toFixed(5)}, ${evidencias.geo.lng.toFixed(5)} (±${Math.round(evidencias.geo.accuracy)}m)`} />
              )}
              <div className="col-span-2">
                <div className="text-[10px] font-bold uppercase text-[#94a3b8] mb-1">User-Agent</div>
                <div className="text-xs text-[#030213] font-mono bg-slate-50 rounded-lg p-2 break-all leading-relaxed">{evidencias.ua}</div>
              </div>
            </div>

            {/* Histórico do chat */}
            {mensagensChat.length > 0 && (
              <div className="border-t px-6 pb-6">
                <div className="text-[10px] font-bold uppercase text-[#94a3b8] mt-5 mb-3">Trecho da negociação (últimas mensagens)</div>
                <div className="space-y-2">
                  {mensagensChat.map((m: any, i: number) => (
                    <div key={i} className={`flex ${m.remetente === papel ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%] px-3 py-2 rounded-[12px] text-xs"
                        style={m.remetente === papel
                          ? { background: '#030213', color: '#fff' }
                          : { background: '#f1f5f9', color: '#030213' }}>
                        <span className="font-bold block mb-0.5" style={{ opacity: 0.7 }}>{m.remetente}</span>
                        {m.conteudo}
                        <span className="block text-[10px] mt-1 opacity-50">
                          {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-[#030213] px-4 py-4 flex items-center gap-3">
        <Link to={chatLink || '/'} className="text-white/70 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <Logo className="h-8" />
        <div className="flex-1">
          <div className="font-bold text-white text-sm">Contrato Digital</div>
          <div className="text-white/60 text-xs">{papel === 'prestador' ? '👷 Profissional' : '👤 Cliente'}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Progress bar — só para novo contrato */}
        {!contratoData && !retificando && (
          <div className="flex gap-1 mb-6 mt-2">
            {[1, 2].map(i => (
              <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                style={{ background: step >= i ? '#030213' : '#e2e8f0' }} />
            ))}
          </div>
        )}

        {retificando && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Modo retificação</strong> — ao salvar, as assinaturas anteriores serão canceladas e ambas as partes precisarão assinar novamente.
            </p>
          </div>
        )}

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">❌ {erro}</div>}

        {/* STEP 1 / RETIFICAÇÃO: DADOS */}
        {(step === 1 || retificando) && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-bold text-[#030213] text-lg mb-4">
              {retificando ? '✏️ Retificar Contrato' : 'Dados do Contrato'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 block">Nome do Contratante *</label>
                  <input type="text" value={form.contNome} onChange={e => set('contNome', e.target.value)}
                    readOnly={papel === 'cliente' && validarNomeCompleto(getContratante()?.nome || '')}
                    placeholder="Nome e sobrenome"
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213] read-only:bg-slate-50 read-only:text-[#64748b] ${!form.contNome || !validarNomeCompleto(form.contNome) ? 'border-amber-300' : 'border-[#e2e8f0]'}`} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 block">CPF do Contratante</label>
                  <input type="text" value={form.contCpf}
                    onChange={e => set('contCpf', mascaraCPF(e.target.value))}
                    readOnly={papel === 'cliente' && !!(getContratante() as any)?.cpf && validarCPF(((getContratante() as any)?.cpf || '').replace(/\D/g, ''))}
                    placeholder="000.000.000-00" maxLength={14}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213] read-only:bg-slate-50 read-only:text-[#64748b] ${!form.contCpf || form.contCpf.replace(/\D/g,'').length !== 11 ? 'border-amber-300' : 'border-[#e2e8f0]'}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 block">Nome do Prestador *</label>
                  <input type="text" value={form.prestNome} onChange={e => set('prestNome', e.target.value)}
                    readOnly={papel === 'prestador' && !!getPrestador()?.nome}
                    className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213] read-only:bg-slate-50 read-only:text-[#64748b]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 block">CPF do Prestador</label>
                  <input type="text" value={form.prestCpf}
                    onChange={e => set('prestCpf', mascaraCPF(e.target.value))}
                    readOnly={papel === 'prestador' && !!(getPrestador() as any)?.cpf}
                    placeholder="000.000.000-00" maxLength={14}
                    className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213] read-only:bg-slate-50 read-only:text-[#64748b]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 block">Descrição do Serviço *</label>
                <textarea value={form.servico} onChange={e => set('servico', e.target.value)} rows={3}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 block">Valor Total (R$) *</label>
                  <input type="number" value={form.valor}
                    onChange={e => { set('valor', e.target.value); calcComissao(e.target.value); }}
                    className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 block">Prazo de Execução</label>
                  <input type="text" value={form.prazo} onChange={e => set('prazo', e.target.value)}
                    placeholder="Ex: 5 dias úteis"
                    className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 block">Forma de Pagamento</label>
                  <select value={form.pagamento} onChange={e => set('pagamento', e.target.value)}
                    className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213]">
                    <option>À vista</option>
                    <option>50% entrada + 50% conclusão</option>
                    <option>Parcelado</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1 block">Garantia</label>
                  <input type="text" value={form.garantia} onChange={e => set('garantia', e.target.value)}
                    className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213]" />
                </div>
              </div>
              {comissao.valor > 0 && (
                <div className="bg-slate-50 border border-[#e2e8f0] rounded-xl p-4">
                  <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1">Comissão da Plataforma</div>
                  <div className="text-2xl font-bold" style={{ color: TEAL }}>{fmtBRL(comissao.valor)}</div>
                  <div className="text-xs text-[#717182]">{comissao.pct} sobre o valor do serviço</div>
                </div>
              )}
              {/* Resumo de revisão antes de gerar */}
              {!retificando && (
                <div className="rounded-xl border p-4 space-y-1.5 text-sm"
                  style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748b] mb-2">Revisão antes de continuar</p>
                  <div className={`flex items-center gap-2 ${validarNomeCompleto(form.contNome) ? 'text-[#173404]' : 'text-amber-700 font-semibold'}`}>
                    {validarNomeCompleto(form.contNome) ? '✓' : '⚠️'} Contratante: <span className="font-medium">{form.contNome || '—'}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${form.contCpf?.replace(/\D/g,'').length === 11 ? 'text-[#173404]' : 'text-amber-700 font-semibold'}`}>
                    {form.contCpf?.replace(/\D/g,'').length === 11 ? '✓' : '⚠️'} CPF contratante: <span className="font-medium">{form.contCpf || '—'}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${validarNomeCompleto(form.prestNome) ? 'text-[#173404]' : 'text-amber-700 font-semibold'}`}>
                    {validarNomeCompleto(form.prestNome) ? '✓' : '⚠️'} Prestador: <span className="font-medium">{form.prestNome || '—'}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${parseFloat(form.valor) > 0 ? 'text-[#173404]' : 'text-amber-700 font-semibold'}`}>
                    {parseFloat(form.valor) > 0 ? '✓' : '⚠️'} Valor: <span className="font-medium">{parseFloat(form.valor) > 0 ? `R$ ${parseFloat(form.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                {retificando && (
                  <button onClick={() => { setRetificando(false); setStep(2); }}
                    className="flex-1 py-3 border border-[#e2e8f0] rounded-xl font-semibold text-sm hover:bg-slate-50">
                    ← Cancelar
                  </button>
                )}
                <button
                  onClick={retificando ? retificarContrato : gerarContrato}
                  disabled={loading}
                  className="flex-1 py-3 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors"
                  style={{ background: '#030213' }}>
                  {loading ? 'Salvando...' : retificando ? '💾 Salvar Retificação' : '👁️ Visualizar contrato'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: VER E ASSINAR */}
        {step === 2 && !retificando && (
          <div className="space-y-4">
            {/* Cabeçalho do contrato */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(3,2,19,0.07)' }}>
                    <FileText className="h-5 w-5" style={{ color: '#030213' }} />
                  </div>
                  <div>
                    <h2 className="font-bold text-[#030213] text-lg">🛡️ Contrato de Prestação de Serviços</h2>
                    <p className="text-xs text-[#717182]">Leia com atenção antes de assinar</p>
                  </div>
                </div>
                {/* Botão retificar — disponível se contrato existe e não totalmente assinado */}
                {contratoData && !(contratoData.assinado_cliente && contratoData.assinado_prestador) && (
                  <button
                    onClick={() => { setRetificando(true); setErro(''); }}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-[10px] border transition-all hover:bg-slate-50"
                    style={{ color: '#030213', borderColor: 'rgba(0,0,0,0.15)' }}>
                    <Edit3 className="h-3.5 w-3.5" /> Retificar
                  </button>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 text-sm grid grid-cols-2 gap-3">
                {[
                  ['Contratante', form.contNome || contratoData?.cont_nome || '—'],
                  ['Prestador', form.prestNome || contratoData?.prest_nome || '—'],
                  ['Valor total', fmtBRL(parseFloat(String(contratoData?.valor || form.valor || 0)))],
                  ['Comissão plataforma', comFmt],
                  ['Prazo', prazo],
                  ['Pagamento', pagamento],
                  ['Garantia', garantia],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div className="text-xs text-[#94a3b8] mb-0.5">{l}</div>
                    <div className="font-semibold text-sm text-[#030213]">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cláusulas */}
            <div className="bg-white rounded-2xl border overflow-hidden">
              <button
                onClick={() => setMostrarClausulas(!mostrarClausulas)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition">
                <span className="font-bold text-[#030213]">📋 Cláusulas e Condições</span>
                {mostrarClausulas ? <ChevronUp className="h-4 w-4 text-[#94a3b8]" /> : <ChevronDown className="h-4 w-4 text-[#94a3b8]" />}
              </button>
              {mostrarClausulas && (
                <div className="px-6 pb-6 space-y-4 max-h-80 overflow-y-auto border-t pt-4">
                  {clausulas.map(([titulo, texto]) => (
                    <div key={titulo}>
                      <p className="text-xs font-bold text-[#030213] mb-1">{titulo}</p>
                      <p className="text-xs text-[#717182] leading-relaxed">{texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status de assinaturas */}
            {contratoData && (
              <div className="bg-white rounded-2xl border p-4">
                <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">Status das assinaturas</p>
                {contratoData.retificacoes?.length > 0 && (
                  <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                    📝 Contrato retificado {contratoData.retificacoes.length}x — ambas as partes precisam assinar novamente.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`px-3 py-2.5 rounded-xl ${contratoData.assinado_cliente ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-[#717182]'}`}>
                    👤 Cliente: {contratoData.assinado_cliente
                      ? `✓ ${contratoData.assinado_cliente_em ? new Date(contratoData.assinado_cliente_em).toLocaleDateString('pt-BR') : 'Assinado'}`
                      : 'Aguardando'}
                  </div>
                  <div className={`px-3 py-2.5 rounded-xl ${contratoData.assinado_prestador ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    👷 Prestador: {contratoData.assinado_prestador
                      ? `✓ ${contratoData.assinado_prestador_em ? new Date(contratoData.assinado_prestador_em).toLocaleDateString('pt-BR') : 'Assinado'}`
                      : 'Aguardando'}
                  </div>
                </div>
              </div>
            )}

            {/* Área de assinatura */}
            <div className="bg-white rounded-2xl border p-6">
              {jaSigned ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="mx-auto mb-3" size={36} style={{ color: TEAL }} />
                  <p className="font-bold text-[#030213]">Você já assinou este contrato!</p>
                  <p className="text-sm mt-1 text-[#717182]">
                    {papel === 'prestador'
                      ? (contratoData?.assinado_cliente ? 'O cliente também assinou. Contrato válido!' : 'Aguardando assinatura do cliente.')
                      : (contratoData?.assinado_prestador ? 'O profissional também assinou. Contrato válido!' : 'Aguardando assinatura do profissional.')}
                  </p>
                  <a href={`${API_URL}/api/contratos/${contratoId}/pdf`} target="_blank" rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-90"
                    style={{ background: '#030213' }}>
                    <Download className="h-4 w-4" /> Baixar PDF do contrato
                  </a>
                </div>
              ) : (
                <div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 mb-4">
                    🛡️ Para assinar, confirme seu CPF. Sua assinatura terá validade jurídica conforme Lei 14.063/2020.
                  </div>
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1.5 block">Confirme seu CPF *</label>
                    <input
                      type="text"
                      value={cpfAssinatura}
                      onChange={e => setCpfAssinatura(mascaraCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#030213]"
                    />
                  </div>
                  <label className="flex items-start gap-3 mb-4 cursor-pointer">
                    <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-1 accent-[#030213]" />
                    <span className="text-sm text-[#717182]">Li e concordo com todas as cláusulas deste contrato. As informações prestadas são verdadeiras.</span>
                  </label>
                  {erro && <p className="text-xs text-red-500 mb-3">{erro}</p>}
                  <button onClick={assinar} disabled={!aceite || loading}
                    className="w-full py-3.5 text-white rounded-xl font-bold disabled:opacity-50 transition-colors"
                    style={{ background: '#030213' }}>
                    {loading ? 'Assinando...' : '✅ Assinar Contrato'}
                  </button>
                </div>
              )}
              {!contratoData && (
                <button onClick={() => setStep(1)} className="w-full mt-3 py-2.5 border border-[#e2e8f0] rounded-xl text-sm font-semibold hover:bg-slate-50">
                  ← Voltar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EvidItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-[#94a3b8] mb-0.5">{label}</div>
      <div className="text-sm font-mono text-[#030213] break-all">{value}</div>
    </div>
  );
}
