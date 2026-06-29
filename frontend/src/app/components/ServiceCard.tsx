import { MessageCircle } from 'lucide-react';
import { getCategoryDesign } from '../lib/categoryDesign';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getInitials(nome: string): string {
  if (!nome) return '?';
  const parts = nome.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function ServiceCard({ s, onClick }: { s: any; onClick: () => void }) {
  const catNome: string = s.categorias?.nome || '';
  const design = getCategoryDesign(catNome);
  const Icon = design.Icon;
  const nota = Number(s.prestadores?.nota_media || 0);
  const aceitaOnline = s.aceita_orcamento_online || s.prestadores?.aceita_orcamento_online;
  const price = s.tipo === 'fixo' && s.valor_fixo ? Number(s.valor_fixo) : 0;

  return (
    <div
      onClick={onClick}
      className="border border-[rgba(0,0,0,0.08)] rounded-[18px] overflow-hidden hover:shadow-[0_16px_40px_-20px_rgba(3,2,19,0.3)] hover:-translate-y-0.5 transition-all cursor-pointer bg-white"
    >
      {/* ── BANNER DA CATEGORIA ── */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '20/13', background: design.gradient }}>
        {/* textura sutil */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 78% 30%, rgba(255,255,255,0.10), transparent 60%)' }} />

        {/* Orça online — topo esquerda */}
        {aceitaOnline && (
          <span className="absolute top-2.5 left-2.5 z-[3] flex items-center gap-1 bg-white/95 px-2.5 py-[5px] rounded-full text-[11px] font-semibold whitespace-nowrap"
            style={{ color: '#030213' }}>
            <MessageCircle className="w-3 h-3" /> Orça online
          </span>
        )}

        {/* Nota — topo direita */}
        {nota > 0 && (
          <span className="absolute top-2.5 right-2.5 z-[3] flex items-center gap-1 bg-white/95 px-2.5 py-[5px] rounded-full text-[12px] font-bold whitespace-nowrap">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/></svg>
            {nota.toFixed(1)}
          </span>
        )}

        {/* Ícone + nome + subtítulo */}
        <div className="absolute inset-0 flex items-center gap-3 sm:gap-4 px-4 sm:px-5">
          <div className="flex-shrink-0 rounded-full border-2 border-white/85 flex items-center justify-center w-12 h-12 sm:w-[68px] sm:h-[68px]">
            <Icon className="text-white w-6 h-6 sm:w-8 sm:h-8" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="text-white font-extrabold uppercase tracking-tight leading-[1.05] text-[16px] sm:text-[19px] line-clamp-2">
              {catNome || 'Serviço'}
            </div>
            <div className="text-white/85 text-[11px] sm:text-[12.5px] leading-snug line-clamp-2 mt-1">
              {design.subtitle}
            </div>
          </div>
        </div>
      </div>

      {/* ── DADOS ── */}
      <div className="px-[18px] pt-4 pb-[18px] relative">
        {/* Foto do prestador na interseção banner/corpo */}
        <div className="absolute -top-7 left-[18px] w-14 h-14 rounded-[16px] border-[3px] border-white overflow-hidden bg-[#030213] z-[5]"
          style={{ boxShadow: '0 6px 16px -6px rgba(3,2,19,0.4)' }}>
          {s.prestadores?.foto_url
            ? <img src={s.prestadores.foto_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">
                {getInitials(s.prestadores?.nome || '')}
              </div>
          }
        </div>

        {/* espaço reservado à direita da foto */}
        <div style={{ minHeight: 28 }} />

        <div className="mt-[14px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.04em] mb-0.5" style={{ color: design.accent }}>
            {catNome}
          </div>
          <h3 className="text-[15px] font-bold m-0 mb-1 leading-snug" style={{ color: '#030213' }}>{s.titulo}</h3>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[13px] text-[#717182]">{s.prestadores?.nome}</span>
            {s.prestadores?.verificado && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="oklch(0.6 0.118 184.704)">
                <path d="M12 2l2.4 2.1 3.1-.6 1.1 3 2.8 1.4-1 3.1 1 3.1-2.8 1.4-1.1 3-3.1-.6L12 22l-2.4-2.1-3.1.6-1.1-3-2.8-1.4 1-3.1-1-3.1 2.8-1.4 1.1-3 3.1.6z"/>
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" fill="none"/>
              </svg>
            )}
          </div>
          {Array.isArray(s.tags) && s.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {s.tags.map((t: string) => (
                <span key={t} className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(3,2,19,0.06)', color: '#45454f' }}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-[rgba(0,0,0,0.07)]">
            {price > 0 ? (
              <span className="text-[15px] font-extrabold" style={{ color: 'oklch(0.45 0.1 184)' }}>
                {formatCurrency(price)}
              </span>
            ) : (
              <span className="text-[13px] text-[#717182]">Sob orçamento</span>
            )}
            <span className="text-[13px] font-bold">Ver detalhes →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
