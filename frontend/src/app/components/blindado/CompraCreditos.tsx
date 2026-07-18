import { useState, useEffect, useRef } from 'react';
import { Copy, CheckCircle2, QrCode } from 'lucide-react';
import { apiCall } from '../../../lib/supabase';
import { formatarCentavos } from '../../pages/blindado/util';

interface Pacote {
  id: string;
  qtd: number;
  valor_centavos: number;
  label: string;
}

// Compra de pacotes de créditos via PIX (Stripe).
// Usado na página /blindado/creditos e inline na página do contrato.
export function CompraCreditos({
  userTipo,
  userId,
  onSucesso,
}: {
  userTipo: string;
  userId: string;
  onSucesso: () => void;
}) {
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [selecionado, setSelecionado] = useState<string>('p3');
  const [cobranca, setCobranca] = useState<any>(null);
  const [pago, setPago] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    apiCall('/api/blindado/pagamentos/pacotes')
      .then(d => setPacotes(d.pacotes || []))
      .catch(() => setErro('Falha ao carregar pacotes.'));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function comprar() {
    setLoading(true); setErro('');
    try {
      const d = await apiCall('/api/blindado/pagamentos/checkout', {
        method: 'POST',
        body: { user_tipo: userTipo, user_id: userId, pacote_id: selecionado },
      });
      setCobranca(d);
      iniciarPolling(d.payment_intent_id);
    } catch (e: any) {
      setErro(e.message || 'Erro ao gerar cobrança PIX.');
    }
    setLoading(false);
  }

  function iniciarPolling(paymentIntentId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const d = await apiCall(`/api/blindado/pagamentos/status/${paymentIntentId}`);
        if (d.status === 'pago') {
          clearInterval(pollRef.current);
          setPago(true);
          onSucesso();
        } else if (d.status === 'falhou') {
          clearInterval(pollRef.current);
          setErro('Pagamento não concluído. Tente novamente.');
          setCobranca(null);
        }
      } catch { /* mantém polling */ }
    }, 3000);
  }

  function copiar() {
    navigator.clipboard.writeText(cobranca.copia_cola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (pago) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
        <div className="font-bold text-green-800 text-lg">Pagamento confirmado!</div>
        <div className="text-sm text-green-700 mt-1">Seus créditos já estão disponíveis.</div>
      </div>
    );
  }

  if (cobranca) {
    return (
      <div className="bg-white border border-border rounded-2xl p-6 text-center">
        <div className="font-bold text-[#1B2F6E] mb-1">
          Pague {formatarCentavos(cobranca.valor_centavos)} via PIX
        </div>
        <div className="text-xs text-muted-foreground mb-4">
          Escaneie o QR code ou use o copia-e-cola. A confirmação é automática.
        </div>

        {cobranca.qr_png ? (
          <img
            src={cobranca.qr_png}
            alt="QR Code PIX"
            className="w-48 h-48 mx-auto rounded-xl border border-border"
          />
        ) : (
          <QrCode className="h-24 w-24 mx-auto text-muted-foreground" />
        )}

        {cobranca.copia_cola && (
          <button
            onClick={copiar}
            className="mt-4 w-full flex items-center justify-center gap-2 border border-border rounded-xl px-4 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            <Copy className="h-4 w-4" />
            {copiado ? 'Copiado!' : 'Copiar código PIX'}
          </button>
        )}

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 border-2 border-[#1B2F6E] border-t-transparent rounded-full animate-spin" />
          Aguardando pagamento...
        </div>
      </div>
    );
  }

  return (
    <div>
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-3">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {pacotes.map(p => {
          const unitario = p.valor_centavos / p.qtd;
          const ativo = selecionado === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelecionado(p.id)}
              className={`rounded-xl border-2 p-4 text-center transition-all ${
                ativo ? 'border-[#1B2F6E] bg-[#1B2F6E]/5' : 'border-border hover:border-[#1B2F6E]/40'
              }`}
            >
              <div className="text-2xl font-black text-[#1B2F6E]">{p.qtd}</div>
              <div className="text-xs text-muted-foreground mb-1">
                contrato{p.qtd > 1 ? 's' : ''}
              </div>
              <div className="font-bold text-sm">{formatarCentavos(p.valor_centavos)}</div>
              <div className="text-[10px] text-muted-foreground">
                {formatarCentavos(Math.round(unitario))}/un
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={comprar}
        disabled={loading || !selecionado}
        className="w-full py-3 bg-[#1B2F6E] text-white rounded-xl font-bold disabled:opacity-40"
      >
        {loading ? 'Gerando PIX...' : 'Pagar com PIX'}
      </button>
    </div>
  );
}
