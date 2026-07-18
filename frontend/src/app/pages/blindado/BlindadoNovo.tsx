import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Copy, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiCall } from '../../../lib/supabase';
import { validarCPF, validarCNPJ, mascaraCPF, mascaraCNPJ } from '../../utils/validacoes';
import { OtpInput } from '../../components/blindado/OtpInput';
import { AnexosParte } from '../../components/blindado/AnexosParte';
import { getSessaoBlindado, formatarValor, mascaraTelefone } from './util';

const OPCOES_PAGAMENTO = ['À vista', '50% entrada + 50% conclusão', 'Parcelado'];

export function BlindadoNovo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const sessao = getSessaoBlindado();

  const [step, setStep] = useState(1);
  const [contrato, setContrato] = useState<any>(null);
  const [partes, setPartes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [linkGerado, setLinkGerado] = useState('');
  const [copiado, setCopiado] = useState(false);

  // Step 1 — contrato
  const [servico, setServico] = useState('');
  const [valor, setValor] = useState('');
  const [prazo, setPrazo] = useState('');
  const [garantia, setGarantia] = useState('90 dias');
  const [pagamentoOpcao, setPagamentoOpcao] = useState('À vista');
  const [pagamentoLivre, setPagamentoLivre] = useState('');

  // Step 2 — partes
  const [meuPapel, setMeuPapel] = useState<'prestador' | 'contratante'>('prestador');
  const [meuNome, setMeuNome] = useState(sessao?.usuario?.nome || '');
  const [meuDoc, setMeuDoc] = useState('');
  const [meuTipoPessoa, setMeuTipoPessoa] = useState<'pf' | 'pj'>('pf');
  const [minhaData, setMinhaData] = useState('');
  const [meuTelefone, setMeuTelefone] = useState('');
  const [outroNome, setOutroNome] = useState('');
  const [outroDoc, setOutroDoc] = useState('');
  const [outroTipoPessoa, setOutroTipoPessoa] = useState<'pf' | 'pj'>('pf');
  const [outraData, setOutraData] = useState('');
  const [outroTelefone, setOutroTelefone] = useState('');

  const criador = partes.find(p => p.papel === 'criador');
  const pagamento = pagamentoOpcao === 'outra' ? pagamentoLivre : pagamentoOpcao;

  useEffect(() => {
    if (!sessao) { navigate('/auth'); return; }
    if (id) retomarRascunho(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retomarRascunho(contratoId: string) {
    try {
      const d = await apiCall(`/api/blindado/contratos/meus?criador_tipo=${sessao!.tipo}&criador_id=${sessao!.usuario.id}`);
      const c = (d.contratos || []).find((x: any) => x.id === contratoId);
      if (!c) { setErro('Rascunho não encontrado.'); return; }
      const full = await apiCall(`/api/blindado/token/${c.token}`);
      carregarEstado(full.contrato, full.partes);
      if (full.contrato.status !== 'rascunho') {
        navigate(`/blindado/c/${full.contrato.token}`);
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar rascunho.');
    }
  }

  function carregarEstado(c: any, ps: any[]) {
    setContrato(c);
    setPartes(ps);
    setServico(c.servico_desc || '');
    setValor(c.valor ? String(c.valor) : '');
    setPrazo(c.prazo || '');
    setGarantia(c.garantia || '90 dias');
    if (c.pagamento && OPCOES_PAGAMENTO.includes(c.pagamento)) {
      setPagamentoOpcao(c.pagamento);
    } else if (c.pagamento) {
      setPagamentoOpcao('outra');
      setPagamentoLivre(c.pagamento);
    }
    const cr = ps.find(p => p.papel === 'criador');
    const cv = ps.find(p => p.papel === 'convidado');
    if (cr) {
      setMeuPapel(cr.papel_contratual);
      setMeuNome(cr.nome);
      setMeuTipoPessoa(cr.tipo_pessoa);
      setMeuDoc(cr.tipo_pessoa === 'pj' ? mascaraCNPJ(cr.cpf_cnpj) : mascaraCPF(cr.cpf_cnpj));
      setMinhaData(cr.data_referencia || '');
      if (cr.telefone) setMeuTelefone(mascaraTelefone(cr.telefone.replace(/^55/, '')));
    }
    if (cv) {
      setOutroNome(cv.nome);
      setOutroTipoPessoa(cv.tipo_pessoa);
      setOutroDoc(cv.tipo_pessoa === 'pj' ? mascaraCNPJ(cv.cpf_cnpj) : mascaraCPF(cv.cpf_cnpj));
      setOutraData(cv.data_referencia || '');
      if (cv.telefone) setOutroTelefone(mascaraTelefone(cv.telefone.replace(/^55/, '')));
    }
  }

  function validarStep1(): boolean {
    if (!servico.trim()) { setErro('Descreva o serviço/acordo.'); return false; }
    if (!valor || parseFloat(valor) <= 0) { setErro('Informe o valor do serviço.'); return false; }
    if (pagamentoOpcao === 'outra' && !pagamentoLivre.trim()) {
      setErro('Descreva a forma de pagamento.'); return false;
    }
    setErro('');
    return true;
  }

  function validarDoc(docStr: string, tipoPessoa: 'pf' | 'pj'): boolean {
    return tipoPessoa === 'pj' ? validarCNPJ(docStr) : validarCPF(docStr);
  }

  function validarStep2(): boolean {
    if (!meuNome.trim()) { setErro('Informe o seu nome completo.'); return false; }
    if (!validarDoc(meuDoc, meuTipoPessoa)) {
      setErro(`Seu ${meuTipoPessoa === 'pj' ? 'CNPJ' : 'CPF'} é inválido.`); return false;
    }
    if (!minhaData) {
      setErro(`Informe sua data de ${meuTipoPessoa === 'pj' ? 'constituição da empresa' : 'nascimento'}.`); return false;
    }
    if (!outroNome.trim()) { setErro('Informe o nome da outra parte.'); return false; }
    if (!validarDoc(outroDoc, outroTipoPessoa)) {
      setErro(`O ${outroTipoPessoa === 'pj' ? 'CNPJ' : 'CPF'} da outra parte é inválido.`); return false;
    }
    if (!outraData) {
      setErro(`Informe a data de ${outroTipoPessoa === 'pj' ? 'constituição' : 'nascimento'} da outra parte.`); return false;
    }
    if (outroTelefone.replace(/\D/g, '').length < 10) {
      setErro('Informe o WhatsApp da outra parte (com DDD) — é por ele que ela receberá o contrato.'); return false;
    }
    setErro('');
    return true;
  }

  async function salvarRascunho(): Promise<boolean> {
    setLoading(true); setErro('');
    const outroPapel = meuPapel === 'prestador' ? 'contratante' : 'prestador';
    const payload = {
      criador_tipo: sessao!.tipo,
      criador_id: sessao!.usuario.id,
      servico_desc: servico,
      valor: parseFloat(valor),
      prazo,
      pagamento,
      garantia,
      partes: [
        {
          papel: 'criador', papel_contratual: meuPapel, tipo_pessoa: meuTipoPessoa,
          nome: meuNome, cpf_cnpj: meuDoc, data_referencia: minhaData,
          telefone: meuTelefone,
        },
        {
          papel: 'convidado', papel_contratual: outroPapel, tipo_pessoa: outroTipoPessoa,
          nome: outroNome, cpf_cnpj: outroDoc, data_referencia: outraData,
          telefone: outroTelefone,
        },
      ],
    };

    try {
      if (contrato) {
        const d = await apiCall(`/api/blindado/contratos/${contrato.id}`, { method: 'PUT', body: payload });
        setContrato(d.contrato);
        setPartes(d.partes);
      } else {
        const d = await apiCall('/api/blindado/contratos', { method: 'POST', body: payload });
        setContrato(d.contrato);
        setPartes(d.partes);
      }
      setLoading(false);
      return true;
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar rascunho.');
      setLoading(false);
      return false;
    }
  }

  async function recarregar() {
    if (!contrato) return;
    const d = await apiCall(`/api/blindado/token/${contrato.token}`);
    setContrato(d.contrato);
    setPartes(d.partes);
  }

  async function liberar() {
    setLoading(true); setErro('');
    try {
      const d = await apiCall(`/api/blindado/contratos/${contrato.id}/liberar`, {
        method: 'POST',
        body: { criador_tipo: sessao!.tipo, criador_id: sessao!.usuario.id },
      });
      setLinkGerado(d.link);
    } catch (e: any) {
      setErro(e.message || 'Erro ao liberar contrato.');
    }
    setLoading(false);
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkGerado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!sessao) return null;

  // ── TELA FINAL: link gerado ─────────────────────────────────
  if (linkGerado) {
    return (
      <div className="max-w-lg mx-auto p-4 py-12">
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-black text-[#1B2F6E] mb-2">Contrato liberado!</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Enviamos o link por WhatsApp para <b>{outroNome}</b>. Você também pode copiá-lo e enviar por onde preferir:
          </p>
          <div className="bg-slate-50 border border-border rounded-xl px-3 py-2.5 text-xs break-all mb-3">
            {linkGerado}
          </div>
          <button
            onClick={copiarLink}
            className="w-full flex items-center justify-center gap-2 border border-border rounded-xl px-4 py-3 text-sm font-semibold hover:bg-slate-50 mb-3"
          >
            <Copy className="h-4 w-4" /> {copiado ? 'Copiado!' : 'Copiar link'}
          </button>
          <Link
            to={`/blindado/c/${contrato.token}`}
            className="block w-full py-3 bg-[#1B2F6E] text-white rounded-xl font-bold"
          >
            Acompanhar contrato →
          </Link>
        </div>
      </div>
    );
  }

  const steps = ['Contrato', 'Partes', 'WhatsApp', 'Fotos', 'Revisão'];

  return (
    <div className="max-w-lg mx-auto p-4 py-8">
      {/* PROGRESS */}
      <div className="flex gap-1 mb-2">
        {steps.map((_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${step >= i + 1 ? 'bg-[#1B2F6E]' : 'bg-slate-200'}`} />
        ))}
      </div>
      <div className="text-xs text-muted-foreground mb-5">
        Passo {step} de 5 — {steps[step - 1]}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          {erro}
        </div>
      )}

      {/* STEP 1 — CONTRATO */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <div>
            <h2 className="font-black text-[#1B2F6E] text-lg">O que será contratado?</h2>
            <p className="text-xs text-muted-foreground">Criar e preparar o contrato é grátis — você só paga na hora de assinar.</p>
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1">Descrição do serviço/acordo *</label>
            <textarea
              value={servico}
              onChange={e => setServico(e.target.value)}
              rows={4}
              placeholder="Ex: Reforma completa do banheiro, incluindo troca de piso, revestimento e louças..."
              className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold block mb-1">Valor total (R$) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
              />
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1">Prazo de execução</label>
              <input
                value={prazo}
                onChange={e => setPrazo(e.target.value)}
                placeholder="Ex: 15 dias úteis"
                className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1">Forma de pagamento</label>
            <select
              value={pagamentoOpcao}
              onChange={e => setPagamentoOpcao(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E] bg-white"
            >
              {OPCOES_PAGAMENTO.map(o => <option key={o} value={o}>{o}</option>)}
              <option value="outra">Outra (descrever)</option>
            </select>
            {pagamentoOpcao === 'outra' && (
              <input
                value={pagamentoLivre}
                onChange={e => setPagamentoLivre(e.target.value)}
                placeholder="Ex: 30% na assinatura, 70% em 2x no PIX após entrega"
                className="mt-2 w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
              />
            )}
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1">Garantia pós-entrega</label>
            <input
              value={garantia}
              onChange={e => setGarantia(e.target.value)}
              placeholder="Ex: 90 dias"
              className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
            />
          </div>

          <button
            onClick={() => { if (validarStep1()) setStep(2); }}
            className="w-full py-3 bg-[#1B2F6E] text-white rounded-xl font-bold"
          >
            Continuar → Partes
          </button>
        </div>
      )}

      {/* STEP 2 — PARTES */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-black text-[#1B2F6E] text-lg">Seus dados</h2>

            <div>
              <label className="text-sm font-semibold block mb-1">Neste contrato, você é:</label>
              <div className="grid grid-cols-2 gap-2">
                {(['prestador', 'contratante'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setMeuPapel(p)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      meuPapel === p ? 'border-[#1B2F6E] bg-[#1B2F6E]/5 text-[#1B2F6E]' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {p === 'prestador' ? '🔧 Quem executa' : '🤝 Quem contrata'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-1">Nome completo *</label>
              <input
                value={meuNome}
                onChange={e => setMeuNome(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold block mb-1">Pessoa</label>
                <select
                  value={meuTipoPessoa}
                  onChange={e => { setMeuTipoPessoa(e.target.value as 'pf' | 'pj'); setMeuDoc(''); }}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-white"
                >
                  <option value="pf">Física (CPF)</option>
                  <option value="pj">Jurídica (CNPJ)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1">{meuTipoPessoa === 'pj' ? 'CNPJ' : 'CPF'} *</label>
                <input
                  value={meuDoc}
                  onChange={e => setMeuDoc(meuTipoPessoa === 'pj' ? mascaraCNPJ(e.target.value) : mascaraCPF(e.target.value))}
                  placeholder={meuTipoPessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold block mb-1">
                  {meuTipoPessoa === 'pj' ? 'Data de constituição *' : 'Data de nascimento *'}
                </label>
                <input
                  type="date"
                  value={minhaData}
                  onChange={e => setMinhaData(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
                />
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1">Seu WhatsApp</label>
                <input
                  type="tel"
                  value={meuTelefone}
                  onChange={e => setMeuTelefone(mascaraTelefone(e.target.value))}
                  placeholder="(55) 99999-9999"
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
            <div>
              <h2 className="font-black text-[#1B2F6E] text-lg">A outra parte</h2>
              <p className="text-xs text-muted-foreground">
                Será {meuPapel === 'prestador' ? 'quem contrata' : 'quem executa'} o serviço. Ela não precisa ter conta — receberá o link no WhatsApp.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-1">Nome completo *</label>
              <input
                value={outroNome}
                onChange={e => setOutroNome(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold block mb-1">Pessoa</label>
                <select
                  value={outroTipoPessoa}
                  onChange={e => { setOutroTipoPessoa(e.target.value as 'pf' | 'pj'); setOutroDoc(''); }}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-white"
                >
                  <option value="pf">Física (CPF)</option>
                  <option value="pj">Jurídica (CNPJ)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1">{outroTipoPessoa === 'pj' ? 'CNPJ' : 'CPF'} *</label>
                <input
                  value={outroDoc}
                  onChange={e => setOutroDoc(outroTipoPessoa === 'pj' ? mascaraCNPJ(e.target.value) : mascaraCPF(e.target.value))}
                  placeholder={outroTipoPessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold block mb-1">
                  {outroTipoPessoa === 'pj' ? 'Data de constituição *' : 'Data de nascimento *'}
                </label>
                <input
                  type="date"
                  value={outraData}
                  onChange={e => setOutraData(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
                />
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1">WhatsApp dela *</label>
                <input
                  type="tel"
                  value={outroTelefone}
                  onChange={e => setOutroTelefone(mascaraTelefone(e.target.value))}
                  placeholder="(55) 99999-9999"
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 border border-border rounded-xl font-semibold text-sm bg-white">
              ← Voltar
            </button>
            <button
              onClick={async () => {
                if (!validarStep2()) return;
                if (await salvarRascunho()) setStep(3);
              }}
              disabled={loading}
              className="flex-1 py-3 bg-[#1B2F6E] text-white rounded-xl font-bold text-sm disabled:opacity-40"
            >
              {loading ? 'Salvando...' : 'Continuar → WhatsApp'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — OTP DO CRIADOR */}
      {step === 3 && contrato && criador && (
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <div>
            <h2 className="font-black text-[#1B2F6E] text-lg">📱 Valide seu WhatsApp</h2>
            <p className="text-xs text-muted-foreground">
              A validação do telefone é uma das evidências de autenticidade do contrato.
            </p>
          </div>

          <OtpInput
            token={contrato.token}
            parteId={criador.id}
            telefoneInicial={criador.telefone}
            validado={criador.telefone_validado}
            onValidado={recarregar}
          />

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-3 border border-border rounded-xl font-semibold text-sm">
              ← Voltar
            </button>
            <button
              onClick={() => {
                if (!criador.telefone_validado) { setErro('Valide seu WhatsApp para continuar.'); return; }
                setErro(''); setStep(4);
              }}
              disabled={!criador.telefone_validado}
              className="flex-1 py-3 bg-[#1B2F6E] text-white rounded-xl font-bold text-sm disabled:opacity-40"
            >
              Continuar → Fotos
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — ANEXOS DO CRIADOR */}
      {step === 4 && contrato && criador && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-border p-6">
            <h2 className="font-black text-[#1B2F6E] text-lg">📷 Suas fotos (opcional)</h2>
            <p className="text-xs text-muted-foreground">
              Selfie e documento fortalecem a segurança jurídica — mas você pode pular esta etapa.
            </p>
          </div>

          <AnexosParte
            token={contrato.token}
            parteId={criador.id}
            selfieUrl={criador.selfie_url}
            documentoUrl={criador.documento_url}
            onAtualizado={recarregar}
          />

          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex-1 py-3 border border-border rounded-xl font-semibold text-sm bg-white">
              ← Voltar
            </button>
            <button
              onClick={() => setStep(5)}
              className="flex-1 py-3 bg-[#1B2F6E] text-white rounded-xl font-bold text-sm"
            >
              {criador.selfie_url || criador.documento_url ? 'Continuar → Revisão' : 'Pular → Revisão'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5 — REVISÃO + LIBERAR */}
      {step === 5 && contrato && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-border p-6">
            <h2 className="font-black text-[#1B2F6E] text-lg mb-4">📋 Revise o contrato</h2>

            <div className="space-y-2 text-sm">
              <Linha titulo="Código" valor={contrato.codigo} />
              <Linha titulo="Serviço" valor={servico} />
              <Linha titulo="Valor" valor={formatarValor(valor)} destaque />
              <Linha titulo="Pagamento" valor={pagamento} />
              <Linha titulo="Prazo" valor={prazo || 'A combinar'} />
              <Linha titulo="Garantia" valor={garantia || '--'} />
              <div className="border-t border-border my-3" />
              <Linha titulo={meuPapel === 'prestador' ? 'Prestador (você)' : 'Contratante (você)'} valor={`${meuNome} — ${meuDoc}`} />
              <Linha titulo={meuPapel === 'prestador' ? 'Contratante' : 'Prestador'} valor={`${outroNome} — ${outroDoc}`} />
            </div>
          </div>

          <div className="bg-[#0D1B3E] text-white rounded-2xl p-5 flex gap-3">
            <ShieldCheck className="h-6 w-6 text-[#E8C547] shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              Ao liberar, o conteúdo do contrato é <b>congelado com hash SHA-256</b> e o link é enviado
              por WhatsApp para {outroNome}. A assinatura custa <b className="text-[#E8C547]">1 crédito (R$ 9,90)</b> —
              cobrado só na hora de assinar, depois que ambos revisarem tudo.
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(4)} className="flex-1 py-3 border border-border rounded-xl font-semibold text-sm bg-white">
              ← Voltar
            </button>
            <button
              onClick={liberar}
              disabled={loading}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm disabled:opacity-40"
            >
              {loading ? 'Liberando...' : '🔓 Liberar e enviar link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Linha({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <div className="text-muted-foreground text-xs pt-0.5 shrink-0">{titulo}</div>
      <div className={`text-right ${destaque ? 'font-bold text-green-700' : ''}`}>{valor}</div>
    </div>
  );
}
