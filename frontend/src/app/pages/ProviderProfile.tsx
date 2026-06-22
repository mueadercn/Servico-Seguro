import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { ArrowLeft, MapPin, Shield, Star, MessageCircle, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const WHATSAPP_NUMERO = '555591598658';
const TEAL = 'oklch(0.6 0.118 184.704)';

export function ProviderProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [prestador, setPrestador] = useState<any>(null);
  const [servicos, setServicos] = useState<any[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    carregarPerfil();
  }, [id]);

  async function carregarPerfil() {
    setLoading(true);
    try {
      // Dados do prestador
      const { data: p, error: errP } = await supabase
        .from('prestadores')
        .select('*')
        .eq('id', id)
        .single();
      if (errP || !p) { setLoading(false); return; }
      setPrestador(p);

      // Categorias via tabela de ligação (query separada para evitar falha de FK)
      const { data: pcs } = await supabase
        .from('prestador_categorias')
        .select('categorias(id, nome, icone)')
        .eq('prestador_id', id);
      if (pcs) {
        setPrestador((prev: any) => ({ ...prev, _categorias: pcs.map((r: any) => r.categorias).filter(Boolean) }));
      }

      // Serviços do prestador
      const { data: svs } = await supabase
        .from('servicos')
        .select('*, categorias(nome, icone)')
        .eq('prestador_id', id)
        .eq('ativo', true)
        .order('criado_em', { ascending: false });
      setServicos(svs || []);

      // Avaliações
      const { data: avs } = await supabase
        .from('avaliacoes')
        .select('nota, comentario, criado_em, avaliador')
        .eq('avaliado_id', id)
        .eq('avaliado_tipo', 'prestador')
        .order('criado_em', { ascending: false })
        .limit(6);
      setAvaliacoes(avs || []);
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#030213', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!prestador) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="font-bold text-[#030213] mb-2">Perfil não encontrado</h2>
          <Link to="/" className="text-sm text-[#717182] hover:underline">← Voltar ao início</Link>
        </div>
      </div>
    );
  }

  const categorias = prestador._categorias || [];
  const notaArredondada = Number(prestador.nota_media || 0).toFixed(1);
  const totalAvaliacoes = prestador.total_avaliacoes || 0;

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
        <div className="max-w-[720px] mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-[8px] hover:bg-slate-100 transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#030213]" />
          </button>
          <span className="font-bold text-sm text-[#030213]">Perfil do Profissional</span>
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-4 py-6 space-y-5">

        {/* Card principal do prestador */}
        <div className="bg-white rounded-[20px] p-6" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="flex items-start gap-4">
            {/* Foto */}
            {prestador.foto_url ? (
              <img src={prestador.foto_url} alt={prestador.nome}
                className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                style={{ border: '3px solid rgba(3,2,19,0.08)' }} />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl flex-shrink-0"
                style={{ background: '#030213' }}>
                {prestador.nome?.charAt(0) || '?'}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h1 className="text-xl font-extrabold text-[#030213] leading-tight">{prestador.nome}</h1>
                  {prestador.razao_social && prestador.razao_social !== prestador.nome && (
                    <p className="text-xs text-[#717182] mt-0.5">{prestador.razao_social}</p>
                  )}
                </div>
                {prestador.verificado && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: '#f0fdf4', color: '#166534' }}>
                    <Shield className="h-3 w-3" /> Verificado
                  </span>
                )}
              </div>

              {prestador.cidade && (
                <div className="flex items-center gap-1 mt-2 text-sm" style={{ color: '#717182' }}>
                  <MapPin className="h-3.5 w-3.5" /> {prestador.cidade}{prestador.estado ? `, ${prestador.estado}` : ''}
                </div>
              )}

              {/* Nota */}
              {totalAvaliacoes > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-sm text-[#030213]">{notaArredondada}</span>
                  <span className="text-xs text-[#717182]">({totalAvaliacoes} avaliação{totalAvaliacoes !== 1 ? 'ões' : ''})</span>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {prestador.aceita_orcamento_online && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                    💬 Orçamento sem visita
                  </span>
                )}
                {categorias.map((cat: any) => (
                  <span key={cat.id} className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(3,2,19,0.05)', color: '#030213' }}>
                    {cat.icone} {cat.nome}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bio */}
          {prestador.bio && (
            <p className="mt-4 text-sm leading-relaxed text-[#717182] border-t pt-4"
              style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
              {prestador.bio}
            </p>
          )}
        </div>

        {/* Serviços */}
        {servicos.length > 0 && (
          <div>
            <h2 className="font-bold text-base text-[#030213] mb-3">Serviços disponíveis</h2>
            <div className="space-y-3">
              {servicos.map(s => (
                <div key={s.id} className="bg-white rounded-[16px] p-4"
                  style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{s.categorias?.icone || '🔧'}</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                          {s.categorias?.nome}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-[#030213]">{s.titulo}</h3>
                      {s.descricao && (
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: '#717182' }}>{s.descricao}</p>
                      )}
                      {s.tipo === 'fixo' && s.valor_fixo && (
                        <p className="font-bold text-sm mt-2" style={{ color: TEAL }}>
                          R$ {Number(s.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                        '#SERVICO:' + s.id + '|#PRESTADOR:' + prestador.id + '|#CAT:' + (s.categorias?.nome || '') +
                        '\n\nOlá! Tenho interesse em:\n🔧 ' + s.titulo
                      )}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] font-bold text-xs text-white"
                      style={{ background: '#030213' }}>
                      <Phone className="h-3.5 w-3.5" /> Via WhatsApp
                    </a>
                    <Link
                      to={`/orcamento?servico=${s.id}&nome=${encodeURIComponent(s.titulo)}&cat=${encodeURIComponent(s.categorias?.nome || '')}`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] font-bold text-xs"
                      style={{ background: '#f8fafc', border: '1px solid rgba(0,0,0,0.1)', color: '#030213' }}>
                      <MessageCircle className="h-3.5 w-3.5" /> Via Chat
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Avaliações */}
        {avaliacoes.length > 0 && (
          <div>
            <h2 className="font-bold text-base text-[#030213] mb-3">
              Avaliações <span className="text-[#94a3b8] font-normal text-sm">({totalAvaliacoes})</span>
            </h2>
            <div className="space-y-3">
              {avaliacoes.map((av: any, i: number) => (
                <div key={i} className="bg-white rounded-[14px] p-4" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className="h-3.5 w-3.5"
                          style={{ color: n <= av.nota ? '#f59e0b' : '#e2e8f0', fill: n <= av.nota ? '#f59e0b' : '#e2e8f0' }} />
                      ))}
                    </div>
                    <span className="text-xs text-[#94a3b8]">
                      {new Date(av.criado_em).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {av.comentario && (
                    <p className="text-sm leading-relaxed" style={{ color: '#717182' }}>{av.comentario}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {servicos.length === 0 && (
          <div className="text-center py-8 text-[#94a3b8] text-sm">
            Nenhum serviço cadastrado ainda.
          </div>
        )}
      </div>
    </div>
  );
}
