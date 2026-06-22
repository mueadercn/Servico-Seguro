import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Send, CheckCircle2, ChevronRight } from 'lucide-react';
import { Logo } from '../components/Logo';
import { apiCall } from '../../lib/supabase';

const PRIMARY = '#030213';

const ASSUNTOS = [
  { id: 'duvida', label: '❓ Tenho uma dúvida', desc: 'Sobre como a plataforma funciona' },
  { id: 'problema', label: '🔧 Tive um problema', desc: 'Algo não está funcionando como esperado' },
  { id: 'sugestao', label: '💡 Tenho uma sugestão', desc: 'Ideia para melhorar o Serviço Seguro' },
  { id: 'prestador', label: '👷 Quero ser prestador', desc: 'Interesse em oferecer meus serviços' },
  { id: 'outro', label: '💬 Outro assunto', desc: 'Falar sobre outra coisa' },
];

type Step = 'assunto' | 'form' | 'enviado';

export function Contato() {
  const [step, setStep] = useState<Step>('assunto');
  const [assuntoSel, setAssuntoSel] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', mensagem: '' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function enviar() {
    if (!form.mensagem.trim()) { setErro('Escreva sua mensagem.'); return; }
    setEnviando(true); setErro('');
    try {
      const res = await apiCall('/api/admin/suporte', {
        method: 'POST',
        body: {
          nome: form.nome || null,
          email: form.email || null,
          telefone: form.telefone || null,
          assunto: ASSUNTOS.find(a => a.id === assuntoSel)?.label || 'Contato',
          mensagem: form.mensagem,
        }
      });
      if (res.ok) setStep('enviado');
      else setErro(res.error || 'Erro ao enviar. Tente novamente.');
    } catch { setErro('Erro ao enviar. Tente novamente.'); }
    setEnviando(false);
  }

  const inputCls = 'w-full px-4 py-3 border border-[#e2e8f0] rounded-[12px] bg-[#f8fafc] text-sm outline-none focus:border-[#030213] transition-colors';

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="text-[#64748b] hover:text-[#030213] transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Logo className="h-8" />
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-10">

        {/* STEP 1 — escolher assunto */}
        {step === 'assunto' && (
          <div>
            <h1 className="text-2xl font-extrabold text-[#030213] mb-1">Como podemos ajudar?</h1>
            <p className="text-[#64748b] text-sm mb-7">Escolha o assunto e fale com a nossa equipe.</p>

            <div className="space-y-2.5">
              {ASSUNTOS.map(a => (
                <button key={a.id}
                  onClick={() => { setAssuntoSel(a.id); setStep('form'); }}
                  className="w-full flex items-center gap-4 p-4 rounded-[14px] border border-[#e2e8f0] bg-white hover:border-[#030213] hover:shadow-sm transition-all text-left group">
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-[#030213]">{a.label}</div>
                    <div className="text-xs text-[#94a3b8] mt-0.5">{a.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#cbd5e1] group-hover:text-[#030213] transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 — formulário */}
        {step === 'form' && (
          <div>
            <button onClick={() => setStep('assunto')}
              className="flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#030213] mb-6 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>

            <h1 className="text-2xl font-extrabold text-[#030213] mb-1">
              {ASSUNTOS.find(a => a.id === assuntoSel)?.label}
            </h1>
            <p className="text-[#64748b] text-sm mb-7">
              Nos conte mais. Entraremos em contato em breve.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#64748b] tracking-wide mb-1.5 block">Nome</label>
                  <input value={form.nome} onChange={e => set('nome', e.target.value)}
                    placeholder="Seu nome" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#64748b] tracking-wide mb-1.5 block">Telefone</label>
                  <input value={form.telefone} onChange={e => set('telefone', e.target.value)}
                    placeholder="(55) 99999-9999" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#64748b] tracking-wide mb-1.5 block">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="seu@email.com" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#64748b] tracking-wide mb-1.5 block">Mensagem *</label>
                <textarea value={form.mensagem} onChange={e => set('mensagem', e.target.value)}
                  placeholder="Descreva sua dúvida, problema ou sugestão..."
                  rows={5} className={inputCls + ' resize-none'} />
              </div>

              {erro && (
                <div className="bg-[#FCEBEB] border border-[#f5c6c6] text-[#501313] text-sm px-4 py-3 rounded-[12px]">{erro}</div>
              )}

              <button onClick={enviar} disabled={enviando}
                className="w-full py-3.5 rounded-[13px] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: PRIMARY, color: '#fff' }}>
                <Send className="h-4 w-4" />
                {enviando ? 'Enviando...' : 'Enviar mensagem'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — confirmação */}
        {step === 'enviado' && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: '#EAF3DE' }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: '#3B6D11' }} />
            </div>
            <h2 className="text-xl font-extrabold text-[#030213] mb-2">Mensagem enviada!</h2>
            <p className="text-[#64748b] text-sm mb-8 max-w-xs mx-auto">
              Recebemos seu contato e retornaremos em breve pelo email ou telefone informado.
            </p>
            <Link to="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[13px] font-bold text-sm text-white"
              style={{ background: PRIMARY }}>
              Voltar ao início
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
