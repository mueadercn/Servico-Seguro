import {
  Hammer, PaintRoller, Package, Wrench, AppWindow, Zap, Droplets,
  Layers, Paintbrush, ShieldCheck, Monitor, Sparkles, Leaf,
  Waves, Truck, PartyPopper, Warehouse, Building2, Tractor, Building,
  PawPrint, HeartPulse, BookOpen, Wine, Car, ClipboardList,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryDesign {
  gradient: string; // linear-gradient(135deg, ...)
  accent: string;   // cor do label pequeno no corpo do card
  subtitle: string; // palavras-chave separadas por " • "
  Icon: LucideIcon; // ícone de linha branco
}

function grad(a: string, b: string): string {
  return `linear-gradient(135deg, ${a}, ${b})`;
}

// Chave = nome normalizado (lowercase, sem acento, trim)
const CATEGORY_DESIGN: Record<string, CategoryDesign> = {
  'construcao e reforma': { gradient: grad('#ea8b1f', '#f6a830'), accent: '#c2620e', Icon: Hammer, subtitle: 'Obras • Reformas • Ampliações' },
  'reforma':              { gradient: grad('#ea8b1f', '#f6a830'), accent: '#c2620e', Icon: Hammer, subtitle: 'Obras • Reformas • Ampliações' },
  'acabamentos':          { gradient: grad('#d2691e', '#e8884a'), accent: '#b4531a', Icon: PaintRoller, subtitle: 'Pintura • Revestimentos • Texturas • Detalhes' },
  'marcenaria e moveis planejados': { gradient: grad('#7c4a21', '#9c6431'), accent: '#6b3f1d', Icon: Package, subtitle: 'Móveis sob medida • Ambientes' },
  'marcenaria':           { gradient: grad('#7c4a21', '#9c6431'), accent: '#6b3f1d', Icon: Package, subtitle: 'Móveis sob medida • Ambientes' },
  'serralheria':          { gradient: grad('#475569', '#64748b'), accent: '#334155', Icon: Wrench, subtitle: 'Portões • Grades • Estruturas metálicas' },
  'vidros e esquadrias':  { gradient: grad('#3b82c4', '#5fa3d8'), accent: '#2c5f8a', Icon: AppWindow, subtitle: 'Vidros • Janelas • Box • Esquadrias' },
  'eletrica':             { gradient: grad('#1f5fae', '#2b7fd0'), accent: '#1b4f8f', Icon: Zap, subtitle: 'Instalações • Manutenção • Reparos' },
  'instalacoes':          { gradient: grad('#1f5fae', '#2b7fd0'), accent: '#1b4f8f', Icon: Zap, subtitle: 'Instalações • Manutenção • Reparos' },
  'encanamento':          { gradient: grad('#1f6fae', '#3b92d8'), accent: '#1b5a8f', Icon: Droplets, subtitle: 'Instalações • Reparos • Vazamentos' },
  'gesso':                { gradient: grad('#8b6db8', '#a98fd0'), accent: '#6f4f9c', Icon: Layers, subtitle: 'Forros • Sancas • Drywall' },
  'pintura':              { gradient: grad('#d2691e', '#e8884a'), accent: '#b4531a', Icon: Paintbrush, subtitle: 'Pintura • Texturas • Acabamentos' },
  'seguranca':            { gradient: grad('#5b21b6', '#7c3aed'), accent: '#5b21b6', Icon: ShieldCheck, subtitle: 'Câmeras • Alarmes • Controle de acesso' },
  'tecnologia':           { gradient: grad('#0e7490', '#0891b2'), accent: '#0e6b86', Icon: Monitor, subtitle: 'Redes • Suporte técnico • Automação' },
  'limpeza e conservacao':{ gradient: grad('#1e293b', '#334155'), accent: '#1e293b', Icon: Sparkles, subtitle: 'Limpeza residencial • Pós-obra • Dedetização' },
  'limpeza':              { gradient: grad('#1e293b', '#334155'), accent: '#1e293b', Icon: Sparkles, subtitle: 'Limpeza residencial • Pós-obra • Dedetização' },
  'jardinagem e paisagismo': { gradient: grad('#4d9e2a', '#6cb33f'), accent: '#3a7a1f', Icon: Leaf, subtitle: 'Paisagismo • Podas • Manutenção de jardins' },
  'piscinas e areas externas': { gradient: grad('#2f8fd0', '#4aa8e0'), accent: '#1f6fa8', Icon: Waves, subtitle: 'Construção • Limpeza • Manutenção' },
  'fretes e mudancas':    { gradient: grad('#5b6675', '#78859a'), accent: '#454f5c', Icon: Truck, subtitle: 'Mudanças • Fretes • Carretos • Montagem' },
  'eventos e experiencias': { gradient: grad('#c0392b', '#e05545'), accent: '#a32f23', Icon: PartyPopper, subtitle: 'Festas • Casamentos • Corporativos' },
  'locacoes':             { gradient: grad('#0d7a6f', '#14998b'), accent: '#0b5f57', Icon: Warehouse, subtitle: 'Imóveis • Equipamentos • Estruturas' },
  'servicos empresariais':{ gradient: grad('#3b3f8f', '#4f54b0'), accent: '#2f3370', Icon: Building2, subtitle: 'Infraestrutura • Manutenção • Consultoria' },
  'servicos rurais':      { gradient: grad('#6b7d3a', '#84974a'), accent: '#55642d', Icon: Tractor, subtitle: 'Terraplanagem • Cercas • Irrigação' },
  'manutencao predial e condominios': { gradient: grad('#d99a1f', '#e8b33f'), accent: '#a8740f', Icon: Building, subtitle: 'Zeladoria • Reparos • Infraestrutura' },
  'manutencao predial':   { gradient: grad('#d99a1f', '#e8b33f'), accent: '#a8740f', Icon: Building, subtitle: 'Zeladoria • Reparos • Infraestrutura' },
  'pets':                 { gradient: grad('#7c5aa8', '#9670c0'), accent: '#5f4488', Icon: PawPrint, subtitle: 'Banho e tosa • Veterinário • Hospedagem' },
  'saude e bem-estar':    { gradient: grad('#2f9e8f', '#45b8a5'), accent: '#207567', Icon: HeartPulse, subtitle: 'Fisioterapia • Personal • Nutrição' },
  'educacao':             { gradient: grad('#3b54a8', '#4f6fc8'), accent: '#2f4488', Icon: BookOpen, subtitle: 'Aulas • Idiomas • Reforço • Música' },
  'experiencias':         { gradient: grad('#a83a6f', '#c45088'), accent: '#882f58', Icon: Wine, subtitle: 'Gastronomia • Passeios • Entretenimento' },
  'servicos automotivos': { gradient: grad('#2f6fb0', '#4a8fd0'), accent: '#1f5590', Icon: Car, subtitle: 'Mecânica • Elétrica • Higienização • Funilaria' },
  'outros servicos':      { gradient: grad('#64748b', '#808fa3'), accent: '#4b5563', Icon: ClipboardList, subtitle: 'Soluções diversas para suas necessidades' },
};

const FALLBACK: CategoryDesign = {
  gradient: grad('#334155', '#475569'),
  accent: '#334155',
  Icon: Wrench,
  subtitle: 'Serviços profissionais',
};

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalize(nome: string): string {
  return (nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .trim();
}

export function getCategoryDesign(nome: string): CategoryDesign {
  return CATEGORY_DESIGN[normalize(nome)] || FALLBACK;
}
