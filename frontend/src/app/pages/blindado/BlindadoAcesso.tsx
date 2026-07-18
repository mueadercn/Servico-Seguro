import { useState } from 'react';
import { Link } from 'react-router';
import { Search, Download, FileText } from 'lucide-react';
import { apiCall } from '../../../lib/supabase';
import { mascaraCPF, mascaraCNPJ } from '../../utils/validacoes';
import { formatarValor, formatarData, API_URL } from './util';

// Acesso aos contratos assinados SEM cadastro:
// CPF + data de nascimento (PF) ou CNPJ + data de constituição (PJ).
export function BlindadoAcesso() {
  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj'>('pf');
  const [doc, setDoc] = useState('');
  const [data, setData] = useState('');
  const [contratos, setContratos] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function buscar() {
    const digits = doc.replace(/\D/g, '');
    if (tipoPessoa === 'pf' && digits.length !== 11) { setErro('Informe um CPF válido.'); return; }
    if (tipoPessoa === 'pj' && digits.length !== 14) { setErro('Informe um CNPJ válido.'); return; }
    if (!data) { setErro(`Informe a data de ${tipoPessoa === 'pj' ? 'constituição' : 'nascimento'}.`); return; }

    setLoading(true); setErro(''); setContratos(null);
    try {
      const d = await apiCall('/api/blindado/acesso', {
        method: 'POST',
        body: { cpf_cnpj: digits, data_referencia: data },
      });
      setContratos(d.contratos || []);
    } catch (e: any) {
      setErro(e.message || 'Erro ao buscar contratos. Tente novamente em alguns minutos.');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto p-4 py-10">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black text-[#1B2F6E]">Acessar meus contratos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assinou um Contrato Blindado sem ter conta? Recupere seus contratos com seus dados.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['pf', 'pj'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTipoPessoa(t); setDoc(''); }}
              className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                tipoPessoa === t ? 'border-[#1B2F6E] bg-[#1B2F6E]/5 text-[#1B2F6E]' : 'border-border text-muted-foreground'
              }`}
            >
              {t === 'pf' ? '👤 Pessoa Física' : '🏢 Pessoa Jurídica'}
            </button>
          ))}
        </div>

        <div>
          <label className="text-sm font-semibold block mb-1">{tipoPessoa === 'pj' ? 'CNPJ' : 'CPF'}</label>
          <input
            value={doc}
            onChange={e => setDoc(tipoPessoa === 'pj' ? mascaraCNPJ(e.target.value) : mascaraCPF(e.target.value))}
            placeholder={tipoPessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
          />
        </div>

        <div>
          <label className="text-sm font-semibold block mb-1">
            {tipoPessoa === 'pj' ? 'Data de constituição da empresa' : 'Data de nascimento'}
          </label>
          <input
            type="date"
            value={data}
            onChange={e => setData(e.target.value)}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
          />
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {erro}
          </div>
        )}

        <button
          onClick={buscar}
          disabled={loading}
          className="w-full py-3 bg-[#1B2F6E] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Search className="h-4 w-4" />
          {loading ? 'Buscando...' : 'Buscar meus contratos'}
        </button>
      </div>

      {contratos !== null && (
        <div className="mt-5">
          {contratos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <div className="font-bold text-sm">Nenhum contrato encontrado</div>
              <div className="text-xs text-muted-foreground mt-1">
                Confira se os dados são exatamente os mesmos usados no contrato.
                Só aparecem aqui contratos totalmente assinados.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-[#1B2F6E]">
                {contratos.length} contrato{contratos.length > 1 ? 's' : ''} encontrado{contratos.length > 1 ? 's' : ''}:
              </div>
              {contratos.map(c => (
                <div key={c.codigo} className="bg-white rounded-2xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{c.codigo}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-800">Assinado</span>
                  </div>
                  <div className="font-semibold text-sm truncate">{c.servico_desc}</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {formatarValor(c.valor)} • Assinado em {formatarData(c.assinado_em)}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/blindado/c/${c.token}`}
                      className="px-4 py-2 bg-[#1B2F6E] text-white rounded-lg font-semibold text-xs"
                    >
                      Ver online →
                    </Link>
                    <a
                      href={`${API_URL}/api/blindado/token/${c.token}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg font-semibold text-xs hover:bg-slate-50"
                    >
                      <Download className="h-3 w-3" /> Baixar PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
