import { getPrestador, getContratante } from '../../../lib/supabase';

export const API_URL = import.meta.env.VITE_API_URL || 'https://servi-o-seguro-production.up.railway.app';

// Sessão do Serviço Seguro reaproveitada pelo Blindado
export function getSessaoBlindado(): { tipo: 'prestador' | 'contratante'; usuario: any } | null {
  const prestador = getPrestador();
  if (prestador) return { tipo: 'prestador', usuario: prestador };
  const contratante = getContratante();
  if (contratante) return { tipo: 'contratante', usuario: contratante };
  return null;
}

export function formatarValor(v: any): string {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarCentavos(c: number): string {
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarData(iso?: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('pt-BR');
}

export function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  rascunho: { label: 'Rascunho', cor: 'bg-slate-200 text-slate-700' },
  liberado: { label: 'Aguardando assinaturas', cor: 'bg-amber-100 text-amber-800' },
  assinado: { label: 'Assinado', cor: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', cor: 'bg-red-100 text-red-700' },
};
