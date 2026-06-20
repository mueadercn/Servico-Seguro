import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { ArrowLeft, Shield, FileText, CheckCircle2, Download } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase, apiCall } from '../../lib/supabase';

export function Contrato() {
  const [params] = useSearchParams();
  const orcId = params.get('orc');
  const orcCodigo = params.get('codigo') || 'ORC-NOVO';

  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState('');
  const [form, setForm] = useState({ contNome:'', contCpf:'', prestNome:'', prestCpf:'', servico:'', valor:'', prazo:'', pagamento:'À vista', garantia:'90 dias' });
  const [comissao, setComissao] = useState({ valor: 0, pct: '' });
  const [comissaoTabela, setComissaoTabela] = useState<any[]>([]);
  const [contratoId, setContratoId] = useState('');
  const [aceite, setAceite] = useState(false);
  const [cpfSeguro, setCpfSeguro] = useState('');
  const [loading, setLoading] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      const { data } = await supabase.from('comissoes').select('*').eq('ativo', true).order('ordem');
      if (data) setComissaoTabela(data);
    } catch (e) {}

    if (orcId) {
      try {
        const { data } = await supabase.from('orcs').select('*, prestadores(*), usuarios(*)').eq('id', orcId).limit(1);
        if (data?.[0]) {
          const o = data[0];
          set('contNome', o.nome_cliente || '');
          set('contCpf', o.usuarios?.cpf || '');
          set('prestNome', o.prestadores?.nome || '');
          set('prestCpf', o.prestadores?.cpf || '');
          set('servico', o.resumo_anamnese || '');
          if (o.valor_final) { set('valor', String(o.valor_final)); calcComissao(String(o.valor_final)); }
        }
      } catch (e) {}
    }
  }

  function calcComissao(val: string) {
    const v = parseFloat(val) || 0;
    if (!v) { setComissao({ valor: 0, pct: '' }); return; }
    let cv = 0, cp = '';
    if (comissaoTabela.length) {
      const f = comissaoTabela.find(c => v >= c.valor_min && (c.valor_max === null || v <= c.valor_max));
      if (f) { cv = f.tipo === 'fixo' ? f.valor : (v * f.valor) / 100; cp = f.tipo === 'fixo' ? 'Taxa fixa' : f.valor + '%'; }
    } else {
      if (v <= 100) { cv = 10; cp = 'Taxa fixa'; }
      else if (v <= 500) { cv = v * 0.06; cp = '6%'; }
      else if (v <= 1000) { cv = v * 0.05; cp = '5%'; }
      else if (v <= 5000) { cv = v * 0.04; cp = '4%'; }
      else { cv = v * 0.03; cp = '3%'; }
    }
    setComissao({ valor: cv, pct: cp });
  }

  async function gerarContrato() {
    if (!form.contNome || !form.prestNome || !form.servico || !form.valor) { setErro('Preencha todos os campos obrigatórios.'); return; }
    setLoading(true); setErro('');
    try {
      const result = await apiCall('/api/contratos', {
        method: 'POST',
        body: { orc_id: orcId, tipo, valor: parseFloat(form.valor), comissao: comissao.valor, cont_nome: form.contNome, cont_cpf: form.contCpf, prest_nome: form.prestNome, prest_cpf: form.prestCpf, servico_desc: form.servico, prazo: form.prazo, pagamento: form.pagamento, garantia: form.garantia }
      });
      if (result.ok) { setContratoId(result.contrato.id); setStep(3); }
    } catch (e: any) { setErro(e.message); }
    setLoading(false);
  }

  async function assinar() {
    setLoading(true);
    try {
      const ip = await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip).catch(() => 'unknown');
      await apiCall(`/api/contratos/${contratoId}/assinar`, {
        method: 'POST',
        body: { parte: 'cliente', ip, cpf_verificado: tipo === 'servico_seguro' && cpfSeguro.length === 11, biometria_verificada: false }
      });
      setConcluido(true);
    } catch (e: any) { setErro(e.message); }
    setLoading(false);
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (concluido) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-primary mb-2">{tipo === 'carta_aceite' ? '📜 Carta Aceite Assinada!' : '🛡️ Contrato Seguro Assinado!'}</h2>
        <p className="text-muted-foreground mb-6">Contrato registrado com validade jurídica. Código: <strong className="text-primary">{orcCodigo}</strong></p>
        <div className="flex gap-3 justify-center">
          <a href={`${import.meta.env.VITE_API_URL}/api/contratos/${contratoId}/pdf`} target="_blank"
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90">
            <Download className="h-4 w-4" /> Baixar PDF
          </a>
          <Link to="/" className="inline-flex items-center gap-2 border border-border px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50">← Voltar</Link>
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
          <div className="font-bold text-white text-sm">Gerar Contrato</div>
          <div className="text-white/60 text-xs">{orcCodigo}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* STEPS */}
        <div className="flex gap-1 mb-6 mt-2">
          {[1,2,3].map(i => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${step >= i ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>

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

        {/* STEP 3: ASSINAR */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-bold text-primary text-lg mb-4">✍️ Assinar Contrato</h2>

            <div className="bg-slate-50 border border-border rounded-xl p-4 mb-5 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[['Tipo', tipo === 'carta_aceite' ? '📜 Carta Aceite' : '🛡️ Contrato Seguro'],
                  ['Contratante', form.contNome], ['Prestador', form.prestNome],
                  ['Valor', fmtBRL(parseFloat(form.valor)||0)],
                  ['Comissão', fmtBRL(comissao.valor)], ['Pagamento', form.pagamento]].map(([l,v]) => (
                  <div key={l}><div className="text-xs text-muted-foreground mb-0.5">{l}</div><div className="font-semibold">{v}</div></div>
                ))}
              </div>
            </div>

            {tipo === 'carta_aceite' ? (
              <div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 mb-4">
                  📜 Ao marcar e clicar em assinar, você concorda eletronicamente com todos os termos. Lei 14.063/2020.
                </div>
                <label className="flex items-start gap-3 mb-5 cursor-pointer">
                  <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-1 accent-primary" />
                  <span className="text-sm text-muted-foreground">Li e concordo com todos os termos deste contrato. As informações são verdadeiras.</span>
                </label>
                <button onClick={assinar} disabled={!aceite || loading}
                  className="w-full py-3.5 bg-success text-white rounded-xl font-bold hover:bg-success/90 disabled:opacity-50 transition-colors">
                  {loading ? 'Assinando...' : '✅ Assinar Contrato'}
                </button>
              </div>
            ) : (
              <div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 mb-4">
                  🛡️ Contrato Seguro requer verificação de CPF e biometria facial.
                </div>
                <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Confirme seu CPF</label>
                  <input type="text" value={cpfSeguro} onChange={e => setCpfSeguro(e.target.value.replace(/\D/g,''))} placeholder="00000000000" maxLength={11}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary mb-4" />
                </div>
                <Link to={`/biometria?retorno=contrato&contrato=${contratoId}`}
                  className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-3 hover:bg-primary/90">
                  🤳 Verificar identidade (biometria)
                </Link>
                <label className="flex items-start gap-3 mb-4 cursor-pointer">
                  <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-1 accent-primary" />
                  <span className="text-sm text-muted-foreground">Identidade verificada. Li e concordo com todos os termos.</span>
                </label>
                <button onClick={assinar} disabled={!aceite || cpfSeguro.length !== 11 || loading}
                  className="w-full py-3.5 bg-success text-white rounded-xl font-bold hover:bg-success/90 disabled:opacity-50 transition-colors">
                  {loading ? 'Assinando...' : '🛡️ Assinar Contrato Seguro'}
                </button>
              </div>
            )}
            <button onClick={() => setStep(2)} className="w-full mt-3 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-slate-50">← Voltar</button>
          </div>
        )}
      </div>
    </div>
  );
}
