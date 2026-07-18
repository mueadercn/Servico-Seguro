import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Coins } from 'lucide-react';
import { apiCall } from '../../../lib/supabase';
import { CompraCreditos } from '../../components/blindado/CompraCreditos';
import { getSessaoBlindado } from './util';

export function BlindadoCreditos() {
  const navigate = useNavigate();
  const sessao = getSessaoBlindado();
  const [saldo, setSaldo] = useState<number | null>(null);

  useEffect(() => {
    if (!sessao) { navigate('/auth'); return; }
    carregarSaldo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function carregarSaldo() {
    apiCall(`/api/blindado/pagamentos/saldo?user_tipo=${sessao!.tipo}&user_id=${sessao!.usuario.id}`)
      .then(d => setSaldo(d.saldo))
      .catch(() => setSaldo(0));
  }

  if (!sessao) return null;

  return (
    <div className="max-w-lg mx-auto p-4 py-8">
      <Link to="/blindado/painel" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#1B2F6E] mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <div className="bg-[#0D1B3E] text-white rounded-2xl p-6 mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-white/60 uppercase tracking-wide">Seu saldo</div>
          <div className="text-3xl font-black text-[#E8C547]">
            {saldo === null ? '...' : `${saldo} crédito${saldo !== 1 ? 's' : ''}`}
          </div>
          <div className="text-xs text-white/60 mt-0.5">1 crédito = 1 contrato assinado</div>
        </div>
        <Coins className="h-12 w-12 text-[#E8C547]/40" />
      </div>

      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="font-black text-[#1B2F6E] mb-1">Comprar créditos</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Pagamento via PIX com confirmação automática. Quanto maior o pacote, menor o valor por contrato.
        </p>
        <CompraCreditos
          userTipo={sessao.tipo}
          userId={sessao.usuario.id}
          onSucesso={carregarSaldo}
        />
      </div>
    </div>
  );
}
