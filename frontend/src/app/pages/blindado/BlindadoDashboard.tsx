import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Copy, Download, Coins, FileText } from 'lucide-react';
import { apiCall } from '../../../lib/supabase';
import { getSessaoBlindado, formatarValor, formatarData, STATUS_LABEL, API_URL } from './util';

export function BlindadoDashboard() {
  const navigate = useNavigate();
  const sessao = getSessaoBlindado();

  const [contratos, setContratos] = useState<any[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    if (!sessao) { navigate('/auth'); return; }
    apiCall(`/api/blindado/contratos/meus?criador_tipo=${sessao.tipo}&criador_id=${sessao.usuario.id}`)
      .then(d => { setContratos(d.contratos || []); setSaldo(d.saldo || 0); })
      .catch(() => {})
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copiarLink(c: any) {
    navigator.clipboard.writeText(`${window.location.origin}/blindado/c/${c.token}`);
    setCopiado(c.id);
    setTimeout(() => setCopiado(''), 2000);
  }

  if (!sessao) return null;

  return (
    <div className="max-w-3xl mx-auto p-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#1B2F6E]">Meus Contratos Blindados</h1>
          <div className="text-sm text-muted-foreground">Olá, {sessao.usuario.nome?.split(' ')[0]} 👋</div>
        </div>
        <div className="flex gap-2">
          <Link
            to="/blindado/creditos"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E8C547] text-[#0D1B3E] rounded-xl font-bold text-sm"
          >
            <Coins className="h-4 w-4" /> {saldo} crédito{saldo !== 1 ? 's' : ''}
          </Link>
          <Link
            to="/blindado/novo"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1B2F6E] text-white rounded-xl font-bold text-sm"
          >
            <Plus className="h-4 w-4" /> Novo contrato
          </Link>
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#1B2F6E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : contratos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-10 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <div className="font-bold text-[#1B2F6E]">Nenhum contrato ainda</div>
          <div className="text-sm text-muted-foreground mt-1 mb-5">
            Crie seu primeiro Contrato Blindado — é grátis até a hora de assinar.
          </div>
          <Link
            to="/blindado/novo"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B2F6E] text-white rounded-xl font-bold text-sm"
          >
            <Plus className="h-4 w-4" /> Criar contrato
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {contratos.map(c => {
            const st = STATUS_LABEL[c.status] || STATUS_LABEL.rascunho;
            const convidado = (c.blindado_partes || []).find((p: any) => p.papel === 'convidado');
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{c.codigo}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${st.cor}`}>{st.label}</span>
                      {c.status === 'liberado' && !c.pago && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">🔒 Pagamento pendente</span>
                      )}
                    </div>
                    <div className="font-semibold text-sm mt-1 truncate">{c.servico_desc || 'Sem descrição'}</div>
                    <div className="text-xs text-muted-foreground">
                      {convidado ? `Com: ${convidado.nome}` : ''} • {formatarValor(c.valor)} • {formatarData(c.criado_em)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {c.status === 'rascunho' ? (
                    <Link
                      to={`/blindado/novo/${c.id}`}
                      className="px-4 py-2 bg-[#1B2F6E] text-white rounded-lg font-semibold text-xs"
                    >
                      Continuar rascunho →
                    </Link>
                  ) : (
                    <Link
                      to={`/blindado/c/${c.token}`}
                      className="px-4 py-2 bg-[#1B2F6E] text-white rounded-lg font-semibold text-xs"
                    >
                      Abrir contrato →
                    </Link>
                  )}
                  {c.status !== 'rascunho' && (
                    <button
                      onClick={() => copiarLink(c)}
                      className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg font-semibold text-xs hover:bg-slate-50"
                    >
                      <Copy className="h-3 w-3" /> {copiado === c.id ? 'Copiado!' : 'Copiar link'}
                    </button>
                  )}
                  {c.status === 'assinado' && (
                    <a
                      href={`${API_URL}/api/blindado/token/${c.token}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg font-semibold text-xs hover:bg-slate-50"
                    >
                      <Download className="h-3 w-3" /> PDF
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
