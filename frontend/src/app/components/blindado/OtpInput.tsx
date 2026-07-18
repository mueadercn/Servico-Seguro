import { useState, useEffect } from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { apiCall } from '../../../lib/supabase';
import { mascaraTelefone } from '../../pages/blindado/util';

// Validação de telefone via código WhatsApp (OTP).
export function OtpInput({
  token,
  parteId,
  telefoneInicial,
  validado,
  onValidado,
}: {
  token: string;
  parteId: string;
  telefoneInicial?: string | null;
  validado: boolean;
  onValidado: () => void;
}) {
  const [telefone, setTelefone] = useState(() => {
    const d = (telefoneInicial || '').replace(/\D/g, '');
    return mascaraTelefone(d.startsWith('55') ? d.slice(2) : d);
  });
  const [codigo, setCodigo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function enviar() {
    const digits = telefone.replace(/\D/g, '');
    if (digits.length < 10) { setErro('Informe um telefone válido com DDD.'); return; }
    setLoading(true); setErro('');
    try {
      await apiCall(`/api/blindado/token/${token}/otp/enviar`, {
        method: 'POST',
        body: { parte_id: parteId, telefone: digits },
      });
      setEnviado(true);
      setCountdown(60);
      setCodigo('');
    } catch (e: any) {
      setErro(e.message || 'Falha ao enviar o código.');
    }
    setLoading(false);
  }

  async function verificar() {
    if (codigo.replace(/\D/g, '').length !== 6) { setErro('Digite o código de 6 dígitos.'); return; }
    setLoading(true); setErro('');
    try {
      await apiCall(`/api/blindado/token/${token}/otp/verificar`, {
        method: 'POST',
        body: { parte_id: parteId, codigo: codigo.replace(/\D/g, '') },
      });
      onValidado();
    } catch (e: any) {
      setErro(e.message || 'Código incorreto.');
    }
    setLoading(false);
  }

  if (validado) {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <div className="text-sm font-semibold text-green-800">WhatsApp validado ✓</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {erro}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="tel"
          value={telefone}
          onChange={e => setTelefone(mascaraTelefone(e.target.value))}
          placeholder="(55) 99999-9999"
          disabled={enviado && countdown > 0}
          className="flex-1 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1B2F6E]"
        />
        <button
          onClick={enviar}
          disabled={loading || countdown > 0}
          className="px-4 py-3 bg-[#1B2F6E] text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          {countdown > 0 ? `Reenviar (${countdown}s)` : enviado ? 'Reenviar' : 'Validar'}
        </button>
      </div>

      {enviado && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Enviamos um código de 6 dígitos para o seu WhatsApp. Digite-o abaixo:
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="flex-1 border border-border rounded-xl px-4 py-3 text-center text-xl font-mono tracking-[0.5em] focus:outline-none focus:border-[#1B2F6E]"
            />
            <button
              onClick={verificar}
              disabled={loading || codigo.length !== 6}
              className="px-5 py-3 bg-green-600 text-white rounded-xl font-bold text-sm disabled:opacity-40"
            >
              {loading ? '...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
