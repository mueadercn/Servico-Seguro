import { useState, useEffect } from 'react';
import { ArrowLeft, Save, RefreshCw, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router';
import { supabase } from '../../lib/supabase';

const CATEGORIAS_PROMPTS = [
  { chave: 'system_prompt_geral', label: 'Geral', icone: '🤖', desc: 'Usado quando a categoria não é reconhecida' },
  { chave: 'system_prompt_eletrica', label: 'Elétrica', icone: '⚡', desc: 'Problemas elétricos, quadro de disjuntores, pontos' },
  { chave: 'system_prompt_encanamento', label: 'Encanamento', icone: '🚿', desc: 'Vazamentos, entupimentos, instalações hidráulicas' },
  { chave: 'system_prompt_gesso', label: 'Gesso', icone: '🪨', desc: 'Forros, sancas, drywall, reparos' },
  { chave: 'system_prompt_pintura', label: 'Pintura', icone: '🎨', desc: 'Pintura interna, externa, massa corrida' },
  { chave: 'system_prompt_limpeza', label: 'Limpeza', icone: '🧹', desc: 'Limpeza residencial, comercial, pós-obra' },
  { chave: 'system_prompt_marcenaria', label: 'Marcenaria', icone: '🪚', desc: 'Móveis, portas, janelas, deck' },
  { chave: 'system_prompt_construcao', label: 'Construção', icone: '🏗️', desc: 'Reforma, alvenaria, azulejo, piso' },
  { chave: 'system_prompt_tecnologia', label: 'Tecnologia', icone: '💻', desc: 'Informática, redes, câmeras, suporte' },
  { chave: 'system_prompt_automotivo', label: 'Automotivo', icone: '🚗', desc: 'Mecânica, elétrica veicular, funilaria' },
  { chave: 'system_prompt_pets', label: 'Pets', icone: '🐾', desc: 'Banho, tosa, veterinário, adestramento' },
  { chave: 'system_prompt_saude', label: 'Saúde', icone: '❤️', desc: 'Massagem, fisioterapia, cuidador, enfermagem' },
  { chave: 'system_prompt_educacao', label: 'Educação', icone: '📚', desc: 'Aulas particulares, reforço, idiomas' },
];

export function AdminPrompts() {
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [aberto, setAberto] = useState<string | null>('system_prompt_geral');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { carregarPrompts(); }, []);

  async function carregarPrompts() {
    setLoading(true);
    const { data } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .like('chave', 'system_prompt%');
    const mapa: Record<string, string> = {};
    (data || []).forEach((c: any) => { mapa[c.chave] = c.valor; });
    setPrompts(mapa);
    setLoading(false);
  }

  async function salvar(chave: string) {
    setSalvando(chave);
    await supabase.from('configuracoes')
      .upsert({ chave, valor: prompts[chave] || '', atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
    setSalvando(null);
    setSalvo(chave);
    setTimeout(() => setSalvo(null), 2000);
  }

  function atualizar(chave: string, valor: string) {
    setPrompts(p => ({ ...p, [chave]: valor }));
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="h-5 w-5 text-success" />
        <div>
          <h2 className="font-bold text-primary">Prompts da IA por Categoria</h2>
          <p className="text-xs text-muted-foreground">
            Edite as instruções que a IA usa para conduzir a anamnese de cada tipo de serviço
          </p>
        </div>
        <button onClick={carregarPrompts} className="ml-auto p-2 hover:bg-slate-100 rounded-lg text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Guia rápido */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm">
        <div className="font-bold text-amber-800 mb-2">📋 Como funciona</div>
        <ul className="text-amber-700 space-y-1 text-xs">
          <li>• A IA usa o prompt da categoria do serviço solicitado</li>
          <li>• Sempre inclua: <strong>uma pergunta por vez</strong> e ao final <strong>ANAMNESE_CONCLUIDA</strong></li>
          <li>• Se uma categoria não tem prompt salvo aqui, usa o padrão do sistema</li>
          <li>• Salve após editar — mudanças entram em vigor imediatamente</li>
        </ul>
      </div>

      {CATEGORIAS_PROMPTS.map(cat => (
        <div key={cat.chave} className="bg-white border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setAberto(aberto === cat.chave ? null : cat.chave)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
            <span className="text-xl">{cat.icone}</span>
            <div className="flex-1 text-left">
              <div className="font-semibold text-primary text-sm">{cat.label}</div>
              <div className="text-xs text-muted-foreground">{cat.desc}</div>
            </div>
            <div className="flex items-center gap-2">
              {prompts[cat.chave] ? (
                <span className="text-xs bg-success/10 text-success font-bold px-2 py-0.5 rounded-full">✓ Configurado</span>
              ) : (
                <span className="text-xs bg-slate-100 text-muted-foreground px-2 py-0.5 rounded-full">Padrão do sistema</span>
              )}
              {aberto === cat.chave ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>

          {aberto === cat.chave && (
            <div className="border-t border-border px-5 pb-5 pt-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Instruções para a IA
              </label>
              <textarea
                value={prompts[cat.chave] || ''}
                onChange={e => atualizar(cat.chave, e.target.value)}
                rows={12}
                placeholder={`Escreva as instruções para a IA ao atender clientes de ${cat.label}...\n\nLembre de incluir:\n- REGRAS (uma pergunta por vez)\n- PERGUNTAS OBRIGATÓRIAS em ordem\n- Ao final das perguntas: ANAMNESE_CONCLUIDA`}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-primary resize-y leading-relaxed"
              />
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => salvar(cat.chave)}
                  disabled={!!salvando}
                  className="inline-flex items-center gap-2 bg-success text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-success/90 disabled:opacity-50 transition-colors">
                  {salvando === cat.chave ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                  ) : salvo === cat.chave ? (
                    <>✅ Salvo!</>
                  ) : (
                    <><Save className="h-4 w-4" /> Salvar prompt</>
                  )}
                </button>
                {prompts[cat.chave] && (
                  <button
                    onClick={() => { atualizar(cat.chave, ''); salvar(cat.chave); }}
                    className="text-xs text-red-500 hover:underline">
                    Restaurar padrão
                  </button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {(prompts[cat.chave] || '').length} caracteres
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
