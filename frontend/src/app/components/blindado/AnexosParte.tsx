import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { apiCall } from '../../../lib/supabase';
import { CapturaFoto } from '../CapturaFoto';

// Anexos opcionais de uma parte: selfie + documento.
// As imagens NÃO são validadas pela plataforma — são evidências conferidas
// mutuamente pelas partes e embutidas no PDF final.
export function AnexosParte({
  token,
  parteId,
  selfieUrl,
  documentoUrl,
  bloqueado,
  onAtualizado,
}: {
  token: string;
  parteId: string;
  selfieUrl?: string | null;
  documentoUrl?: string | null;
  bloqueado?: boolean;
  onAtualizado: () => void;
}) {
  const [enviando, setEnviando] = useState<'selfie' | 'documento' | null>(null);
  const [erro, setErro] = useState('');

  async function enviar(tipo: 'selfie' | 'documento', dataUrl: string) {
    setEnviando(tipo); setErro('');
    try {
      const base64 = dataUrl.split(',')[1];
      await apiCall(`/api/blindado/token/${token}/anexo`, {
        method: 'POST',
        body: { parte_id: parteId, tipo, base64, mimeType: 'image/jpeg' },
      });
      onAtualizado();
    } catch (e: any) {
      setErro(e.message || 'Falha ao enviar imagem.');
    }
    setEnviando(null);
  }

  async function remover(tipo: 'selfie' | 'documento') {
    setErro('');
    try {
      await apiCall(`/api/blindado/token/${token}/anexo`, {
        method: 'DELETE',
        body: { parte_id: parteId, tipo },
      });
      onAtualizado();
    } catch (e: any) {
      setErro(e.message || 'Falha ao remover imagem.');
    }
  }

  function bloco(tipo: 'selfie' | 'documento', titulo: string, descricao: string, url?: string | null) {
    return (
      <div className="bg-white border border-border rounded-2xl p-4">
        <div className="font-bold text-sm text-[#1B2F6E] mb-0.5">{titulo}</div>
        <div className="text-xs text-muted-foreground mb-3">{descricao}</div>

        {url ? (
          <div>
            <img src={url} alt={titulo} className="w-full rounded-xl border border-border max-h-48 object-contain bg-slate-50" />
            {!bloqueado && (
              <button
                onClick={() => remover(tipo)}
                className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Remover e enviar outra
              </button>
            )}
          </div>
        ) : bloqueado ? (
          <div className="text-xs text-muted-foreground italic">Não anexada.</div>
        ) : enviando === tipo ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
            <div className="w-4 h-4 border-2 border-[#1B2F6E] border-t-transparent rounded-full animate-spin" />
            Enviando...
          </div>
        ) : (
          <CapturaFoto modo={tipo === 'selfie' ? 'selfie' : 'documento'} onCapture={d => enviar(tipo, d)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {erro}
        </div>
      )}
      {bloco('selfie', '🤳 Sua selfie (opcional)', 'Uma foto sua, de rosto visível. Sai na página de evidências do contrato.', selfieUrl)}
      {bloco('documento', '📄 Seu documento (opcional)', 'RG, CNH ou outro documento com foto. Sai na página de evidências do contrato.', documentoUrl)}
      <div className="text-[11px] text-muted-foreground">
        As imagens são anexos voluntários, conferidos entre as próprias partes — a plataforma não faz validação documental.
      </div>
    </div>
  );
}
