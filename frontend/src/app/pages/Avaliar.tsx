import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Star } from 'lucide-react';
import { apiCall } from '../../lib/supabase';
import { Logo } from '../components/Logo';

export function Avaliar() {
  const { token } = useParams<{ token: string }>();
  const [contexto, setContexto] = useState<any>(null);
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) return;
    apiCall(`/api/avaliar/${token}`)
      .then(setContexto)
      .catch(e => setErro(e.message || 'Link inválido ou expirado.'));
  }, [token]);

  async function enviar() {
    if (!nota) { setErro('Selecione uma nota de 1 a 5 estrelas.'); return; }
    setEnviando(true);
    setErro('');
    try {
      await apiCall(`/api/avaliar/${token}`, {
        method: 'POST',
        body: { nota, comentario },
      });
      setConcluido(true);
    } catch (e: any) {
      setErro(e.message || 'Erro ao enviar avaliação.');
    }
    setEnviando(false);
  }

  const labelNota = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];

  if (erro && !contexto) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Logo />
          <p className="mt-6 text-red-500 font-medium">{erro}</p>
          <p className="text-sm text-gray-400 mt-2">O link pode ter expirado (válido por 7 dias) ou já foi usado.</p>
        </div>
      </div>
    );
  }

  if (!contexto) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (contexto.expirado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Logo />
          <p className="mt-6 text-amber-600 font-medium">Link expirado</p>
          <p className="text-sm text-gray-400 mt-2">O prazo para avaliação (7 dias) foi encerrado.</p>
        </div>
      </div>
    );
  }

  if (contexto.ja_avaliou) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Logo />
          <div className="mt-6 text-5xl">✅</div>
          <p className="mt-4 font-semibold text-gray-800">Avaliação já enviada!</p>
          <p className="text-sm text-gray-500 mt-1">Você já avaliou este serviço. Obrigado!</p>
        </div>
      </div>
    );
  }

  if (concluido) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Logo />
          <div className="mt-6 text-6xl">🌟</div>
          <p className="mt-4 font-bold text-gray-800 text-xl">Obrigado pela avaliação!</p>
          <p className="text-sm text-gray-500 mt-2">
            Sua opinião ajuda a comunidade do Serviço Seguro a tomar melhores decisões.
          </p>
        </div>
      </div>
    );
  }

  const papelLabel = contexto.papel === 'cliente' ? '👤 Cliente' : '👷 Profissional';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Logo />
          <p className="mt-4 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Avaliação — {contexto.codigo}
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-center">
          <p className="text-xs text-muted-foreground mb-1">Você está avaliando</p>
          <p className="text-lg font-bold text-gray-800">{contexto.avaliado_nome}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {contexto.avaliado_tipo === 'prestador' ? '👷 Profissional' : '👤 Cliente'}
          </p>
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">
            Como foi a experiência?
          </p>
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map(i => (
              <button
                key={i}
                onClick={() => setNota(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={36}
                  className={`transition-colors ${
                    i <= (hover || nota)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          {(hover || nota) > 0 && (
            <p className="text-center text-sm font-semibold text-amber-600">
              {labelNota[hover || nota]}
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Comentário <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            placeholder={`O que você achou ${contexto.avaliado_tipo === 'prestador' ? 'do serviço prestado?' : 'da experiência com o cliente?'}`}
            rows={3}
            maxLength={500}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary resize-none"
          />
          <p className="text-right text-xs text-muted-foreground mt-1">{comentario.length}/500</p>
        </div>

        {erro && <p className="text-red-500 text-sm mb-4 text-center">{erro}</p>}

        <button
          onClick={enviar}
          disabled={enviando || !nota}
          className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {enviando ? 'Enviando...' : '⭐ Enviar avaliação'}
        </button>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Sua avaliação é anônima para o público. O Serviço Seguro pode usá-la para garantir a qualidade da plataforma.
        </p>
      </div>
    </div>
  );
}
